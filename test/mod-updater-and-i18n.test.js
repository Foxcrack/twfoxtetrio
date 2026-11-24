'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const updaterLogic = require('../src/features/mod-updater-logic');
const i18nLogic = require('../src/features/i18n-logic');

test('mod-updater-logic parses semver, compares versions, validates URLs, and builds bundle from manifest', () => {
  assert.deepEqual(updaterLogic.parseSemver('0.6.0'), [0, 6, 0]);
  assert.deepEqual(updaterLogic.parseSemver('v1.2.10'), [1, 2, 10]);
  assert.equal(updaterLogic.parseSemver('invalid'), null);

  assert.equal(updaterLogic.compareSemver('0.6.1', '0.6.0'), 1);
  assert.equal(updaterLogic.compareSemver('0.7.0', '0.6.9'), 1);
  assert.equal(updaterLogic.compareSemver('1.0.0', '0.99.99'), 1);
  assert.equal(updaterLogic.compareSemver('0.6.0', 'v0.6.0'), 0);
  assert.equal(updaterLogic.compareSemver('0.5.0', '0.6.0'), -1);

  assert.equal(updaterLogic.isAllowedUpdateUrl(updaterLogic.REMOTE_PKG_URL), true);
  assert.equal(updaterLogic.isAllowedUpdateUrl(updaterLogic.REMOTE_BUILD_URL), true);
  assert.equal(updaterLogic.isAllowedUpdateUrl(updaterLogic.REMOTE_COMMIT_API_URL), true);
  assert.equal(updaterLogic.isAllowedUpdateUrl('https://you.have.fail/tetrioplus/'), true);
  assert.equal(updaterLogic.isAllowedUpdateUrl('http://raw.githubusercontent.com/Foxcrack/twfoxtetrio/main/package.json'), false);
  assert.equal(updaterLogic.isAllowedUpdateUrl('https://raw.githubusercontent.com/EvilOrg/other/main/package.json'), false);
  assert.equal(updaterLogic.isAllowedUpdateUrl('https://evil.example/payload.js'), false);

  const sampleBuildJs = [
    "'use strict';",
    'const SOURCE_FILES = [',
    "  'src/core/runtime.js',",
    "  'src/features/i18n-logic.js'",
    '];'
  ].join('\n');
  assert.deepEqual(updaterLogic.parseSourceFilesFromBuildJs(sampleBuildJs), [
    'src/core/runtime.js',
    'src/features/i18n-logic.js'
  ]);

  assert.throws(
    () =>
      updaterLogic.parseSourceFilesFromBuildJs(
        "const SOURCE_FILES = ['../secret.js'];"
      ),
    /Unsafe source file path/
  );
  assert.throws(
    () =>
      updaterLogic.parseSourceFilesFromBuildJs(
        "const SOURCE_FILES = ['scripts/install.js'];"
      ),
    /Unsafe source file path/
  );

  const built = updaterLogic.buildModSnippetFromParts('0.7.0', [
    { path: 'src/core/runtime.js', content: 'console.log(1);' },
    { path: 'src/features/i18n-logic.js', content: 'console.log(2);' }
  ]);
  assert.ok(built.includes('// === TWFOXTETRIO MOD START ==='));
  assert.ok(built.includes('// twfoxtetrio v0.7.0 | https://github.com/Foxcrack/twfoxtetrio'));
  assert.ok(built.includes('// --- src/core/runtime.js ---'));
  assert.ok(built.includes('// === TWFOXTETRIO MOD END ==='));

  assert.match(updaterLogic.buildManualUpdateCommand('linux'), /install\.sh/);
  assert.match(updaterLogic.buildManualUpdateCommand('win32'), /install\.bat/);
});

test('i18n-logic translates TETR.IO & FOXMOD UI cleanly with case preservation while skipping codes/numbers', () => {
  assert.equal(i18nLogic.normalizeLocale('en'), 'en');
  assert.equal(i18nLogic.normalizeLocale('es'), 'es');
  assert.equal(i18nLogic.normalizeLocale('es-MX'), 'es');
  assert.equal(i18nLogic.normalizeLocale('unknown'), 'en');

  // English returns source untouched
  assert.equal(i18nLogic.translateText('MULTIPLAYER', 'en'), 'MULTIPLAYER');

  // Case preservation
  assert.equal(i18nLogic.translateText('MULTIPLAYER', 'es'), 'MULTIJUGADOR');
  assert.equal(i18nLogic.translateText('Multiplayer', 'es'), 'Multijugador');
  assert.equal(i18nLogic.translateText('40 LINES', 'es'), '40 LÍNEAS');
  assert.equal(i18nLogic.translateText('CONFIG', 'es'), 'AJUSTES');
  assert.equal(i18nLogic.translateText('FOXMOD UPDATE AVAILABLE', 'es'), 'ACTUALIZACIÓN FOXMOD DISPONIBLE');

  // Dynamic patterns preserve numbers & names
  assert.equal(i18nLogic.translateText('PLAYERS (6)', 'es'), 'JUGADORES (6)');
  assert.equal(i18nLogic.translateText('PLAYERS (', 'es'), 'JUGADORES (');
  assert.equal(i18nLogic.translateText('\u00a0IN QUEUE -\u00a0', 'es'), '\u00a0EN COLA -\u00a0');
  assert.equal(i18nLogic.translateText('\u00a0IN GAME', 'es'), '\u00a0EN PARTIDA');
  assert.equal(i18nLogic.translateText('NEED 2+ PLAYERS (1/2)', 'es'), 'FALTAN JUGADORES (1/2)');
  assert.equal(i18nLogic.translateText('WAIT 15S', 'es'), 'ESPERA 15S');
  assert.equal(i18nLogic.translateText('ROOM ONLINE · CODE #ABCD', 'es'), 'SALA EN LÍNEA · CÓDIGO #ABCD');
  assert.equal(i18nLogic.translateText('Playing QUICK PLAY', 'es'), 'Jugando PARTIDA RÁPIDA');
  assert.equal(
    i18nLogic.translateText('FOX sent invite to #ZX9K (PENTOMINOS VS)', 'es'),
    'FOX sent invite to #ZX9K (PENTOMINOS VS)'
  );
  assert.equal(
    i18nLogic.translateText('TWFOXCRACK invited you to #ZX9K (PENTOMINOS VS)', 'es'),
    'TWFOXCRACK te invitó a #ZX9K (PENTOMINOS VS)'
  );
  assert.equal(
    i18nLogic.translateText('New version v0.7.0 is available (installed: v0.6.0).', 'es'),
    'Hay una nueva versión v0.7.0 disponible (tienes v0.6.0).'
  );

  // Numbers, room codes, timers, and URLs are left untouched
  assert.equal(i18nLogic.translateText('123,450', 'es'), '123,450');
  assert.equal(i18nLogic.translateText('#W4YW', 'es'), '#W4YW');
  assert.equal(i18nLogic.translateText('0:45.320', 'es'), '0:45.320');
  assert.equal(i18nLogic.translateText('https://github.com/Foxcrack/twfoxtetrio', 'es'), 'https://github.com/Foxcrack/twfoxtetrio');
});
