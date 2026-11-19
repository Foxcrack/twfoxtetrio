'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const {
  readAsarFile,
  writePatchedAsar,
  verifyAsar
} = require('./asar');
const {
  buildModSnippet,
  hasModSnippet,
  stripModSnippet,
  injectModIntoPreload
} = require('./build');

function parseArgs(argv) {
  const opts = {
    action: 'install',
    customPath: null
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--uninstall' || arg === '-u') {
      opts.action = 'uninstall';
    } else if (arg === '--status' || arg === '-s') {
      opts.action = 'status';
    } else if (arg === '--help' || arg === '-h') {
      opts.action = 'help';
    } else if ((arg === '--path' || arg === '-p') && i + 1 < argv.length) {
      opts.customPath = argv[++i];
    } else if (arg.startsWith('--path=')) {
      opts.customPath = arg.slice('--path='.length);
    }
  }
  return opts;
}

function resolveAsarCandidate(candidate) {
  if (!candidate) return null;
  const resolved = path.resolve(candidate);
  if (!fs.existsSync(resolved)) return null;

  const stat = fs.statSync(resolved);
  if (stat.isFile() && resolved.toLowerCase().endsWith('.asar')) {
    return resolved;
  }
  if (stat.isDirectory()) {
    const direct = path.join(resolved, 'app.asar');
    if (fs.existsSync(direct)) return direct;
    const inResources = path.join(resolved, 'resources', 'app.asar');
    if (fs.existsSync(inResources)) return inResources;
    const macResources = path.join(resolved, 'Contents', 'Resources', 'app.asar');
    if (fs.existsSync(macResources)) return macResources;
  }
  return null;
}

function findTetrioAsar(customPath) {
  if (customPath) {
    const found = resolveAsarCandidate(customPath);
    if (!found) {
      throw new Error('Could not find app.asar at: ' + customPath);
    }
    return found;
  }

  const candidates = [];
  if (process.env.TETRIO_PATH) {
    candidates.push(process.env.TETRIO_PATH);
  }
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
    candidates.push(path.join(localAppData, 'Programs', 'tetrio-desktop', 'resources', 'app.asar'));
    candidates.push(path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'TETR.IO', 'resources', 'app.asar'));
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/TETR.IO.app/Contents/Resources/app.asar');
  } else {
    candidates.push('/opt/TETR.IO/resources/app.asar');
    candidates.push('/usr/lib/tetrio-desktop/resources/app.asar');
  }

  for (const candidate of candidates) {
    const found = resolveAsarCandidate(candidate);
    if (found) return found;
  }

  throw new Error(
    'Could not locate TETR.IO Desktop app.asar automatically. Pass --path "C:\\Path\\To\\tetrio-desktop".'
  );
}

function isTetrioRunning() {
  if (process.platform !== 'win32') return false;
  try {
    const out = cp.execSync('tasklist /FI "IMAGENAME eq TETR.IO.exe" /NH', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return out.toLowerCase().includes('tetr.io.exe');
  } catch (_) {
    return false;
  }
}

function replaceFileSafe(srcPath, destPath) {
  try {
    fs.renameSync(srcPath, destPath);
  } catch (err) {
    if (err && (err.code === 'EPERM' || err.code === 'EBUSY')) {
      fs.copyFileSync(srcPath, destPath);
      fs.unlinkSync(srcPath);
    } else {
      throw err;
    }
  }
}

function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {}
}

function printHelp() {
  console.log([
    'twfoxtetrio installer',
    '',
    'Usage:',
    '  node scripts/install.js [--path <tetrio-dir-or-asar>]',
    '  node scripts/install.js --uninstall [--path <tetrio-dir-or-asar>]',
    '  node scripts/install.js --status [--path <tetrio-dir-or-asar>]'
  ].join('\n'));
}

