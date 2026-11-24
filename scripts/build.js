'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));

const MOD_START_MARKER = '// === TWFOXTETRIO MOD START ===';
const MOD_END_MARKER = '// === TWFOXTETRIO MOD END ===';

const SOURCE_FILES = [
  'src/features/loading-credit.js',
  'src/features/custom-assets-logic.js',
  'src/features/custom-assets.js',
  'src/features/blitz-logic.js',
  'src/features/forty-lines-logic.js',
  'src/features/quickplay-logic.js',
  'src/features/multiplayer-logic.js',
  'src/features/zen-qp-logic.js',
  'src/features/race-logic.js',
  'src/features/solo-lobby-logic.js',
  'src/features/fox-paw-logic.js',
  'src/features/fox-invite-logic.js',
  'src/features/mod-updater-logic.js',
  'src/features/i18n-logic.js',
  'src/core/top-hud.js',
  'src/core/runtime.js',
  'src/features/blitz-pb-tracker.js',
  'src/features/forty-lines-pb-tracker.js',
  'src/features/quickplay-pb-tracker.js',
  'src/features/multiplayer-vs-leaderboard.js',
  'src/features/pentomino-engine.js',
  'src/features/p2p-room.js',
  'src/features/foxmod-canvas.js',
  'src/features/foxmod-menu.js',
  'src/features/zen-qp-mods.js',
  'src/features/zen-race.js',
  'src/features/fox-paw-badge.js',
  'src/features/mod-updater.js',
  'src/features/i18n-global.js'
];

/**
 * Concatenates all browser-side mod modules into one self-contained snippet
 * suitable for Electron's sandboxed preload.js (no runtime require() calls).
 *
 * @returns {string}
 */
function buildModSnippet() {
  const chunks = SOURCE_FILES.map((relPath) => {
    const absPath = path.join(ROOT_DIR, relPath);
    const code = fs.readFileSync(absPath, 'utf8').trim();
    return '// --- ' + relPath + ' ---\n' + code;
  });

  return [
    MOD_START_MARKER,
    '// twfoxtetrio v' + PKG.version + ' | https://github.com/Foxcrack/twfoxtetrio',
    ';(function (module, exports) {',
    "  'use strict';",
    chunks.join('\n\n'),
    '})(undefined, undefined);',
    MOD_END_MARKER
  ].join('\n');
}

function hasModSnippet(preloadText) {
  return typeof preloadText === 'string' &&
    preloadText.includes(MOD_START_MARKER) &&
    preloadText.includes(MOD_END_MARKER);
}

function stripModSnippet(preloadText) {
  if (!hasModSnippet(preloadText)) {
    return preloadText;
  }
  const startIdx = preloadText.indexOf(MOD_START_MARKER);
  const endIdx = preloadText.lastIndexOf(MOD_END_MARKER);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return preloadText;
  }
  const before = preloadText.slice(0, startIdx).replace(/\s+$/, '');
  const after = preloadText.slice(endIdx + MOD_END_MARKER.length).replace(/^\s+/, '');
  if (!after) {
    return before ? before + '\n' : '';
  }
  return (before ? before + '\n\n' : '') + after;
}

function injectModIntoPreload(preloadText, modSnippet) {
  const clean = stripModSnippet(preloadText).replace(/\s+$/, '');
  const snippet = modSnippet || buildModSnippet();
  return (clean ? clean + '\n\n' : '') + snippet + '\n';
}

if (require.main === module) {
  const outDir = path.join(ROOT_DIR, 'dist');
  const outFile = path.join(outDir, 'twfoxtetrio-preload.js');
  fs.mkdirSync(outDir, { recursive: true });
  const snippet = buildModSnippet();
  fs.writeFileSync(outFile, snippet + '\n', 'utf8');
  console.log('[twfoxtetrio] Built bundle -> ' + outFile + ' (' + Buffer.byteLength(snippet, 'utf8') + ' bytes)');
}

module.exports = {
  MOD_START_MARKER,
  MOD_END_MARKER,
  SOURCE_FILES,
  buildModSnippet,
  hasModSnippet,
  stripModSnippet,
  injectModIntoPreload
};
