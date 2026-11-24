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

function registerTwfoxMainIpc(deps) {
  const d = deps || {};
  const ipcMain = d.ipcMain;
  const app = d.app;
  const shell = d.shell;
  const https = d.https;
  const fs = d.fs;
  const path = d.path;
  if (!ipcMain || !https || !fs || !path) return;

  function isAllowedUrl(rawUrl) {
    try {
      const u = new URL(String(rawUrl || ''));
      if (u.protocol !== 'https:') return false;
      if (u.hostname === 'you.have.fail') return true;
      if (u.hostname === 'raw.githubusercontent.com' && u.pathname.startsWith('/Foxcrack/twfoxtetrio/')) {
        return true;
      }
      if (u.hostname === 'api.github.com' && u.pathname.startsWith('/repos/Foxcrack/twfoxtetrio/')) {
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  function fetchAllowedHttps(targetUrl, depth) {
    return new Promise((resolve, reject) => {
      try {
        const parsed = new URL(String(targetUrl || ''));
        if (!isAllowedUrl(parsed.toString())) {
          reject(new Error('Disallowed domain for twfoxtetrio-fetch'));
          return;
        }
        if ((depth || 0) > 5) {
          reject(new Error('Too many redirects'));
          return;
        }
        const req = https.get(
          parsed.toString(),
          { headers: { 'User-Agent': 'twfoxtetrio-desktop', 'Cache-Control': 'no-cache' } },
          (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              res.resume();
              const nextUrl = new URL(res.headers.location, parsed).toString();
              if (!isAllowedUrl(nextUrl)) {
                reject(new Error('Disallowed redirect domain'));
                return;
              }
              fetchAllowedHttps(nextUrl, (depth || 0) + 1).then(resolve, reject);
              return;
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
              resolve({
                ok: res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode || 0,
                contentType: String(res.headers['content-type'] || 'application/octet-stream'),
                buffer: Buffer.concat(chunks)
              });
            });
          }
        );
        req.on('error', reject);
        req.setTimeout(30000, () => {
          req.destroy(new Error('Request timeout'));
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  ipcMain.handle('twfoxtetrio-fetch', (_ev, targetUrl) =>
    fetchAllowedHttps(targetUrl, 0).then((r) => ({
      ok: r.ok,
      status: r.status,
      contentType: r.contentType,
      base64: r.buffer.toString('base64')
    }))
  );

  const ASSET_SUBFOLDERS = ['skins', 'boards', 'sfx', 'backgrounds'];
  const ASSET_MAX_BYTES = 40 * 1024 * 1024;
  const ASSET_ALLOWED_EXT = /\.(tpse|zip|png|jpe?g|gif|webp|svg|mp4|webm|mov|m4v|ogg|wav|mp3|flac|m4a|rsd)$/i;

  function resolveAssetsRoot() {
    if (d.assetsDir) return String(d.assetsDir);
    if (app && typeof app.getPath === 'function') {
      try {
        return path.join(app.getPath('userData'), 'foxmod-assets');
      } catch (_) {}
    }
    return '';
  }

  function isSafeSubpath(rootDir, targetPath) {
    if (!rootDir || !targetPath) return false;
    const rel = path.relative(path.resolve(rootDir), path.resolve(targetPath));
    return Boolean(rel && !rel.startsWith('..') && !path.isAbsolute(rel));
  }

  function sanitizeAssetName(rawName) {
    const base = path.basename(String(rawName || '')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
    if (!base || base === '.' || base === '..') return '';
    return base;
  }

  function ensureAssetsDirs() {
    const rootDir = resolveAssetsRoot();
    if (!rootDir) return '';
    fs.mkdirSync(rootDir, { recursive: true });
    for (const sub of ASSET_SUBFOLDERS) {
      fs.mkdirSync(path.join(rootDir, sub), { recursive: true });
    }
    const readmePath = path.join(rootDir, 'README.txt');
    if (!fs.existsSync(readmePath)) {
      const readmeText = [
        'FOXMOD (twfoxtetrio) Custom Assets Folder / Carpeta de Assets Personalizados',
        '========================================================================',
        '',
        'Put your custom files in each subfolder, then click "RESCAN FOLDER" (or reopen TETR.IO):',
        'Pon tus archivos personalizados en cada subcarpeta y pulsa "ESCANEAR CARPETA":',
        '',
        '- skins/        -> .tpse, .zip, .png, .gif, .svg (block skins & ghost skins)',
        '- boards/       -> .tpse, .zip, .png, .gif, .svg (board, queue, grid)',
        '- sfx/          -> .tpse, .zip, .rsd, .ogg/.wav/.mp3 (or a subfolder with move.ogg, rotate.ogg, etc.)',
        '- backgrounds/  -> .png, .jpg, .gif, .webp, .mp4, .webm (menu & gameplay backgrounds)',
        ''
      ].join('\r\n');
      try {
        fs.writeFileSync(readmePath, readmeText, 'utf8');
      } catch (_) {}
    }
    return rootDir;
  }

  ipcMain.handle('twfoxtetrio-assets-open-folder', async (_ev, opts) => {
    try {
      const rootDir = ensureAssetsDirs();
      if (!rootDir) {
        return { ok: false, error: 'Could not resolve userData directory' };
      }
      const sub = opts && typeof opts.subfolder === 'string' && ASSET_SUBFOLDERS.includes(opts.subfolder)
        ? opts.subfolder
        : '';
      const targetDir = sub ? path.join(rootDir, sub) : rootDir;
      const openFn = d.openPath || (shell && typeof shell.openPath === 'function' ? (p) => shell.openPath(p) : null);
      if (!openFn) {
        return { ok: false, path: targetDir, rootPath: rootDir, error: 'shell.openPath unavailable' };
      }
      const openErr = await openFn(targetDir);
      if (openErr) {
        return { ok: false, path: targetDir, rootPath: rootDir, error: String(openErr) };
      }
      return { ok: true, path: targetDir, rootPath: rootDir };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });

  ipcMain.handle('twfoxtetrio-assets-save-file', async (_ev, opts) => {
    try {
      const rootDir = ensureAssetsDirs();
      if (!rootDir) return { ok: false, error: 'Assets folder unavailable' };
      const sub = opts && typeof opts.subfolder === 'string' ? opts.subfolder : '';
      if (!ASSET_SUBFOLDERS.includes(sub)) {
        return { ok: false, error: 'Invalid asset subfolder' };
      }
      const safeName = sanitizeAssetName(opts && opts.fileName);
      if (!safeName || !ASSET_ALLOWED_EXT.test(safeName)) {
        return { ok: false, error: 'Invalid or unsupported filename' };
      }
      const buf = Buffer.from(String((opts && opts.base64) || ''), 'base64');
      if (buf.length === 0 || buf.length > ASSET_MAX_BYTES) {
        return { ok: false, error: 'File size out of bounds' };
      }
      const subDir = path.join(rootDir, sub);
      const targetPath = path.join(subDir, safeName);
      if (!isSafeSubpath(subDir, targetPath)) {
        return { ok: false, error: 'Path escapes assets directory' };
      }
      fs.writeFileSync(targetPath, buf);
      const st = fs.statSync(targetPath);
      return {
        ok: true,
        relPath: sub + '/' + safeName,
        fullPath: targetPath,
        rootPath: rootDir,
        mtimeMs: Math.round(st.mtimeMs || Date.now())
      };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });

  ipcMain.handle('twfoxtetrio-assets-delete-file', async (_ev, opts) => {
    try {
      const rootDir = ensureAssetsDirs();
      if (!rootDir) return { ok: false, error: 'Assets folder unavailable' };
      const rawRel = String((opts && opts.relPath) || '').replace(/\\/g, '/').replace(/^\/+/, '');
      const parts = rawRel.split('/').filter(Boolean);
      if (parts.length < 2 || !ASSET_SUBFOLDERS.includes(parts[0])) {
        return { ok: false, error: 'Invalid asset relative path' };
      }
      const subDir = path.join(rootDir, parts[0]);
      const target = path.join(subDir, ...parts.slice(1));
      if (!isSafeSubpath(subDir, target)) {
        return { ok: false, error: 'Unsafe path' };
      }
      if (fs.existsSync(target)) {
        const st = fs.statSync(target);
        if (st.isDirectory()) {
          fs.rmSync(target, { recursive: true, force: true });
        } else {
          fs.unlinkSync(target);
        }
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });

  ipcMain.handle('twfoxtetrio-assets-scan-folder', async () => {
    try {
      const rootDir = ensureAssetsDirs();
      if (!rootDir) return { ok: false, error: 'Assets folder unavailable', items: [] };
      const items = [];
      for (const sub of ASSET_SUBFOLDERS) {
        const subDir = path.join(rootDir, sub);
        if (!fs.existsSync(subDir)) continue;
        const dirents = fs.readdirSync(subDir);
        for (const entryName of dirents) {
          if (items.length >= 64) break;
          if (!entryName || entryName.startsWith('.') || /^readme\.txt$/i.test(entryName)) continue;
          const full = path.join(subDir, entryName);
          if (!isSafeSubpath(subDir, full)) continue;
          let st;
          try {
            st = fs.statSync(full);
          } catch (_) {
            continue;
          }
          if (st.isFile()) {
            if (!ASSET_ALLOWED_EXT.test(entryName) || st.size <= 0 || st.size > ASSET_MAX_BYTES) continue;
            const buf = fs.readFileSync(full);
            items.push({
              kind: 'file',
              subfolder: sub,
              relPath: sub + '/' + entryName,
              fileName: entryName,
              mtimeMs: Math.round(st.mtimeMs || 0),
              size: buf.length,
              base64: buf.toString('base64')
            });
          } else if (st.isDirectory()) {
            let subFiles;
            try {
              subFiles = fs.readdirSync(full);
            } catch (_) {
              continue;
            }
            const packed = [];
            let totalSize = 0;
            let maxMtime = Math.round(st.mtimeMs || 0);
            for (const fn of subFiles) {
              if (packed.length >= 120) break;
              if (!fn || fn.startsWith('.') || !ASSET_ALLOWED_EXT.test(fn)) continue;
              const fFull = path.join(full, fn);
              if (!isSafeSubpath(full, fFull)) continue;
              let fst;
              try {
                fst = fs.statSync(fFull);
              } catch (_) {
                continue;
              }
              if (!fst.isFile() || fst.size <= 0 || totalSize + fst.size > ASSET_MAX_BYTES) continue;
              totalSize += fst.size;
              maxMtime = Math.max(maxMtime, Math.round(fst.mtimeMs || 0));
              packed.push({
                fileName: fn,
                base64: fs.readFileSync(fFull).toString('base64')
              });
            }
            if (packed.length > 0) {
              items.push({
                kind: 'dir',
                subfolder: sub,
                relPath: sub + '/' + entryName,
                dirName: entryName,
                mtimeMs: maxMtime,
                size: totalSize,
                files: packed
              });
            }
          }
        }
      }
      return { ok: true, rootPath: rootDir, items };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err), items: [] };
    }
  });
}

function buildMainSnippet() {
  return [
    MAIN_MOD_START_MARKER,
    '(function(){',
    '  try {',
    '    if (global.__TWFOX_MAIN_IPC_READY__) return;',
    '    global.__TWFOX_MAIN_IPC_READY__ = true;',
    "    const { ipcMain, app, shell } = require('electron');",
    '    let origFs;',
    "    try { origFs = require('original-fs'); } catch (_) { origFs = require('fs'); }",
    '    ' + registerTwfoxMainIpc.toString(),
    '    registerTwfoxMainIpc({',
    '      ipcMain,',
    '      app,',
    '      shell,',
    "      https: require('https'),",
    '      fs: origFs,',
    "      path: require('path')",
    '    });',
    '  } catch (_) {}',
    '})();',
    MAIN_MOD_END_MARKER
  ].join('\n');
}

function stripMainMod(content) {
  const startIdx = content.indexOf(MAIN_MOD_START_MARKER);
  const endIdx = content.lastIndexOf(MAIN_MOD_END_MARKER);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return content;
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
    cleanupFile(asarPath + '.update');
    cleanupFile(asarPath + '.update.tmp');
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
    cleanupFile(asarPath + '.update');
    cleanupFile(asarPath + '.update.tmp');
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
  stripMainMod,
  registerTwfoxMainIpc
};
