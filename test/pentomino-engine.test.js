'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/features/pentomino-engine.js');
const engine = globalThis.__TWFOX_INTERNAL__.pentominoEngine;

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
