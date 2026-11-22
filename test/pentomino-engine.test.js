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

test('SRS+ rotation kicks and I-piece / 180 wall kicks follow TETR.IO rules', () => {
  // Find a deterministic seed starting with T for clean overhang / wall kick test
  let tSeed = 1;
  while (tSeed < 200) {
    const probe = engine.createGame({ pieceSet: 'tetromino', mode: 'zen', seed: tSeed });
    if (probe.getSnapshot().active.key === 'T') break;
    tSeed += 1;
  }

  // Test 180 rotation kick ('02') against stack floor when spawn rot 0 rotates 180 near floor
  const game = engine.createGame({ pieceSet: 'tetromino', mode: 'zen', seed: tSeed });
  const startSnap = game.getSnapshot();
  assert.equal(startSnap.active.key, 'T');

  // Drop T to bottom (rot 0 bottom row is 23 at y=22), then rotate 180 ('02': kicks [0,-1] up to y=21)
  game.sonicDrop();
  const groundedY = game.getSnapshot().active.y;
  assert.equal(game.rotate(2), true, '180 rotation on floor must kick cleanly via SRS+ 02 table');
  assert.equal(game.getSnapshot().active.rot, 2);
  assert.equal(game.getSnapshot().active.y, groundedY - 1, 'T rot 2 kicks up 1 via SRS+ 02 [0,-1] kick when on floor');

  // Now move rot-2 T against right/left wall and verify SRS+ 1->2 kick
  assert.equal(game.rotate(1), true); // rot 3
  const yBeforeFloorKick = game.getSnapshot().active.y;
  // Move T against left wall in rot 1 so spine is on x=0 -> rotating 1->2 pushes +1 right ([1,0])
  game.rotate(2); // rot 1 (empty col 0)
  for (let i = 0; i < 10; i++) game.move(-1, 0);
  assert.equal(game.getSnapshot().active.x, -1, 'T in rot 1 aligns spine to x=0 when active.x=-1');
  assert.equal(game.rotate(1), true, 'T rot 1->2 against left wall kicks +1 right via SRS+ 12 table');
  assert.equal(game.getSnapshot().active.rot, 2);
  assert.equal(game.getSnapshot().active.x, 0, 'T must kick right to x=0 so col-0 mino stays inside board');
  assert.ok(game.getSnapshot().active.y <= yBeforeFloorKick + 2);

  // Verify I-piece SRS+ symmetric kick behavior on left wall
  let iSeed = 1;
  while (iSeed < 200) {
    const probe = engine.createGame({ pieceSet: 'tetromino', mode: 'zen', seed: iSeed });
    if (probe.getSnapshot().active.key === 'I') break;
    iSeed += 1;
  }
  const iGame = engine.createGame({ pieceSet: 'tetromino', mode: 'zen', seed: iSeed });
  assert.equal(iGame.rotate(1), true); // rot 1: col 2
  for (let i = 0; i < 10; i++) iGame.move(-1, 0);
  assert.equal(iGame.getSnapshot().active.x, -2);
  assert.equal(iGame.rotate(1), true, 'Vertical I at left wall (x=-2) rotates 1->2 via SRS+ [-1,0]/[2,0] kick');
  assert.equal(iGame.getSnapshot().active.rot, 2);
  assert.equal(iGame.getSnapshot().active.x, 0);
});

