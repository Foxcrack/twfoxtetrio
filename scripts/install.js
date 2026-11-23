'use strict';

const fs = require('fs');
const os = require('os');
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
    } else if (arg === '--locate') {
      opts.action = 'locate';
    } else if (arg === '--help' || arg === '-h') {
      opts.action = 'help';
    } else if ((arg === '--path' || arg === '-p') && i + 1 < argv.length) {
      opts.customPath = argv[++i];
    } else if (arg.startsWith('--path=')) {
      opts.customPath = arg.slice('--path='.length);
    } else if (!arg.startsWith('-') && !opts.customPath) {
      opts.customPath = arg;
    }
  }
  return opts;
}

function resolveAsarCandidate(candidate, fsImpl, pathImpl) {
  if (!candidate) return null;
  const f = fsImpl || fs;
  const p = pathImpl || path;
  const resolved = p.resolve(candidate);
  if (/\.appimage$/i.test(resolved)) {
    throw new Error(
      'AppImage archives are read-only SquashFS images. Extract it first with "' +
      p.basename(resolved) +
      ' --appimage-extract" and pass the extracted squashfs-root folder using --path.'
    );
  }
  if (!f.existsSync(resolved)) return null;

  const stat = f.statSync(resolved);
  if (stat.isFile()) {
    if (resolved.toLowerCase().endsWith('.asar')) {
      return resolved;
    }
    const targets = [resolved];
    try {
      if (typeof f.realpathSync === 'function') {
        const real = f.realpathSync(resolved);
        if (real && !targets.includes(real)) targets.push(real);
      }
    } catch (_) {}
    for (const target of targets) {
      const dir = p.dirname(target);
      const binChecks = [
        p.join(dir, 'resources', 'app.asar'),
        p.join(dir, 'app.asar'),
        p.join(dir, '..', 'lib', 'tetrio-desktop', 'resources', 'app.asar'),
        p.join(dir, '..', 'share', 'tetrio-desktop', 'resources', 'app.asar')
      ];
      for (const hit of binChecks) {
        if (f.existsSync(hit)) return hit;
      }
    }
    return null;
  }

  if (stat.isDirectory()) {
    const subpaths = [
      ['app.asar'],
      ['resources', 'app.asar'],
      ['Contents', 'Resources', 'app.asar'],
      ['opt', 'TETR.IO', 'resources', 'app.asar'],
      ['usr', 'lib', 'tetrio-desktop', 'resources', 'app.asar'],
      ['usr', 'share', 'tetrio-desktop', 'resources', 'app.asar'],
      ['files', 'tetrio', 'resources', 'app.asar'],
      ['files', 'resources', 'app.asar']
    ];
    for (const parts of subpaths) {
      const target = p.join(resolved, ...parts);
      if (f.existsSync(target)) return target;
    }
  }
  return null;
}