function installMod(asarPath) {
  if (isTetrioRunning()) {
    throw new Error('TETR.IO.exe is currently running. Please close TETR.IO Desktop before installing the mod.');
  }

  const backupPath = asarPath + '.bak';
  const tempPath = asarPath + '.tmp';

  try {
    const currentPreload = readAsarFile(asarPath, 'preload.js').toString('utf8');
    const alreadyPatched = hasModSnippet(currentPreload);

    let sourceAsar = asarPath;
    if (!alreadyPatched) {
      fs.copyFileSync(asarPath, backupPath);
      console.log('[twfoxtetrio] Backup created: ' + backupPath);
    } else if (fs.existsSync(backupPath)) {
      const bakPreload = readAsarFile(backupPath, 'preload.js').toString('utf8');
      if (!hasModSnippet(bakPreload)) {
        sourceAsar = backupPath;
      }
    }

    const basePreload = readAsarFile(sourceAsar, 'preload.js').toString('utf8');
    const modSnippet = buildModSnippet();
    const nextPreload = injectModIntoPreload(basePreload, modSnippet);

    writePatchedAsar(
      sourceAsar,
      { 'preload.js': Buffer.from(nextPreload, 'utf8') },
      tempPath
    );

    const check = verifyAsar(tempPath);
    if (!check.ok) {
      throw new Error('Verification of patched app.asar failed');
    }

    replaceFileSafe(tempPath, asarPath);
    const finalCheck = verifyAsar(asarPath);
    console.log('[twfoxtetrio] Mod installed cleanly into: ' + asarPath);
    console.log('[twfoxtetrio] Verified ' + finalCheck.fileCount + ' files (' + finalCheck.totalPackedBytes + ' packed bytes).');
    console.log('[twfoxtetrio] Launch TETR.IO Desktop and play BLITZ or 40 LINES to see the live HUD tracker!');
  } finally {
    cleanupFile(tempPath);
  }
}

function uninstallMod(asarPath) {
  if (isTetrioRunning()) {
    throw new Error('TETR.IO.exe is currently running. Please close TETR.IO Desktop before uninstalling the mod.');
  }

  const backupPath = asarPath + '.bak';
  const tempPath = asarPath + '.tmp';

  try {
    if (fs.existsSync(backupPath)) {
      const bakPreload = readAsarFile(backupPath, 'preload.js').toString('utf8');
      if (!hasModSnippet(bakPreload)) {
        verifyAsar(backupPath);
        fs.copyFileSync(backupPath, tempPath);
        replaceFileSafe(tempPath, asarPath);
        verifyAsar(asarPath);
        fs.unlinkSync(backupPath);
        console.log('[twfoxtetrio] Restored original vanilla app.asar from backup.');
        return;
      }
    }

    const currentPreload = readAsarFile(asarPath, 'preload.js').toString('utf8');
    if (!hasModSnippet(currentPreload)) {
      console.log('[twfoxtetrio] Mod is not installed in: ' + asarPath);
      return;
    }

    const cleanPreload = stripModSnippet(currentPreload);
    writePatchedAsar(
      asarPath,
      { 'preload.js': Buffer.from(cleanPreload, 'utf8') },
      tempPath
    );
    verifyAsar(tempPath);
    replaceFileSafe(tempPath, asarPath);
    verifyAsar(asarPath);
    console.log('[twfoxtetrio] Mod removed cleanly from: ' + asarPath);
  } finally {
    cleanupFile(tempPath);
  }
}

function showStatus(asarPath) {
  const backupPath = asarPath + '.bak';
  const currentPreload = readAsarFile(asarPath, 'preload.js').toString('utf8');
  const installed = hasModSnippet(currentPreload);
  const check = verifyAsar(asarPath);
  console.log('app.asar   :', asarPath);
  console.log('installed  :', installed ? 'YES' : 'NO');
  console.log('backup     :', fs.existsSync(backupPath) ? backupPath : 'none');
  console.log('integrity  :', check.ok ? 'OK (' + check.fileCount + ' files)' : 'FAILED');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.action === 'help') {
    printHelp();
    return;
  }

  const asarPath = findTetrioAsar(opts.customPath);
  if (opts.action === 'status') {
    showStatus(asarPath);
  } else if (opts.action === 'uninstall') {
    uninstallMod(asarPath);
  } else {
    installMod(asarPath);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('[twfoxtetrio] Error:', err && err.message ? err.message : err);
    process.exitCode = 1;
  }
}

module.exports = {
  findTetrioAsar,
  installMod,
  uninstallMod,
  showStatus
};