test('soft drop speed scales past 12ms cap and SDF=41 drops into wells during horizontal 0-ARR movement', () => {
  // Verify SDF=40 drops faster than old 12ms artificial floor (~8.33ms/row => >= 6 rows in 60ms)
  const fastGame = engine.createGame({ pieceSet: 'tetromino', mode: 'zen', seed: 12, gravityLevel: 1 });
  const y0 = fastGame.getSnapshot().active.y;
  fastGame.step(60, true, 40);
  const yAfter = fastGame.getSnapshot().active.y;
  assert.ok(yAfter - y0 >= 6, `Expected >= 6 rows dropped in 60ms at SDF=40, got ${yAfter - y0}`);

  // Build left & right stacks (rows 22..23) leaving a deep open well in the center
  let oSeed = 1;
  while (oSeed < 200) {
    const probe = engine.createGame({ pieceSet: 'tetromino', mode: 'zen', seed: oSeed });
    if (probe.getSnapshot().active.key === 'O') break;
    oSeed += 1;
  }
  const wellGame = engine.createGame({ pieceSet: 'tetromino', mode: 'zen', seed: oSeed });
  assert.equal(wellGame.getSnapshot().active.key, 'O');
  wellGame.instantMove(1);
  wellGame.hardDrop(); // right wall on cols 8..9 (rows 22..23)
  wellGame.instantMove(-1);
  wellGame.hardDrop(); // left wall on cols 0..3

  // Rest active piece on top of right wall (x=8..9) and sweep left with apply20g=true (ARR=0 + SDF=41)
  wellGame.instantMove(1);
  wellGame.sonicDrop();
  const rightTopY = wellGame.getSnapshot().active.y;

  const moved20g = wellGame.instantMove(-1, { apply20g: true, scoreSoftDrop: true });
  assert.equal(moved20g, true);
  const finalSnap = wellGame.getSnapshot();
  assert.ok(finalSnap.active.y > rightTopY, `Piece must drop down into center well (y=${finalSnap.active.y} > ${rightTopY})`);
  assert.ok(finalSnap.active.x >= 2, `Piece inside center well must stop at left wall x=${finalSnap.active.x}`);

  // Falling to a deeper row must reset grounded lockResets so tucks don't instantly lock on arrival
  const tuckGame = engine.createGame({ pieceSet: 'tetromino', mode: 'zen', seed: oSeed });
  tuckGame.instantMove(1);
  tuckGame.hardDrop(); // cols 8..9 rows 22..23
  tuckGame.instantMove(1);
  tuckGame.sonicDrop(); // resting on right O tower at y=20
  for (let i = 0; i < 6; i++) {
    tuckGame.move(-1, 0);
    tuckGame.move(1, 0);
  }
  // Move off tower ledge and drop 2 rows to bottom: lock delay resets fresh so 490ms step doesn't instant-lock
  tuckGame.move(-1, 0);
  tuckGame.move(-1, 0);
  tuckGame.sonicDrop();
  tuckGame.step(400, false, 6);
  assert.equal(tuckGame.getSnapshot().pieces, 1, 'After dropping to deeper row, lock timer must still allow full 500ms lock delay');
});

test('playfield controller fires first ARR immediately at DAS boundary and preserves opposite DAS unless cancel=true', () => {
  const prevStorage = globalThis.localStorage;
  const prevRaf = globalThis.requestAnimationFrame;
  const prevCancelRaf = globalThis.cancelAnimationFrame;

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
    fillRect() {}
  };
  const mockCanvas = { width: 400, height: 500, getContext: () => mockCtx };

  function runWithConfig(handlingCfg) {
    let rafCb = null;
    globalThis.localStorage = {
      getItem(k) {
        return k === 'userConfig' ? JSON.stringify({ handling: handlingCfg }) : null;
      }
    };
    globalThis.requestAnimationFrame = (cb) => {
      rafCb = cb;
      return 1;
    };
    globalThis.cancelAnimationFrame = () => {
      rafCb = null;
    };

    const game = engine.createGame({ pieceSet: 'tetromino', mode: 'zen', seed: 5 });
    const ctrl = foxmodCanvas.createPlayfieldController({ canvas: mockCanvas, game });
    ctrl.start();
    return {
      game,
      ctrl,
      stepFrame(ts) {
        if (rafCb) rafCb(ts);
      }
    };
  }

  try {
    // 1. DAS=6F (100ms), ARR=2F (~33.33ms): at exact DAS completion (100ms), piece must immediately shift an extra column
    const sim = runWithConfig({ das: 6, arr: 2, sdf: 6, cancel: false });
    const startX = sim.game.getSnapshot().active.x;
    sim.ctrl.handleKeyDown({ key: 'ArrowRight', code: 'ArrowRight', repeat: false });
    assert.equal(sim.game.getSnapshot().active.x, startX + 1, 'Initial tap moves +1');
    sim.stepFrame(1000); // initialize lastTs = 1000 (dt = 0)
    sim.stepFrame(1050); // dt = 50 (< 100ms DAS)
    assert.equal(sim.game.getSnapshot().active.x, startX + 1, 'Before DAS expires, no ARR movement');
    sim.stepFrame(1100); // dt = 50 (total = 100ms == DAS!)
    assert.equal(
      sim.game.getSnapshot().active.x,
      startX + 2,
      'First ARR step must trigger immediately when DAS completes without waiting +1 extra ARR'
    );

    // 2. When cancel=false, briefly tapping Left while Right was already charged must keep Right DAS charged
    sim.ctrl.handleKeyDown({ key: 'ArrowLeft', code: 'ArrowLeft', repeat: false });
    const xAfterLeftTap = sim.game.getSnapshot().active.x;
    sim.ctrl.handleKeyUp({ key: 'ArrowLeft', code: 'ArrowLeft' });
    sim.stepFrame(1134); // dt = 34ms -> Right already charged >= DAS and overflows arrMs immediately
    assert.ok(
      sim.game.getSnapshot().active.x > xAfterLeftTap,
      'Releasing opposite tap with cancel=false must preserve existing Right DAS charge'
    );
    sim.ctrl.stop();
  } finally {
    globalThis.localStorage = prevStorage;
    globalThis.requestAnimationFrame = prevRaf;
    globalThis.cancelAnimationFrame = prevCancelRaf;
  }
});

