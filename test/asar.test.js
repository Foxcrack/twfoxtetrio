'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  computeIntegrity,
  parseAsar,
  readAsarFile,
  writePatchedAsar,
  verifyAsar
} = require('../scripts/asar');
const {
  buildModSnippet,
  hasModSnippet,
  stripModSnippet,
  injectModIntoPreload
} = require('../scripts/build');
const {
  parseArgs,
  resolveAsarCandidate,
  getTetrioAsarCandidates,
  findTetrioAsar,
  parseLinuxRunningProcesses
} = require('../scripts/install');

function createSyntheticAsar(targetPath) {
  const preloadBuf = Buffer.from('window.IS_ELECTRON = true;\nwindow.CLIENT_VERSION = 10;\n', 'utf8');
  const mainBuf = Buffer.from('console.log("main");\n', 'utf8');
  const assetBuf = Buffer.from([1, 2, 3, 4, 5, 6, 7]);

  const header = {
    files: {
      'main.js': {
        size: mainBuf.length,
        offset: '0',
        integrity: computeIntegrity(mainBuf),
        executable: true
      },
      'preload.js': {
        size: preloadBuf.length,
        offset: String(mainBuf.length),
        integrity: computeIntegrity(preloadBuf)
      },
      assets: {
        files: {
          'blob.bin': {
            size: assetBuf.length,
            offset: String(mainBuf.length + preloadBuf.length),
            integrity: computeIntegrity(assetBuf)
          }
        }
      },
      node_modules: {
        files: {
          'native.node': {
            size: 123,
            unpacked: true,
            integrity: computeIntegrity(Buffer.alloc(123, 9))
          }
        }
      }
    }
  };

  const jsonBuf = Buffer.from(JSON.stringify(header), 'utf8');
  const alignedLen = Math.ceil(jsonBuf.length / 4) * 4;
  const pickle = Buffer.alloc(16);
  pickle.writeUInt32LE(4, 0);
  pickle.writeUInt32LE(alignedLen + 8, 4);
  pickle.writeUInt32LE(alignedLen + 4, 8);
  pickle.writeUInt32LE(jsonBuf.length, 12);

  const fd = fs.openSync(targetPath, 'w');
  try {
    fs.writeSync(fd, pickle);
    fs.writeSync(fd, jsonBuf);
    if (alignedLen > jsonBuf.length) {
      fs.writeSync(fd, Buffer.alloc(alignedLen - jsonBuf.length, 0));
    }
    fs.writeSync(fd, mainBuf);
    fs.writeSync(fd, preloadBuf);
    fs.writeSync(fd, assetBuf);
  } finally {
    fs.closeSync(fd);
  }
}

