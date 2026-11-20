(function (root) {
  'use strict';

  const BOARD_WIDTH = 10;
  const VISIBLE_HEIGHT = 20;
  const BUFFER_HEIGHT = 4;
  const TOTAL_HEIGHT = VISIBLE_HEIGHT + BUFFER_HEIGHT;

  const PENTOMINO_KEYS = ['PF', 'PI', 'PL', 'PN', 'PP', 'PT', 'PU', 'PV', 'PW', 'PX', 'PY', 'PZ'];
  const TETROMINO_KEYS = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

  const RAW_PIECES = {
    // 12 Free Pentominoes mapped to native TETR.IO skin colors/slots
    PF: { size: 3, slot: 'z', color: '#ce5761', cells: [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]] },
    PI: { size: 5, slot: 'i', color: '#52ccac', cells: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]] },
    PL: { size: 4, slot: 'l', color: '#ce8542', cells: [[0, 1], [0, 2], [1, 2], [2, 2], [3, 2]] },
    PN: { size: 4, slot: 't', color: '#c352ce', cells: [[0, 1], [1, 1], [1, 2], [2, 2], [3, 2]] },
    PP: { size: 3, slot: 'o', color: '#cec652', cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]] },
    PT: { size: 3, slot: 't', color: '#c352ce', cells: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]] },
    PU: { size: 3, slot: 's', color: '#80cc52', cells: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
    PV: { size: 3, slot: 'j', color: '#6652ce', cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]] },
    PW: { size: 3, slot: 'l', color: '#ce8542', cells: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]] },
    PX: { size: 3, slot: 'o', color: '#cec652', cells: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] },
    PY: { size: 4, slot: 's', color: '#80cc52', cells: [[1, 1], [0, 2], [1, 2], [2, 2], [3, 2]] },
    PZ: { size: 3, slot: 'z', color: '#ce5761', cells: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]] },
    // 7 Standard Tetrominoes
    I: { size: 4, slot: 'i', color: '#52ccac', cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    J: { size: 3, slot: 'j', color: '#6652ce', cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    L: { size: 3, slot: 'l', color: '#ce8542', cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
    O: { size: 2, slot: 'o', color: '#cec652', cells: [[0, 0], [1, 0], [0, 1], [1, 1]], noRotate: true },
    S: { size: 3, slot: 's', color: '#80cc52', cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    T: { size: 3, slot: 't', color: '#c352ce', cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    Z: { size: 3, slot: 'z', color: '#ce5761', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] }
  };

  function rotateCellsCw(cells, size) {
    return cells.map(([x, y]) => [size - 1 - y, x]);
  }

  const PIECE_DEFS = {};
  for (const [key, spec] of Object.entries(RAW_PIECES)) {
    const rotations = [spec.cells.map(([x, y]) => [x, y])];
    for (let r = 1; r < 4; r++) {
      rotations.push(spec.noRotate ? rotations[0] : rotateCellsCw(rotations[r - 1], spec.size));
    }
    PIECE_DEFS[key] = {
      key,
      size: spec.size,
      slot: spec.slot,
      color: spec.color,
      noRotate: Boolean(spec.noRotate),
      rotations
    };
  }

  const GENERIC_KICKS = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [-1, -1],
    [1, -1],
    [-2, 0],
    [2, 0],
    [0, 1],
    [-1, 2],
    [1, 2],
    [0, -2],
    [-2, -1],
    [2, -1]
  ];

  /**
   * Deterministic Mulberry32 PRNG so Solo replays & P2P rooms share fair bags.
   */
  function createSeededRng(seed) {
    let state = (Number(seed) >>> 0) || 0x9e3779b9;
    return function nextFloat() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getPiecePool(pieceSet) {
    if (pieceSet === 'tetromino') return TETROMINO_KEYS.slice();
    if (pieceSet === 'chaos') return PENTOMINO_KEYS.concat(TETROMINO_KEYS);
    return PENTOMINO_KEYS.slice();
  }

  function shuffleArray(list, rng) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function createEmptyBoard() {
    const rows = [];
    for (let y = 0; y < TOTAL_HEIGHT; y++) {
      rows.push(new Array(BOARD_WIDTH).fill(null));
    }
    return rows;
  }

  function computeLineAttack(linesCleared, combo, b2bActive, isAllClear) {
    if (linesCleared <= 0) {
      return { attack: 0, callout: '', nextB2b: b2bActive };
    }

    const baseTable = [0, 0, 1, 2, 4, 6];
    let attack = baseTable[linesCleared] !== undefined ? baseTable[linesCleared] : linesCleared + 1;
    let callout = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD', 'PENTA!'][linesCleared] || `${linesCleared} LINES!`;

    const isDifficult = linesCleared >= 4;
    let nextB2b = isDifficult;
    if (isDifficult && b2bActive) {
      attack += 1;
      callout = 'B2B ' + callout;
    } else if (!isDifficult) {
      nextB2b = false;
    }

    if (combo > 0) {
      attack += Math.min(4, Math.floor((combo + 1) / 2));
    }

    if (isAllClear) {
      attack += 8;
      callout = 'ALL CLEAR!';
    }

    return { attack, callout, nextB2b };
  }

  /**
   * Creates a self-contained stacker game instance supporting 12 pentominoes,
   * 7 tetrominoes, or a 19-piece chaos bag, plus VS garbage cancellation.
   */
  function createGame(initialOptions) {
    const opts = Object.assign(
      {
        pieceSet: 'pentomino',
        mode: 'zen',
        seed: Date.now() >>> 0,
        gravityLevel: 1,
        garbageMultiplier: 1,
        blitzDurationMs: 120000,
        sprintLines: 40,
        onAttack: null,
        onTopOut: null
      },
      initialOptions || {}
    );

    let board = createEmptyBoard();
    let rng = createSeededRng(opts.seed);
    let bag = [];
    let active = null;
    let holdKey = null;
    let canHold = true;
    let score = 0;
    let lines = 0;
    let pieces = 0;
    let attackSent = 0;
    let combo = -1;
    let b2b = false;
    let elapsedMs = 0;
    let gravityAccMs = 0;
    let lockTimerMs = 0;
    let lockResets = 0;
    let lastCallout = '';
    let calloutTimerMs = 0;
    let finished = false;
    let toppedOut = false;
    let winReason = null;
    let incomingGarbage = [];

    function refillBag() {
      const pool = shuffleArray(getPiecePool(opts.pieceSet), rng);
      bag.push(...pool);
    }

    function ensureBag() {
      while (bag.length < 10) {
        refillBag();
      }
    }

    function getCells(key, rot, px, py) {
      const def = PIECE_DEFS[key];
      const matrix = def.rotations[((rot % 4) + 4) % 4];
      return matrix.map(([cx, cy]) => [px + cx, py + cy]);
    }

    function collides(key, rot, px, py) {
      const cells = getCells(key, rot, px, py);
      for (const [gx, gy] of cells) {
        if (gx < 0 || gx >= BOARD_WIDTH || gy >= TOTAL_HEIGHT) {
          return true;
        }
        if (gy >= 0 && board[gy][gx] !== null) {
          return true;
        }
      }
      return false;
    }

    function spawnPiece(explicitKey) {
      ensureBag();
      const key = explicitKey || bag.shift();
      const def = PIECE_DEFS[key];
      const startX = Math.floor((BOARD_WIDTH - def.size) / 2);
      let startY = BUFFER_HEIGHT - 2;
      while (startY >= 0 && collides(key, 0, startX, startY)) {
        startY--;
      }

      active = {
        key,
        rot: 0,
        x: startX,
        y: startY
      };
      gravityAccMs = 0;
      lockTimerMs = 0;
      lockResets = 0;

      if (collides(active.key, active.rot, active.x, active.y)) {
        active = null;
        toppedOut = true;
        finished = true;
        winReason = 'topout';
        if (typeof opts.onTopOut === 'function') {
          opts.onTopOut(getSnapshot());
        }
      }
    }

    function computeGhostY() {
      if (!active) return 0;
      let gy = active.y;
      while (!collides(active.key, active.rot, active.x, gy + 1)) {
        gy++;
      }
      return gy;
    }

    function addGarbageRows(count) {
      const safeCount = Math.max(0, Math.min(12, Math.floor(count)));
      for (let i = 0; i < safeCount; i++) {
        board.shift();
        const hole = Math.floor(rng() * BOARD_WIDTH);
        const row = new Array(BOARD_WIDTH).fill('gb');
        row[hole] = null;
        board.push(row);
      }
    }

    function flushIncomingGarbage(cap) {
      let applied = 0;
      while (incomingGarbage.length > 0 && applied < cap) {
        const chunk = incomingGarbage[0];
        const take = Math.min(chunk, cap - applied);
        addGarbageRows(take);
        applied += take;
        if (take >= chunk) {
          incomingGarbage.shift();
        } else {
          incomingGarbage[0] = chunk - take;
        }
      }
    }

    function cancelIncomingGarbage(power) {
      let remaining = power;
      while (remaining > 0 && incomingGarbage.length > 0) {
        if (incomingGarbage[0] <= remaining) {
          remaining -= incomingGarbage.shift();
        } else {
          incomingGarbage[0] -= remaining;
          remaining = 0;
        }
      }
      return remaining;
    }

    function lockActivePiece() {
      if (!active || finished) return;
      const def = PIECE_DEFS[active.key];
      for (const [gx, gy] of getCells(active.key, active.rot, active.x, active.y)) {
        if (gy >= 0 && gy < TOTAL_HEIGHT && gx >= 0 && gx < BOARD_WIDTH) {
          board[gy][gx] = def.slot;
        }
      }

      pieces += 1;
      let cleared = 0;
      for (let y = TOTAL_HEIGHT - 1; y >= 0; y--) {
        if (board[y].every((cell) => cell !== null)) {
          board.splice(y, 1);
          board.unshift(new Array(BOARD_WIDTH).fill(null));
          cleared += 1;
          y += 1;
        }
      }

      if (cleared > 0) {
        lines += cleared;
        combo += 1;
        const isAllClear = board.every((row) => row.every((cell) => cell === null));
        const result = computeLineAttack(cleared, combo, b2b, isAllClear);
        b2b = result.nextB2b;
        lastCallout = result.callout;
        calloutTimerMs = 1350;

        const basePoints = [0, 100, 300, 500, 800, 1400][cleared] || cleared * 300;
        score += basePoints + combo * 50 + (isAllClear ? 2000 : 0);

        const rawAttack = Math.round(result.attack * opts.garbageMultiplier);
        const netAttack = cancelIncomingGarbage(rawAttack);
        if (netAttack > 0) {
          attackSent += netAttack;
          if (typeof opts.onAttack === 'function') {
            opts.onAttack(netAttack, result.callout);
          }
        }
      } else {
        combo = -1;
        if (incomingGarbage.length > 0) {
          flushIncomingGarbage(8);
        }
      }

      canHold = true;

      if (opts.mode === '40l' && lines >= opts.sprintLines) {
        finished = true;
        winReason = '40l_complete';
        active = null;
        return;
      }

      spawnPiece();
    }

    function isGrounded() {
      return active ? collides(active.key, active.rot, active.x, active.y + 1) : false;
    }

    function resetLockDelay() {
      if (isGrounded() && lockResets < 15) {
        lockTimerMs = 0;
        lockResets += 1;
      }
    }

    function move(dx, dy) {
      if (!active || finished) return false;
      if (!collides(active.key, active.rot, active.x + dx, active.y + dy)) {
        active.x += dx;
        active.y += dy;
        if (dy === 0) {
          resetLockDelay();
        } else if (dy > 0) {
          score += 1;
          lockTimerMs = 0;
        }
        return true;
      }
      return false;
    }

    function rotate(delta) {
      if (!active || finished) return false;
      const def = PIECE_DEFS[active.key];
      if (def.noRotate) return true;
      const nextRot = ((active.rot + delta) % 4 + 4) % 4;
      for (const [kx, ky] of GENERIC_KICKS) {
        if (!collides(active.key, nextRot, active.x + kx, active.y - ky)) {
          active.rot = nextRot;
          active.x += kx;
          active.y -= ky;
          resetLockDelay();
          return true;
        }
      }
      return false;
    }

    function hardDrop() {
      if (!active || finished) return 0;
      const targetY = computeGhostY();
      const dropped = Math.max(0, targetY - active.y);
      active.y = targetY;
      score += dropped * 2;
      lockActivePiece();
      return dropped;
    }

    function hold() {
      if (!active || !canHold || finished) return false;
      const currentKey = active.key;
      canHold = false;
      if (holdKey === null) {
        holdKey = currentKey;
        spawnPiece();
      } else {
        const swapKey = holdKey;
        holdKey = currentKey;
        spawnPiece(swapKey);
      }
      return true;
    }

    function receiveGarbage(linesCount) {
      const safe = Math.floor(Number(linesCount) || 0);
      if (safe > 0 && !finished) {
        incomingGarbage.push(safe);
      }
    }

    function instantMove(dx) {
      let moved = false;
      while (move(dx, 0)) moved = true;
      return moved;
    }

    function sonicDrop() {
      if (!active || finished) return 0;
      let dropped = 0;
      while (move(0, 1)) dropped++;
      return dropped;
    }

    function step(dtMs, softDropHeld, sdfMultiplier) {
      if (finished) return;
      const delta = Math.max(0, Math.min(100, Number(dtMs) || 0));
      elapsedMs += delta;

      if (calloutTimerMs > 0) {
        calloutTimerMs = Math.max(0, calloutTimerMs - delta);
        if (calloutTimerMs === 0) lastCallout = '';
      }

      if (opts.mode === 'blitz' && elapsedMs >= opts.blitzDurationMs) {
        elapsedMs = opts.blitzDurationMs;
        finished = true;
        winReason = 'time_up';
        active = null;
        return;
      }

      if (!active) return;

      if (softDropHeld && Number(sdfMultiplier) >= 41) {
        sonicDrop();
      } else {
        const baseDropMs = Math.max(85, 800 - (opts.gravityLevel - 1) * 70);
        const sdf = Math.max(1, Number(sdfMultiplier) || 6);
        const intervalMs = softDropHeld ? Math.max(12, baseDropMs / sdf) : baseDropMs;
        gravityAccMs += delta;
        while (gravityAccMs >= intervalMs && active && !finished) {
          gravityAccMs -= intervalMs;
          if (!collides(active.key, active.rot, active.x, active.y + 1)) {
            active.y += 1;
            if (softDropHeld) score += 1;
            lockTimerMs = 0;
          }
        }
      }

      if (active && isGrounded()) {
        lockTimerMs += delta;
        if (lockTimerMs >= 500) {
          lockActivePiece();
        }
      }
    }

    function reset(nextOptions) {
      if (nextOptions && typeof nextOptions === 'object') {
        Object.assign(opts, nextOptions);
      }
      board = createEmptyBoard();
      rng = createSeededRng(opts.seed || (Date.now() >>> 0));
      bag = [];
      holdKey = null;
      canHold = true;
      score = 0;
      lines = 0;
      pieces = 0;
      attackSent = 0;
      combo = -1;
      b2b = false;
      elapsedMs = 0;
      gravityAccMs = 0;
      lockTimerMs = 0;
      lockResets = 0;
      lastCallout = '';
      calloutTimerMs = 0;
      finished = false;
      toppedOut = false;
      winReason = null;
      incomingGarbage = [];
      spawnPiece();
    }

    function getCompactVisibleBoard() {
      const cells = board.slice(BUFFER_HEIGHT).map((row) => row.slice());
      if (active) {
        const def = PIECE_DEFS[active.key];
        for (const [gx, gy] of getCells(active.key, active.rot, active.x, active.y)) {
          const vy = gy - BUFFER_HEIGHT;
          if (vy >= 0 && vy < VISIBLE_HEIGHT && gx >= 0 && gx < BOARD_WIDTH) {
            cells[vy][gx] = def.slot;
          }
        }
      }
      return cells;
    }

    function getSnapshot() {
      const seconds = Math.max(0.001, elapsedMs / 1000);
      const totalGarbagePending = incomingGarbage.reduce((sum, v) => sum + v, 0);
      return {
        pieceSet: opts.pieceSet,
        mode: opts.mode,
        width: BOARD_WIDTH,
        visibleHeight: VISIBLE_HEIGHT,
        bufferHeight: BUFFER_HEIGHT,
        board,
        active: active ? { ...active } : null,
        ghostY: computeGhostY(),
        holdKey,
        canHold,
        nextKeys: bag.slice(0, 5),
        score,
        lines,
        pieces,
        pps: pieces / seconds,
        attackSent,
        apm: (attackSent / seconds) * 60,
        vs: ((attackSent / seconds) * 100),
        combo,
        b2b,
        elapsedMs,
        remainingMs: opts.mode === 'blitz' ? Math.max(0, opts.blitzDurationMs - elapsedMs) : 0,
        sprintRemaining: opts.mode === '40l' ? Math.max(0, opts.sprintLines - lines) : 0,
        incomingGarbage: totalGarbagePending,
        lastCallout,
        finished,
        toppedOut,
        winReason,
        compactBoard: getCompactVisibleBoard()
      };
    }

    spawnPiece();

    return {
      move,
      instantMove,
      sonicDrop,
      rotate,
      hardDrop,
      hold,
      step,
      reset,
      receiveGarbage,
      getSnapshot
    };
  }

  root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
  root.__TWFOX_INTERNAL__.pentominoEngine = {
    BOARD_WIDTH,
    VISIBLE_HEIGHT,
    BUFFER_HEIGHT,
    PENTOMINO_KEYS,
    TETROMINO_KEYS,
    PIECE_DEFS,
    createSeededRng,
    getPiecePool,
    computeLineAttack,
    createGame
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));
