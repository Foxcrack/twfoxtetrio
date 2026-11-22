'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const soloLobbyLogic = require('../src/features/solo-lobby-logic.js');
require('../src/features/pentomino-engine.js');
require('../src/features/foxmod-canvas.js');

const pentominoEngine = globalThis.__TWFOX_INTERNAL__.pentominoEngine;
const foxmodCanvas = globalThis.__TWFOX_INTERNAL__.foxmodCanvas;

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  };
}

test('solo-lobby-logic tracks personal bests across 4Wide, Marathon, and Pentominoes submodes', () => {
  const storage = makeMemoryStorage();

  // 4Wide records higher score
  soloLobbyLogic.recordSoloResult('fourWide', {}, { score: 42500, lines: 38 }, storage);
  soloLobbyLogic.recordSoloResult('fourWide', {}, { score: 31000, lines: 50 }, storage);
  let pb4w = soloLobbyLogic.formatSoloPbDisplay('fourWide', {}, soloLobbyLogic.loadAllPbs(storage));
  assert.equal(pb4w.value, '42,500');
  assert.match(pb4w.subtitle, /50/);

  // Marathon tracks highest score + fastest completed 150L time
  soloLobbyLogic.recordSoloResult('marathon', {}, { score: 180000, lines: 110, completed: false }, storage);
  let pbMar = soloLobbyLogic.formatSoloPbDisplay('marathon', {}, soloLobbyLogic.loadAllPbs(storage));
  assert.equal(pbMar.value, '180,000');
  assert.match(pbMar.subtitle, /110 \/ 150/);

  soloLobbyLogic.recordSoloResult('marathon', {}, { score: 325000, lines: 150, timeMs: 145120, completed: true }, storage);
  soloLobbyLogic.recordSoloResult('marathon', {}, { score: 290000, lines: 150, timeMs: 132050, completed: true }, storage);
  pbMar = soloLobbyLogic.formatSoloPbDisplay('marathon', {}, soloLobbyLogic.loadAllPbs(storage));
  assert.equal(pbMar.value, '325,000');
  assert.match(pbMar.subtitle, /2:12\.050/);

  // Pentominoes keeps separate PBs per pieceSet + subMode; 40l picks fastest time
  soloLobbyLogic.recordSoloResult(
    'pentomino',
    { pieceSet: 'pentomino', subMode: '40l' },
    { score: 9000, lines: 40, timeMs: 65250, completed: true },
    storage
  );
  soloLobbyLogic.recordSoloResult(
    'pentomino',
    { pieceSet: 'pentomino', subMode: '40l' },
    { score: 8500, lines: 40, timeMs: 58100, completed: true },
    storage
  );
  const pbPent40 = soloLobbyLogic.formatSoloPbDisplay(
    'pentomino',
    { pieceSet: 'pentomino', subMode: '40l' },
    soloLobbyLogic.loadAllPbs(storage)
  );
  assert.equal(pbPent40.value, '0:58.100');

  const pbChaosBlitz = soloLobbyLogic.formatSoloPbDisplay(
    'pentomino',
    { pieceSet: 'chaos', subMode: 'blitz' },
    soloLobbyLogic.loadAllPbs(storage)
  );
  assert.equal(pbChaosBlitz.value, '0');
});

test('buildCustomLaunchConfig enables Stride fast timers, no_szo, and Pro Mode counters', () => {
  const { preset, options } = soloLobbyLogic.buildCustomLaunchConfig(
    { boardwidth: 4, mission: '4-WIDE' },
    { stride: true, pro: true, proAlert: true, proRetry: false, song: 'hyper-velocity' }
  );
  assert.equal(options.stride, true);
  assert.equal(preset.stride, true);
  assert.equal(preset.no_szo, true);
  assert.equal(preset.pro, true);
  assert.equal(preset.pro_alert, true);
  assert.equal(preset.pro_retry, false);
  assert.equal(preset.precountdown, 0);
  assert.equal(preset.prestart, 250);
  assert.equal(preset.countdown_interval, 450);
  assert.equal(preset.zoominto, 'fast');
  assert.equal(preset.slot_counter4, 'keys');
  assert.equal(preset.slot_counter5, 'finesse');
  assert.equal(preset.song, 'hyper-velocity');
});

test('pentominoEngine enforces noSzoFirst on initial bag when Stride no_szo is enabled', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const game = pentominoEngine.createGame({
      pieceSet: 'tetromino',
      mode: '40l',
      seed,
      noSzoFirst: true,
      strideMode: true,
      proMode: true
    });
    const snap = game.getSnapshot();
    assert.ok(snap.active && !['S', 'Z', 'O'].includes(snap.active.key), `seed ${seed} started with ${snap.active.key}`);
    assert.equal(snap.strideMode, true);
    assert.equal(snap.proMode, true);
  }
});

test('playfield controller Stride Mode triggers instant retry on tap while non-Stride requires holding R', () => {
  const rafQueue = [];
  globalThis.requestAnimationFrame = (fn) => {
    rafQueue.push(fn);
    return rafQueue.length;
  };
  globalThis.cancelAnimationFrame = () => {};

  const fakeCtx = new Proxy(
    {},
    {
      get(target, prop) {
        return typeof target[prop] === 'function' ? target[prop] : () => {};
      },
      set() {
        return true;
      }
    }
  );
  const fakeCanvas = { width: 640, height: 620, getContext: () => fakeCtx };

  // 1) Stride ON: single tap R resets immediately (pieces goes back to 0)
  const strideGame = pentominoEngine.createGame({ pieceSet: 'pentomino', mode: '40l', strideMode: true });
  strideGame.hardDrop();
  assert.equal(strideGame.getSnapshot().pieces, 1);

  const ctrlStride = foxmodCanvas.createPlayfieldController({ canvas: fakeCanvas, game: strideGame });
  ctrlStride.start();
  assert.equal(ctrlStride.handleKeyDown({ key: 'r', code: 'KeyR', repeat: false }), true);
  assert.equal(strideGame.getSnapshot().pieces, 0);
  ctrlStride.stop();

  // 2) Stride OFF: single tap R does NOT reset immediately; holding >= 320ms resets
  const normalGame = pentominoEngine.createGame({ pieceSet: 'pentomino', mode: '40l', strideMode: false });
  normalGame.hardDrop();
  assert.equal(normalGame.getSnapshot().pieces, 1);

  const ctrlNormal = foxmodCanvas.createPlayfieldController({ canvas: fakeCanvas, game: normalGame });
  ctrlNormal.start();
  ctrlNormal.handleKeyDown({ key: 'r', code: 'KeyR', repeat: false });
  assert.equal(normalGame.getSnapshot().pieces, 1);
  // Step animation loop past 320ms while R is still held
  let ts = 100;
  for (let i = 0; i < 8; i++) {
    const fn = rafQueue.pop();
    if (fn) {
      ts += 50;
      fn(ts);
    }
  }
  assert.equal(normalGame.getSnapshot().pieces, 0);
  ctrlNormal.stop();
});
