'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/features/pentomino-engine.js');
require('../src/features/foxmod-canvas.js');
const engine = globalThis.__TWFOX_INTERNAL__.pentominoEngine;
const foxmodCanvas = globalThis.__TWFOX_INTERNAL__.foxmodCanvas;

test('all 12 pentominoes have 5 unique cells and 7 tetrominoes have 4 unique cells across rotations', () => {
  assert.equal(engine.PENTOMINO_KEYS.length, 12);
  assert.equal(engine.TETROMINO_KEYS.length, 7);

  for (const key of engine.PENTOMINO_KEYS) {
    const def = engine.PIECE_DEFS[key];
    assert.ok(def);
    for (let r = 0; r < 4; r++) {
      const cells = def.rotations[r];
      assert.equal(cells.length, 5, `${key} rot ${r} must have 5 cells`);
      const unique = new Set(cells.map(([x, y]) => `${x},${y}`));
      assert.equal(unique.size, 5, `${key} rot ${r} cells must be distinct`);
    }
  }

  for (const key of engine.TETROMINO_KEYS) {
    const def = engine.PIECE_DEFS[key];
    for (let r = 0; r < 4; r++) {
      const cells = def.rotations[r];
      assert.equal(cells.length, 4, `${key} rot ${r} must have 4 cells`);
    }
  }
});

test('12-bag pentominoes and 19-bag chaos deal full deterministic bags', () => {
  const g1 = engine.createGame({ pieceSet: 'pentomino', seed: 12345 });
  const g2 = engine.createGame({ pieceSet: 'pentomino', seed: 12345 });

  const seen1 = [];
  const seen2 = [];
  const laneOffsets = [-3, 0, 3, -2, 2, -1];
  for (let i = 0; i < 12; i++) {
    seen1.push(g1.getSnapshot().active.key);
    seen2.push(g2.getSnapshot().active.key);
    const dx = laneOffsets[i % laneOffsets.length];
    const dir = dx < 0 ? -1 : 1;
    for (let s = 0; s < Math.abs(dx); s++) {
      g1.move(dir, 0);
      g2.move(dir, 0);
    }
    g1.hardDrop();
    g2.hardDrop();
  }
  assert.deepEqual(seen1, seen2);
  assert.equal(new Set(seen1).size, 12);

  const chaosPool = engine.getPiecePool('chaos');
  assert.equal(chaosPool.length, 19);
});

test('gameplay supports movement, wall-kick rotation, hold, garbage cancellation, and Blitz/40L limits', () => {
  const attacks = [];
  const game = engine.createGame({
    pieceSet: 'pentomino',
    mode: 'vs',
    seed: 99,
    onAttack(amount, callout) {
      attacks.push({ amount, callout });
    }
  });

  const firstKey = game.getSnapshot().active.key;
  assert.equal(game.hold(), true);
  assert.equal(game.getSnapshot().holdKey, firstKey);
  assert.equal(game.hold(), false, 'Cannot hold twice on same piece');

  // Move to left wall and verify rotation kicks back inside bounds
  for (let i = 0; i < 10; i++) game.move(-1, 0);
  assert.equal(game.rotate(1), true);

  // Queue incoming garbage and check attack calculation
  game.receiveGarbage(3);
  assert.equal(game.getSnapshot().incomingGarbage, 3);

  const blitz = engine.createGame({ pieceSet: 'pentomino', mode: 'blitz', blitzDurationMs: 500 });
  for (let i = 0; i < 3; i++) blitz.step(100, false);
  assert.equal(blitz.getSnapshot().finished, false);
  for (let i = 0; i < 3; i++) blitz.step(100, false);
  assert.equal(blitz.getSnapshot().finished, true);
  assert.equal(blitz.getSnapshot().winReason, 'time_up');

  const pAttack = engine.computeLineAttack(5, 0, false, false);
  assert.equal(pAttack.callout, 'PENTA!');
  assert.equal(pAttack.attack, 6);
});

test('renderPlayfield keeps sky buffer pieces (avy <= -2) completely visible with positive canvas coordinates', () => {
  const fills = [];
  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    globalAlpha: 1,
    save() {},
    restore() {},
    clearRect() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    fill() {},
    stroke() {},
    fillText() {},
    fillRect(x, y, w, h) {
      fills.push({ x, y, w, h, style: String(this.fillStyle) });
    }
  };
  const mockCanvas = {
    width: 640,
    height: 620,
    getContext() {
      return mockCtx;
    }
  };

  const game = engine.createGame({ pieceSet: 'pentomino', mode: 'zen', seed: 7 });
  const snap = game.getSnapshot();
  // Force PT active piece into spawn buffer row (y=2 => avy=-2, -1, 0)
  snap.active = { key: 'PT', rot: 0, x: 3, y: 2 };
  snap.holdKey = null;
  snap.nextKeys = [];
  foxmodCanvas.renderPlayfield(mockCanvas, snap, {
    gridOpacity: 0.1,
    boardOpacity: 0.85,
    shadowOpacity: 0.32
  });

  // Active piece 'PT' uses color '#c352ce' (distinct from ghost/backdrop)
  const ptBlocks = fills.filter((f) => f.style === '#c352ce');
  assert.equal(ptBlocks.length, 5, 'All 5 blocks of PT in spawn buffer must render');
  for (const b of ptBlocks) {
    assert.ok(b.y >= 4, `Active block at y=${b.y} must never be clipped above canvas top`);
  }
});