test('ASAR round-trip patching preserves files, flags, unpacked metadata, and SHA-256 integrity', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'twfox-asar-'));
  try {
    const origAsar = path.join(tmpDir, 'app.asar');
    const patchedAsar = path.join(tmpDir, 'app.patched.asar');
    const restoredAsar = path.join(tmpDir, 'app.restored.asar');

    createSyntheticAsar(origAsar);
    assert.equal(verifyAsar(origAsar).ok, true);

    const origPreload = readAsarFile(origAsar, 'preload.js').toString('utf8');
    const modSnippet = buildModSnippet();
    const patchedPreload = injectModIntoPreload(origPreload, modSnippet);
    assert.equal(hasModSnippet(patchedPreload), true);

    writePatchedAsar(origAsar, { 'preload.js': Buffer.from(patchedPreload, 'utf8') }, patchedAsar);
    const verified = verifyAsar(patchedAsar);
    assert.equal(verified.ok, true);
    assert.equal(verified.fileCount, 3);

    assert.equal(readAsarFile(patchedAsar, 'preload.js').toString('utf8'), patchedPreload);
    assert.equal(readAsarFile(patchedAsar, 'main.js').toString('utf8'), 'console.log("main");\n');
    assert.deepEqual(readAsarFile(patchedAsar, 'assets/blob.bin'), Buffer.from([1, 2, 3, 4, 5, 6, 7]));

    const parsed = parseAsar(patchedAsar);
    assert.equal(parsed.header.files['main.js'].executable, true);
    assert.equal(parsed.header.files.node_modules.files['native.node'].unpacked, true);
    assert.equal(parsed.header.files.node_modules.files['native.node'].offset, undefined);

    const strippedPreload = stripModSnippet(readAsarFile(patchedAsar, 'preload.js').toString('utf8'));
    assert.equal(hasModSnippet(strippedPreload), false);
    assert.equal(strippedPreload, origPreload);

    writePatchedAsar(patchedAsar, { 'preload.js': Buffer.from(strippedPreload, 'utf8') }, restoredAsar);
    assert.equal(verifyAsar(restoredAsar).ok, true);
    assert.equal(readAsarFile(restoredAsar, 'preload.js').toString('utf8'), origPreload);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('install.js parseArgs supports flags and positional paths (drag-and-drop)', () => {
  assert.deepEqual(
    parseArgs(['C:\\Users\\HP\\AppData\\Local\\Programs\\tetrio-desktop']),
    { action: 'install', customPath: 'C:\\Users\\HP\\AppData\\Local\\Programs\\tetrio-desktop' }
  );
  assert.deepEqual(
    parseArgs(['--uninstall', '--path', 'D:\\Games\\TETRIO']),
    { action: 'uninstall', customPath: 'D:\\Games\\TETRIO' }
  );
});

test('injectModIntoMain adds allowlisted twfoxtetrio-fetch IPC and stripMainMod removes it cleanly', () => {
  const { injectModIntoMain, stripMainMod } = require('../scripts/install');
  const origMain = "const { app, ipcMain } = require('electron');\nipcMain.handle('get-systeminfo', () => ({}));\n";
  const patchedMain = injectModIntoMain(origMain);
  assert.ok(patchedMain.includes('twfoxtetrio-fetch'));
  assert.ok(patchedMain.includes("parsed.hostname !== 'you.have.fail'"));

  // Idempotent on re-injection and clean strip back to original content
  assert.equal(injectModIntoMain(patchedMain), patchedMain);
  assert.equal(stripMainMod(patchedMain), origMain);
});

test('Linux installer resolves distro, wrapper script, Flatpak, extracted AppImage, and process detection paths', () => {
  const mkFs = (entries) => {
    const map = new Map(Object.entries(entries));
    return {
      existsSync: (target) => map.has(target),
      statSync: (target) => {
        const entry = map.get(target);
        if (!entry) throw new Error('ENOENT: ' + target);
        return {
          isFile: () => entry.type === 'file',
          isDirectory: () => entry.type === 'dir',
          size: entry.content ? Buffer.byteLength(entry.content) : 0
        };
      },
      realpathSync: (target) => (map.get(target) && map.get(target).real) || target,
      readFileSync: (target) => Buffer.from((map.get(target) && map.get(target).content) || '')
    };
  };

  // Wrapper script in /usr/bin pointing to /opt/TETR.IO/tetrio-desktop
  const fakeLinuxFs = mkFs({
    '/usr/bin/tetrio-desktop': { type: 'file', content: '#!/bin/sh\nexec /opt/TETR.IO/tetrio-desktop "$@"\n' },
    '/opt/TETR.IO/tetrio-desktop': { type: 'file', content: '\x7fELF...' },
    '/opt/TETR.IO/resources/app.asar': { type: 'file', content: 'asar' }
  });
  const candidates = getTetrioAsarCandidates({
    platform: 'linux',
    env: { PATH: '/usr/bin' },
    homeDir: '/home/fox',
    fs: fakeLinuxFs,
    pathImpl: path.posix
  });
  assert.ok(candidates.includes('/opt/TETR.IO/resources/app.asar'));
  assert.equal(
    findTetrioAsar(null, { platform: 'linux', env: { PATH: '/usr/bin' }, homeDir: '/home/fox', fs: fakeLinuxFs, pathImpl: path.posix }),
    '/opt/TETR.IO/resources/app.asar'
  );

  // Extracted AppImage squashfs-root directory
  const squashFs = mkFs({
    '/tmp/squashfs-root': { type: 'dir' },
    '/tmp/squashfs-root/usr/lib/tetrio-desktop/resources/app.asar': { type: 'file', content: 'asar' }
  });
  assert.equal(
    resolveAsarCandidate('/tmp/squashfs-root', squashFs, path.posix),
    '/tmp/squashfs-root/usr/lib/tetrio-desktop/resources/app.asar'
  );

  // Raw .AppImage throws actionable extract guidance
  assert.throws(
    () => resolveAsarCandidate('/home/fox/TETR.IO.AppImage', squashFs, path.posix),
    /--appimage-extract/
  );

  // Process detection catches running TETR.IO Desktop on Linux but ignores our own installer script
  const selfPid = 9001;
  assert.equal(
    parseLinuxRunningProcesses('9001 node /repo/scripts/install.js\n1234 tetrio-desktop /opt/TETR.IO/tetrio-desktop\n', selfPid),
    true
  );
  assert.equal(
    parseLinuxRunningProcesses('9001 bash install.sh\n4321 gnome-shell /usr/bin/gnome-shell\n', selfPid),
    false
  );
});
