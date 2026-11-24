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

test('injectModIntoMain adds allowlisted IPC + self-updater and stripMainMod removes it cleanly', () => {
  const { injectModIntoMain, stripMainMod } = require('../scripts/install');
  const origMain = "const { app, ipcMain } = require('electron');\nipcMain.handle('get-systeminfo', () => ({}));\n";
  const patchedMain = injectModIntoMain(origMain);
  assert.ok(patchedMain.includes('twfoxtetrio-fetch'));
  assert.ok(patchedMain.includes('twfoxtetrio-get-update-info'));
  assert.ok(patchedMain.includes('twfoxtetrio-self-update-apply'));
  assert.ok(patchedMain.includes("u.hostname === 'you.have.fail'"));
  assert.ok(patchedMain.includes('/Foxcrack/twfoxtetrio/'));

  // Idempotent on re-injection and clean strip back to original content
  assert.equal(injectModIntoMain(patchedMain), patchedMain);
  assert.equal(stripMainMod(patchedMain), origMain);
});

test('registerTwfoxMainIpc stages & applies synthetic ASAR self-updates and blocks disallowed domains', async () => {
  const { PassThrough } = require('node:stream');
  const crypto = require('node:crypto');
  const { registerTwfoxMainIpc, injectModIntoMain } = require('../scripts/install');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'twfox-selfupd-'));
  const asarPath = path.join(tmpDir, 'app.asar');
  const seedPath = path.join(tmpDir, 'seed.asar');
  try {
    createSyntheticAsar(seedPath);
    const baseMain = injectModIntoMain(readAsarFile(seedPath, 'main.js').toString('utf8'));
    const basePreload =
      readAsarFile(seedPath, 'preload.js').toString('utf8') +
      "\n// === TWFOXTETRIO MOD START ===\nconsole.log('old');\n// === TWFOXTETRIO MOD END ===\n";
    writePatchedAsar(
      seedPath,
      {
        'preload.js': Buffer.from(basePreload, 'utf8'),
        'main.js': Buffer.from(baseMain, 'utf8')
      },
      asarPath
    );

    const handlers = new Map();
    const mockIpcMain = {
      handle(ch, fn) {
        handlers.set(ch, fn);
      }
    };
    const remoteRoutes = {
      'https://raw.githubusercontent.com/Foxcrack/twfoxtetrio/main/package.json': '{"name":"twfoxtetrio","version":"9.9.9"}',
      'https://raw.githubusercontent.com/Foxcrack/twfoxtetrio/main/scripts/build.js':
        "const SOURCE_FILES = [\n  'src/core/runtime.js'\n];\n",
      'https://raw.githubusercontent.com/Foxcrack/twfoxtetrio/main/src/core/runtime.js':
        "/* updated runtime 9.9.9 */ window.__TWFOX_UPDATED_999__ = true;\n"
    };
    const mockHttps = {
      get(url, _opts, cb) {
        const res = new PassThrough();
        res.statusCode = Object.prototype.hasOwnProperty.call(remoteRoutes, url) ? 200 : 404;
        res.headers = { 'content-type': 'text/plain' };
        queueMicrotask(() => {
          cb(res);
          res.end(Buffer.from(remoteRoutes[url] || 'not found', 'utf8'));
        });
        return { on() {}, setTimeout() {} };
      }
    };

    registerTwfoxMainIpc({
      ipcMain: mockIpcMain,
      app: { quit() {}, relaunch() {}, exit() {} },
      https: mockHttps,
      fs,
      path,
      crypto,
      cp: null,
      asarPath,
      forceInPlaceSwap: true,
      skipRelaunch: true,
      skipSpawn: true,
      processRef: { platform: 'linux', pid: process.pid, env: {}, resourcesPath: tmpDir, execPath: '/bin/tetrio' }
    });

    const info = await handlers.get('twfoxtetrio-get-update-info')();
    assert.equal(info.ok, true);
    assert.equal(info.writable, true);

    await assert.rejects(
      () => handlers.get('twfoxtetrio-fetch')(null, 'https://evil.example/data.json'),
      /Disallowed domain/
    );

    const fetched = await handlers.get('twfoxtetrio-fetch')(
      null,
      'https://raw.githubusercontent.com/Foxcrack/twfoxtetrio/main/package.json'
    );
    assert.equal(fetched.ok, true);
    assert.ok(Buffer.from(fetched.base64, 'base64').toString('utf8').includes('9.9.9'));

    const applyRes = await handlers.get('twfoxtetrio-self-update-apply')();
    assert.equal(applyRes.ok, true);
    assert.equal(applyRes.version, '9.9.9');
    assert.equal(verifyAsar(asarPath).ok, true);

    const newPreload = readAsarFile(asarPath, 'preload.js').toString('utf8');
    assert.ok(newPreload.includes('window.IS_ELECTRON = true;'));
    assert.ok(newPreload.includes('// twfoxtetrio v9.9.9'));
    assert.ok(newPreload.includes('window.__TWFOX_UPDATED_999__ = true;'));
    assert.equal(newPreload.includes("console.log('old');"), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('registerTwfoxMainIpc manages custom assets folder creation, openPath, save, scan, and safe deletion', async () => {
  const crypto = require('node:crypto');
  const { registerTwfoxMainIpc } = require('../scripts/install');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'twfox-assetsdir-'));
  const assetsDir = path.join(tmpDir, 'foxmod-assets');
  try {
    const handlers = new Map();
    const openedPaths = [];
    registerTwfoxMainIpc({
      ipcMain: { handle: (ch, fn) => handlers.set(ch, fn) },
      app: { getPath: () => tmpDir },
      shell: {
        async openPath(target) {
          openedPaths.push(target);
          return '';
        }
      },
      https: {},
      fs,
      path,
      crypto,
      cp: null,
      assetsDir,
      processRef: { platform: 'win32', pid: process.pid, env: {}, resourcesPath: tmpDir, execPath: 'tetrio.exe' }
    });

    const openRes = await handlers.get('twfoxtetrio-assets-open-folder')(null, {});
    assert.equal(openRes.ok, true);
    assert.equal(openRes.path, assetsDir);
    assert.deepEqual(openedPaths, [assetsDir]);
    assert.equal(fs.existsSync(path.join(assetsDir, 'skins')), true);
    assert.equal(fs.existsSync(path.join(assetsDir, 'boards')), true);
    assert.equal(fs.existsSync(path.join(assetsDir, 'sfx')), true);
    assert.equal(fs.existsSync(path.join(assetsDir, 'backgrounds')), true);
    assert.equal(fs.existsSync(path.join(assetsDir, 'README.txt')), true);

    // Reject path traversal & disallowed subfolder
    const badSave = await handlers.get('twfoxtetrio-assets-save-file')(null, {
      subfolder: '../evil',
      fileName: 'x.png',
      base64: Buffer.from('abc').toString('base64')
    });
    assert.equal(badSave.ok, false);

    // Save single file + drop custom SFX directory directly on disk
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const saveRes = await handlers.get('twfoxtetrio-assets-save-file')(null, {
      subfolder: 'skins',
      fileName: 'MySkin.png',
      base64: pngBytes.toString('base64')
    });
    assert.equal(saveRes.ok, true);
    assert.equal(saveRes.relPath, 'skins/MySkin.png');

    const sfxPackDir = path.join(assetsDir, 'sfx', 'CustomClicks');
    fs.mkdirSync(sfxPackDir, { recursive: true });
    fs.writeFileSync(path.join(sfxPackDir, 'move.ogg'), Buffer.from('OggS-fake-audio'));

    const scanRes = await handlers.get('twfoxtetrio-assets-scan-folder')();
    assert.equal(scanRes.ok, true);
    assert.equal(scanRes.items.length, 2);
    assert.ok(scanRes.items.some((x) => x.kind === 'file' && x.relPath === 'skins/MySkin.png'));
    assert.ok(scanRes.items.some((x) => x.kind === 'dir' && x.relPath === 'sfx/CustomClicks' && x.files[0].fileName === 'move.ogg'));

    // Cannot delete subfolder root itself, only items inside it
    const badDel = await handlers.get('twfoxtetrio-assets-delete-file')(null, { relPath: 'skins' });
    assert.equal(badDel.ok, false);
    const delRes = await handlers.get('twfoxtetrio-assets-delete-file')(null, { relPath: 'skins/MySkin.png' });
    assert.equal(delRes.ok, true);
    assert.equal(fs.existsSync(path.join(assetsDir, 'skins', 'MySkin.png')), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
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
