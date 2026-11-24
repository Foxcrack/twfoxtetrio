(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.TWFOX_MOD_UPDATER_LOGIC = api;
    root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
    root.__TWFOX_INTERNAL__.modUpdaterLogic = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const GITHUB_OWNER = 'Foxcrack';
  const GITHUB_REPO = 'twfoxtetrio';
  const GITHUB_BRANCH = 'main';
  const RAW_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/`;
  const REMOTE_PKG_URL = `${RAW_BASE_URL}package.json`;
  const REMOTE_BUILD_URL = `${RAW_BASE_URL}scripts/build.js`;
  const REMOTE_COMMIT_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`;
  const RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
  const ZIP_DOWNLOAD_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/archive/refs/heads/${GITHUB_BRANCH}.zip`;
  const MOD_START_MARKER = '// === TWFOXTETRIO ' + 'MOD START ===';
  const MOD_END_MARKER = '// === TWFOXTETRIO ' + 'MOD END ===';
  const SAFE_SOURCE_PATH_RE = /^src\/[a-zA-Z0-9_/-]+\.js$/;

  function parseSemver(raw) {
    if (typeof raw !== 'string') return null;
    const clean = raw.trim().replace(/^v/i, '').split('-')[0].split('+')[0];
    const m = clean.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  function compareSemver(a, b) {
    const pa = parseSemver(a);
    const pb = parseSemver(b);
    if (!pa || !pb) return 0;
    for (let i = 0; i < 3; i++) {
      if (pa[i] > pb[i]) return 1;
      if (pa[i] < pb[i]) return -1;
    }
    return 0;
  }

  function isSafeSourcePath(relPath) {
    return typeof relPath === 'string' && SAFE_SOURCE_PATH_RE.test(relPath) && !relPath.includes('..');
  }

  function parseSourceFilesFromBuildJs(buildJsText) {
    if (typeof buildJsText !== 'string' || !buildJsText) {
      throw new Error('Empty build.js manifest');
    }
    const m = buildJsText.match(/const\s+SOURCE_FILES\s*=\s*(\[[\s\S]*?\])\s*;/);
    if (!m) {
      throw new Error('Could not locate SOURCE_FILES list in build.js');
    }
    const items = [];
    const strRe = /(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
    let match;
    while ((match = strRe.exec(m[1])) !== null) {
      const candidate = match[2].trim();
      if (!isSafeSourcePath(candidate)) {
        throw new Error('Unsafe source file path in manifest: ' + candidate);
      }
      items.push(candidate);
    }
    if (items.length === 0) {
      throw new Error('No source files listed in SOURCE_FILES');
    }
    return items;
  }

  function buildModSnippetFromParts(version, fileEntries) {
    const ver = String(version || '0.0.0').trim().replace(/^v/i, '');
    const chunks = [];
    for (let i = 0; i < fileEntries.length; i++) {
      const entry = fileEntries[i];
      if (!entry || !isSafeSourcePath(entry.path)) {
        throw new Error('Invalid source entry during bundle build');
      }
      const code = String(entry.content || '').trim();
      chunks.push('// --- ' + entry.path + ' ---\n' + code);
    }
    return [
      MOD_START_MARKER,
      '// twfoxtetrio v' + ver + ' | https://github.com/Foxcrack/twfoxtetrio',
      ';(function (module, exports) {',
      "  'use strict';",
      chunks.join('\n\n'),
      '})(undefined, undefined);',
      MOD_END_MARKER
    ].join('\n');
  }

  function isAllowedUpdateUrl(rawUrl) {
    const str = String(rawUrl || '').trim();
    if (!str) return false;
    if (typeof URL === 'function') {
      try {
        const u = new URL(str);
        if (u.protocol !== 'https:') return false;
        if (u.hostname === 'you.have.fail') return true;
        if (u.hostname === 'raw.githubusercontent.com' && u.pathname.startsWith(`/${GITHUB_OWNER}/${GITHUB_REPO}/`)) {
          return true;
        }
        if (u.hostname === 'api.github.com' && u.pathname.startsWith(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/`)) {
          return true;
        }
        return false;
      } catch (_) {
        return false;
      }
    }
    if (!str.startsWith('https://')) return false;
    const rest = str.slice(8);
    const slashIdx = rest.indexOf('/');
    const host = (slashIdx === -1 ? rest : rest.slice(0, slashIdx)).toLowerCase();
    const pathname = slashIdx === -1 ? '/' : rest.slice(slashIdx);
    if (!host || host.includes('@')) return false;
    if (host === 'you.have.fail') return true;
    if (host === 'raw.githubusercontent.com' && pathname.startsWith(`/${GITHUB_OWNER}/${GITHUB_REPO}/`)) return true;
    if (host === 'api.github.com' && pathname.startsWith(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/`)) return true;
    return false;
  }

  function buildManualUpdateCommand(platform) {
    if (platform === 'linux' || platform === 'darwin') {
      return `bash <(curl -fsSL ${RAW_BASE_URL}install.sh)`;
    }
    return 'git pull && install.bat';
  }

  return {
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_BRANCH,
    RAW_BASE_URL,
    REMOTE_PKG_URL,
    REMOTE_BUILD_URL,
    REMOTE_COMMIT_API_URL,
    RELEASES_URL,
    ZIP_DOWNLOAD_URL,
    parseSemver,
    compareSemver,
    isSafeSourcePath,
    parseSourceFilesFromBuildJs,
    buildModSnippetFromParts,
    isAllowedUpdateUrl,
    buildManualUpdateCommand
  };
});