function getLinuxBinaryAsarCandidates(env, fsImpl, pathImpl) {
  const f = fsImpl || fs;
  const p = pathImpl || path;
  const e = env || {};
  const pathDirs = String(e.PATH || '')
    .split(p.delimiter || ':')
    .filter(Boolean);
  for (const fallbackDir of ['/usr/bin', '/usr/local/bin']) {
    if (!pathDirs.includes(fallbackDir)) pathDirs.push(fallbackDir);
  }

  const candidates = [];
  const binNames = ['tetrio-desktop', 'tetrio', 'TETR.IO'];
  for (const dir of pathDirs) {
    for (const binName of binNames) {
      const binPath = p.join(dir, binName);
      if (!f.existsSync(binPath)) continue;
      candidates.push(binPath);
      try {
        const stat = f.statSync(binPath);
        if (stat.isFile() && stat.size > 0 && stat.size <= 4096) {
          const buf = f.readFileSync(binPath);
          const isElf = buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46;
          if (!isElf) {
            const text = buf.toString('utf8');
            const matches = text.match(/\/[^\s"'`;]+?(?:tetrio-desktop|TETR\.IO|app\.asar)/g) || [];
            for (const m of matches) {
              candidates.push(m);
            }
          }
        }
      } catch (_) {}
    }
  }
  return candidates;
}

function getTetrioAsarCandidates(opts) {
  const o = opts || {};
  const platform = o.platform || process.platform;
  const env = o.env || process.env;
  const homeDir = o.homeDir || (typeof os.homedir === 'function' ? os.homedir() : env.HOME || '');
  const f = o.fs || fs;
  const p = o.pathImpl || path;
  const candidates = [];

  if (env && env.TETRIO_PATH) {
    candidates.push(env.TETRIO_PATH);
  }

  if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA || p.join(env.USERPROFILE || homeDir || '', 'AppData', 'Local');
    candidates.push(p.join(localAppData, 'Programs', 'tetrio-desktop', 'resources', 'app.asar'));
    candidates.push(p.join(env.PROGRAMFILES || 'C:\\Program Files', 'TETR.IO', 'resources', 'app.asar'));
  } else if (platform === 'darwin') {
    candidates.push('/Applications/TETR.IO.app/Contents/Resources/app.asar');
    if (homeDir) {
      candidates.push(p.join(homeDir, 'Applications', 'TETR.IO.app', 'Contents', 'Resources', 'app.asar'));
    }
  } else {
    const xdgData = env.XDG_DATA_HOME || (homeDir ? p.join(homeDir, '.local', 'share') : '');
    candidates.push('/opt/TETR.IO/resources/app.asar');
    candidates.push('/opt/tetrio-desktop/resources/app.asar');
    candidates.push('/usr/lib/tetrio-desktop/resources/app.asar');
    candidates.push('/usr/lib64/tetrio-desktop/resources/app.asar');
    candidates.push('/usr/share/tetrio-desktop/resources/app.asar');
    candidates.push('/var/lib/flatpak/app/io.tetr.TETR.IO/current/active/files/tetrio/resources/app.asar');
    candidates.push('/var/lib/flatpak/app/io.tetr.TETR.IO/current/active/files/resources/app.asar');
    candidates.push('/snap/tetrio-desktop/current/resources/app.asar');
    if (xdgData) {
      candidates.push(p.join(xdgData, 'tetrio-desktop', 'resources', 'app.asar'));
      candidates.push(p.join(xdgData, 'TETR.IO', 'resources', 'app.asar'));
      candidates.push(p.join(xdgData, 'flatpak', 'app', 'io.tetr.TETR.IO', 'current', 'active', 'files', 'tetrio', 'resources', 'app.asar'));
      candidates.push(p.join(xdgData, 'flatpak', 'app', 'io.tetr.TETR.IO', 'current', 'active', 'files', 'resources', 'app.asar'));
    }
    if (homeDir) {
      candidates.push(p.join(homeDir, 'Applications', 'TETR.IO', 'resources', 'app.asar'));
      candidates.push(p.join(homeDir, 'Applications', 'tetrio-desktop', 'resources', 'app.asar'));
      candidates.push(p.join(homeDir, '.local', 'opt', 'TETR.IO', 'resources', 'app.asar'));
      candidates.push(p.join(homeDir, 'TETR.IO', 'resources', 'app.asar'));
      candidates.push(p.join(homeDir, 'tetrio-desktop', 'resources', 'app.asar'));
    }
    for (const binCandidate of getLinuxBinaryAsarCandidates(env, f, p)) {
      candidates.push(binCandidate);
    }
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function findTetrioAsar(customPath, opts) {
  const o = opts || {};
  const f = o.fs || fs;
  const p = o.pathImpl || path;
  const platform = o.platform || process.platform;

  if (customPath) {
    const found = resolveAsarCandidate(customPath, f, p);
    if (!found) {
      throw new Error('Could not find app.asar at: ' + customPath);
    }
    return found;
  }

  const candidates = getTetrioAsarCandidates(o);
  for (const candidate of candidates) {
    const found = resolveAsarCandidate(candidate, f, p);
    if (found) return found;
  }

  if (platform === 'linux') {
    throw new Error(
      'Could not locate TETR.IO Desktop app.asar automatically on Linux. Pass --path "/path/to/tetrio-desktop" (or run: bash install.sh --path "/path/to/tetrio-desktop").'
    );
  }

  throw new Error(
    'Could not locate TETR.IO Desktop app.asar automatically. Pass --path "C:\\Path\\To\\tetrio-desktop".'
  );
}

function parseLinuxRunningProcesses(psOutput, selfPid) {
  const lines = String(psOutput || '').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(\d+)\s+(\S+)\s*(.*)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    if (selfPid && pid === selfPid) continue;
    const comm = match[2].toLowerCase();
    const args = (match[3] || '').toLowerCase();
    if (
      args.includes('install.js') ||
      args.includes('install.sh') ||
      args.includes('uninstall.sh')
    ) {
      continue;
    }
    if (
      comm === 'tetrio-desktop' ||
      comm === 'tetr.io' ||
      /(?:^|\/)(?:tetrio-desktop|tetr\.io)(?:\s|$)/.test(args) ||
      args.includes('/opt/tetr.io/') ||
      args.includes('/lib/tetrio-desktop/')
    ) {
      return true;
    }
  }
  return false;
}

function isTetrioRunning() {
  if (process.platform === 'win32') {
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
  if (process.platform === 'linux' || process.platform === 'darwin') {
    try {
      const out = cp.execSync('ps -eo pid=,comm=,args=', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      return parseLinuxRunningProcesses(out, process.pid);
    } catch (_) {
      return false;
    }
  }
  return false;
}

function preserveReadableMode(targetPath, origMode) {
  if (process.platform === 'win32') return;
  try {
    const mode = typeof origMode === 'number' ? ((origMode & 0o777) | 0o644) : 0o644;
    fs.chmodSync(targetPath, mode);
  } catch (_) {}
}

function rethrowFriendlyFsError(err, asarPath, action) {
  if (err && (err.code === 'EACCES' || err.code === 'EPERM') && process.platform !== 'win32') {
    throw new Error(
      'Permission denied modifying ' + asarPath + '. Run with sudo: sudo bash ' +
      (action === 'uninstall' ? 'uninstall.sh' : 'install.sh') +
      ' (or: sudo "' + process.execPath + '" scripts/install.js' + (action === 'uninstall' ? ' --uninstall' : '') + ')'
    );
  }
  if (err && err.code === 'EROFS') {
    throw new Error(
      'Target filesystem is read-only for ' + asarPath + ' (e.g. Snap/AppImage SquashFS). Extract the package to a writable folder and pass --path.'
    );
  }
  throw err;
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
    'twfoxtetrio installer (Windows / Linux / macOS)',
    '',
    'Usage:',
    '  node scripts/install.js [--path <tetrio-dir-or-asar>]',
    '  node scripts/install.js --uninstall [--path <tetrio-dir-or-asar>]',
    '  node scripts/install.js --status [--path <tetrio-dir-or-asar>]',
    '  node scripts/install.js --locate [--path <tetrio-dir-or-asar>]'
  ].join('\n'));
}

const MAIN_MOD_START_MARKER = '// === TWFOXTETRIO MAIN MOD START ===';
const MAIN_MOD_END_MARKER = '// === TWFOXTETRIO MAIN MOD END ===';

function buildMainSnippet() {
  return [
    MAIN_MOD_START_MARKER,
    '(function(){',
    '  try {',
    "    if (global.__TWFOX_MAIN_IPC_READY__) return;",
    '    global.__TWFOX_MAIN_IPC_READY__ = true;',
    "    const { ipcMain } = require('electron');",
    "    const https = require('https');",
    "    ipcMain.handle('twfoxtetrio-fetch', (_ev, targetUrl) => new Promise((resolve, reject) => {",
    '      try {',
    "        const parsed = new URL(String(targetUrl || ''));",
    "        if (parsed.protocol !== 'https:' || parsed.hostname !== 'you.have.fail') {",
    "          reject(new Error('Disallowed domain for twfoxtetrio-fetch'));",
    '          return;',
    '        }',
    '        const fetchUrl = (u, depth) => {',
    "          if (depth > 5) return reject(new Error('Too many redirects'));",
    "          const p = new URL(u);",
    "          if (p.protocol !== 'https:') return reject(new Error('Disallowed redirect protocol'));",
    "          const req = https.get(p.toString(), { headers: { 'User-Agent': 'twfoxtetrio-desktop' } }, (res) => {",
    '            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {',
    '              res.resume();',
    '              fetchUrl(new URL(res.headers.location, p).toString(), depth + 1);',
    '              return;',
    '            }',
    '            const chunks = [];',
    "            res.on('data', (c) => chunks.push(c));",
    "            res.on('end', () => {",
    '              const buf = Buffer.concat(chunks);',
    '              resolve({',
    '                ok: res.statusCode >= 200 && res.statusCode < 300,',
    '                status: res.statusCode || 0,',
    "                contentType: String(res.headers['content-type'] || 'application/octet-stream'),",
    "                base64: buf.toString('base64')",
    '              });',
    '            });',
    '          });',
    "          req.on('error', reject);",
    "          req.setTimeout(30000, () => { req.destroy(new Error('Request timeout')); });",
    '        };',
    '        fetchUrl(parsed.toString(), 0);',
    '      } catch (err) {',
    '        reject(err);',
    '      }',
    '    }));',
    '  } catch (_) {}',
    '})();',
    MAIN_MOD_END_MARKER
  ].join('\n');
}

function stripMainMod(content) {
  const startIdx = content.indexOf(MAIN_MOD_START_MARKER);
  const endIdx = content.indexOf(MAIN_MOD_END_MARKER);
  if (startIdx === -1 || endIdx === -1) return content;
  const before = content.slice(0, startIdx).replace(/\n+$/, '');
  const after = content.slice(endIdx + MAIN_MOD_END_MARKER.length).replace(/^\n+/, '');
  return before + (after ? '\n' + after : '\n');
}

function injectModIntoMain(baseMain) {
  const cleaned = stripMainMod(baseMain);
  return cleaned.replace(/\s*$/, '') + '\n\n' + buildMainSnippet() + '\n';
}

function installMod(asarPath) {
  if (isTetrioRunning()) {
    throw new Error('TETR.IO Desktop is currently running. Please close TETR.IO Desktop before installing the mod.');
  }

  const backupPath = asarPath + '.bak';
  const tempPath = asarPath + '.tmp';
  const origMode = fs.statSync(asarPath).mode;

  try {
    const currentPreload = readAsarFile(asarPath, 'preload.js').toString('utf8');
    const alreadyPatched = hasModSnippet(currentPreload);

    let sourceAsar = asarPath;
    if (!alreadyPatched) {
      fs.copyFileSync(asarPath, backupPath);
      preserveReadableMode(backupPath, origMode);
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
    const replacements = {
      'preload.js': Buffer.from(nextPreload, 'utf8')
    };
    try {
      const baseMain = readAsarFile(sourceAsar, 'main.js').toString('utf8');
      if (baseMain) {
        replacements['main.js'] = Buffer.from(injectModIntoMain(baseMain), 'utf8');
      }
    } catch (_) {}

    writePatchedAsar(
      sourceAsar,
      replacements,
      tempPath
    );

    const check = verifyAsar(tempPath);
    if (!check.ok) {
      throw new Error('Verification of patched app.asar failed');
    }

    replaceFileSafe(tempPath, asarPath);
    preserveReadableMode(asarPath, origMode);
    const finalCheck = verifyAsar(asarPath);
    console.log('[twfoxtetrio] Mod installed cleanly into: ' + asarPath);
    console.log('[twfoxtetrio] Verified ' + finalCheck.fileCount + ' files (' + finalCheck.totalPackedBytes + ' packed bytes).');
    console.log('[twfoxtetrio] Launch TETR.IO Desktop and play BLITZ or 40 LINES to see the live HUD tracker!');
  } catch (err) {
    rethrowFriendlyFsError(err, asarPath, 'install');
  } finally {
    cleanupFile(tempPath);
  }
}

function uninstallMod(asarPath) {
  if (isTetrioRunning()) {
    throw new Error('TETR.IO Desktop is currently running. Please close TETR.IO Desktop before uninstalling the mod.');
  }

  const backupPath = asarPath + '.bak';
  const tempPath = asarPath + '.tmp';
  const origMode = fs.statSync(asarPath).mode;

  try {
    if (fs.existsSync(backupPath)) {
      const bakPreload = readAsarFile(backupPath, 'preload.js').toString('utf8');
      if (!hasModSnippet(bakPreload)) {
        verifyAsar(backupPath);
        fs.copyFileSync(backupPath, tempPath);
        replaceFileSafe(tempPath, asarPath);
        preserveReadableMode(asarPath, origMode);
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
    preserveReadableMode(asarPath, origMode);
    verifyAsar(asarPath);
    console.log('[twfoxtetrio] Mod removed cleanly from: ' + asarPath);
  } catch (err) {
    rethrowFriendlyFsError(err, asarPath, 'uninstall');
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
  if (opts.action === 'locate') {
    console.log(asarPath);
    return;
  }
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
  parseArgs,
  resolveAsarCandidate,
  getTetrioAsarCandidates,
  findTetrioAsar,
  parseLinuxRunningProcesses,
  installMod,
  uninstallMod,
  showStatus,
  injectModIntoMain,
  stripMainMod
};