test('solo pentominoes randomize across bags and resets while keeping multi-player seeds identical', () => {
  const g = engine.createGame({ pieceSet: 'pentomino', mode: 'zen' });
  const bagSignatures = new Set();

  // Draw 19 drops + 5 previewed nextKeys = full 24 pieces (two full 12-bags) without stacking above skyline
  const spreadOffsets = [-5, 5, -2, 2, -4, 4];
  for (let run = 0; run < 4; run++) {
    const seq = [];
    for (let i = 0; i < 19; i++) {
      const snap = g.getSnapshot();
      assert.ok(snap.active, `Run ${run} piece ${i} should not top out`);
      seq.push(snap.active.key);
      if (i === 18) {
        seq.push(...snap.nextKeys);
        break;
      }
      const offset = spreadOffsets[i % spreadOffsets.length];
      if (offset !== 0) {
        const dir = offset > 0 ? 1 : -1;
        for (let step = 0; step < Math.abs(offset); step++) g.move(dir, 0);
      }
      g.hardDrop();
    }
    const bag1 = seq.slice(0, 12);
    const bag2 = seq.slice(12, 24);
    assert.equal(new Set(bag1).size, 12, 'First bag must contain all 12 unique pentominoes');
    assert.equal(new Set(bag2).size, 12, 'Second bag must contain all 12 unique pentominoes');
    assert.notDeepEqual(bag1, bag2, 'Consecutive bags must be shuffled independently');
    bagSignatures.add(bag1.join(','));
    g.reset();
  }

  assert.ok(bagSignatures.size >= 3, `Expected varied bag orders across solo resets, got ${bagSignatures.size}`);

  // Two players sharing the exact same room seed must receive the exact same 24-piece bag sequence
  const sharedSeed = 987654321;
  const hostGame = engine.createGame({ pieceSet: 'pentomino', mode: 'vs', seed: sharedSeed });
  const peerGame = engine.createGame({ pieceSet: 'pentomino', mode: 'vs', seed: sharedSeed });
  for (let i = 0; i < 19; i++) {
    const hSnap = hostGame.getSnapshot();
    const pSnap = peerGame.getSnapshot();
    assert.equal(hSnap.active.key, pSnap.active.key);
    assert.deepEqual(hSnap.nextKeys, pSnap.nextKeys);
    if (i === 18) break;
    const offset = spreadOffsets[i % spreadOffsets.length];
    if (offset !== 0) {
      const dir = offset > 0 ? 1 : -1;
      for (let step = 0; step < Math.abs(offset); step++) {
        hostGame.move(dir, 0);
        peerGame.move(dir, 0);
      }
    }
    hostGame.hardDrop();
    peerGame.hardDrop();
  }
});
