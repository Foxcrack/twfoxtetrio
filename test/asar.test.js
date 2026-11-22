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
const { parseArgs } = require('../scripts/install');

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

test('installMod injects allowlisted twfoxtetrio-fetch IPC into main.js and uninstallMod restores backup cleanly', () => {
  const { installMod, uninstallMod } = require('../scripts/install');
  function buildRawAsar(filesObj) {
    const names = Object.keys(filesObj);
    const metaFiles = {};
    const blobs = [];
    let offset = 0;
    for (const name of names) {
      const buf = filesObj[name];
      metaFiles[name] = { size: buf.length, offset: String(offset) };
      blobs.push(buf);
      offset += buf.length;
    }
    const headerJson = JSON.stringify({ files: metaFiles });
    const jsonBuf = Buffer.from(headerJson, 'utf8');
    const alignedJsonLen = Math.ceil(jsonBuf.length / 4) * 4;
    const paddedJson = Buffer.alloc(alignedJsonLen);
    jsonBuf.copy(paddedJson);
    const hdr = Buffer.alloc(16);
    hdr.writeUInt32LE(4, 0);
    hdr.writeUInt32LE(8 + alignedJsonLen, 4);
    hdr.writeUInt32LE(4 + alignedJsonLen, 8);
    hdr.writeUInt32LE(jsonBuf.length, 12);
    return Buffer.concat([hdr, paddedJson, ...blobs]);
  }
  function extractFromAsar(asarBuf, name) {
    const jsonLen = asarBuf.readUInt32LE(12);
    const header = JSON.parse(asarBuf.slice(16, 16 + jsonLen).toString('utf8'));
    const baseOffset = 8 + asarBuf.readUInt32LE(4);
    const entry = header.files[name];
    return asarBuf.slice(baseOffset + Number(entry.offset), baseOffset + Number(entry.offset) + entry.size).toString('utf8');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'twfoxtetrio-main-ipc-'));
  try {
    const asarPath = path.join(tmpDir, 'app.asar');
    const origMain = "const { app, ipcMain } = require('electron');\nipcMain.handle('get-systeminfo', () => ({}));\n";
    const origPreload = "window.IPC = require('electron').ipcRenderer;\n";
    const rawAsar = buildRawAsar({
      'package.json': Buffer.from('{"name":"tetrio-desktop"}', 'utf8'),
      'preload.js': Buffer.from(origPreload, 'utf8'),
      'main.js': Buffer.from(origMain, 'utf8')
    });
    fs.writeFileSync(asarPath, rawAsar);

    installMod(asarPath);
    const patchedBuf = fs.readFileSync(asarPath);
    const patchedMain = extractFromAsar(patchedBuf, 'main.js');
    assert.ok(patchedMain.includes('twfoxtetrio-fetch'));
    assert.ok(patchedMain.includes('you.have.fail'));
    assert.ok(fs.existsSync(asarPath + '.bak'));

    uninstallMod(asarPath);
    const restoredBuf = fs.readFileSync(asarPath);
    assert.equal(extractFromAsar(restoredBuf, 'main.js'), origMain);
    assert.equal(extractFromAsar(restoredBuf, 'preload.js'), origPreload);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
