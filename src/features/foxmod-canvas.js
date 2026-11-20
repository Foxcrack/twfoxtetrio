(function (root) {
  'use strict';

  const engine = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.pentominoEngine;
  if (!engine) {
    return;
  }

  const SKIN_COORDS = {
    z: [0, 0],
    l: [1, 0],
    o: [2, 0],
    s: [3, 0],
    i: [4, 0],
    j: [0, 1],
    t: [1, 1],
    d: [2, 1],
    gb: [3, 1],
    gbd: [4, 1]
  };

  const SKIN_COLORS = {
    z: '#ce5761',
    l: '#ce8542',
    o: '#cec652',
    s: '#80cc52',
    i: '#52ccac',
    j: '#6652ce',
    t: '#c352ce',
    d: '#464656',
    gb: '#5e5f6f',
    gbd: '#242427'
  };

  const DEFAULT_KEYBINDS = {
    guideline: {
      moveLeft: ['ARROWLEFT', 'LEFT', 'NUMPAD4'],
      moveRight: ['ARROWRIGHT', 'RIGHT', 'NUMPAD6'],
      softDrop: ['ARROWDOWN', 'DOWN', 'NUMPAD2'],
      hardDrop: ['SPACE', 'NUMPAD8'],
      rotateCCW: ['CONTROL', 'CONTROLLEFT', 'CONTROLRIGHT', 'Z', 'KEYZ', 'NUMPAD3', 'NUMPAD7'],
      rotateCW: ['ARROWUP', 'UP', 'X', 'KEYX', 'NUMPAD1', 'NUMPAD5', 'NUMPAD9'],
      rotate180: ['A', 'KEYA'],
      hold: ['SHIFT', 'SHIFTLEFT', 'SHIFTRIGHT', 'C', 'KEYC', 'NUMPAD0'],
      retry: ['R', 'KEYR']
    },
    wasd: {
      moveLeft: ['A', 'KEYA', 'NUMPAD4'],
      moveRight: ['D', 'KEYD', 'NUMPAD6'],
      softDrop: ['W', 'KEYW', 'NUMPAD8'],
      hardDrop: ['S', 'KEYS', 'NUMPAD5'],
      rotateCCW: ['ARROWLEFT', 'LEFT', 'NUMPAD7'],
      rotateCW: ['ARROWRIGHT', 'RIGHT', 'NUMPAD9'],
      rotate180: ['ARROWUP', 'UP', 'NUMPAD2'],
      hold: ['SHIFT', 'SHIFTLEFT', 'SHIFTRIGHT', 'NUMPADENTER'],
      retry: ['R', 'KEYR']
    }
  };

  let minoSpriteImg = null;
  let ghostSpriteImg = null;
  let spritesInitialized = false;

  function ensureSprites() {
    if (spritesInitialized || typeof root.Image !== 'function') return;
    spritesInitialized = true;
    try {
      const mImg = new root.Image();
      mImg.onload = function () {
        minoSpriteImg = mImg;
      };
      mImg.src = '/res/skins/minos/tetrio.png';

      const gImg = new root.Image();
      gImg.onload = function () {
        ghostSpriteImg = gImg;
      };
      gImg.src = '/res/skins/ghost/tetrio.png';
    } catch (_) {}
  }

  function normalizeBindingToken(raw) {
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
  }

  function buildEventKeyCandidates(ev) {
    const out = new Set();
    const rawCode = normalizeBindingToken(ev.code);
    const rawKey = normalizeBindingToken(ev.key);

    if (rawCode) out.add(rawCode);
    if (rawKey) out.add(rawKey);

    if (rawCode === 'SPACE' || rawKey === ' ') out.add('SPACE');
    if (rawCode === 'CONTROLLEFT' || rawCode === 'CONTROLRIGHT') out.add('CONTROL');
    if (rawCode === 'SHIFTLEFT' || rawCode === 'SHIFTRIGHT') out.add('SHIFT');
    if (rawCode.startsWith('ARROW')) out.add(rawCode.slice(5));
    if (/^KEY([A-Z])$/.test(rawCode)) out.add(rawCode.slice(3));
    if (/^[A-Z]$/.test(rawKey)) out.add('KEY' + rawKey);
    if (/^DIGIT([0-9])$/.test(rawCode)) out.add(rawCode.slice(5));
    if (/^[0-9]$/.test(rawKey)) out.add('DIGIT' + rawKey);

    return out;
  }

  /**
   * Reads the player's saved TETR.IO keybinds, DAS/ARR/SDF handling, and visual
   * opacity preferences directly from TETR.IO's `userConfig` in localStorage.
   */
  function readTetrioUserSettings() {
    const fallback = {
      binds: { ...DEFAULT_KEYBINDS.guideline },
      dasMs: (10 * 1000) / 60,
      arrMs: (2 * 1000) / 60,
      sdf: 6,
      gridOpacity: 0.1,
      boardOpacity: 0.85,
      shadowOpacity: 0.32
    };

    try {
      const raw = root.localStorage ? root.localStorage.getItem('userConfig') : null;
      if (!raw) return fallback;
      const cfg = JSON.parse(raw);
      if (!cfg || typeof cfg !== 'object') return fallback;

      if (cfg.controls) {
        const style = cfg.controls.style;
        if (style === 'wasd') {
          fallback.binds = { ...DEFAULT_KEYBINDS.wasd };
        } else if (style === 'custom' && cfg.controls.custom && typeof cfg.controls.custom === 'object') {
          const custom = cfg.controls.custom;
          for (const action of Object.keys(DEFAULT_KEYBINDS.guideline)) {
            const arr = custom[action];
            if (Array.isArray(arr) && arr.length > 0) {
              fallback.binds[action] = arr.map(normalizeBindingToken).filter(Boolean);
            } else {
              fallback.binds[action] = DEFAULT_KEYBINDS.guideline[action].slice();
            }
          }
        }
      }

      if (cfg.handling) {
        const dasFrames = Number(cfg.handling.das);
        const arrFrames = Number(cfg.handling.arr);
        const sdfVal = Number(cfg.handling.sdf);
        if (Number.isFinite(dasFrames) && dasFrames >= 0) {
          fallback.dasMs = (dasFrames * 1000) / 60;
        }
        if (Number.isFinite(arrFrames) && arrFrames >= 0) {
          fallback.arrMs = (arrFrames * 1000) / 60;
        }
        if (Number.isFinite(sdfVal) && sdfVal >= 1) {
          fallback.sdf = sdfVal;
        }
      }

      if (cfg.video) {
        if (Number.isFinite(Number(cfg.video.gridopacity))) {
          fallback.gridOpacity = Math.max(0, Math.min(1, Number(cfg.video.gridopacity)));
        }
        if (Number.isFinite(Number(cfg.video.boardopacity))) {
          fallback.boardOpacity = Math.max(0.2, Math.min(1, Number(cfg.video.boardopacity)));
        }
        if (Number.isFinite(Number(cfg.video.shadowopacity))) {
          fallback.shadowOpacity = Math.max(0.08, Math.min(0.8, Number(cfg.video.shadowopacity) * 2));
        }
      }
    } catch (_) {}

    return fallback;
  }

  function formatDuration(ms) {
    const safe = Math.max(0, Math.round(ms));
    const minutes = Math.floor(safe / 60000);
    const seconds = Math.floor((safe % 60000) / 1000);
    const millis = safe % 1000;
    return (
      minutes +
      ':' +
      String(seconds).padStart(2, '0') +
      '.' +
      String(millis).padStart(3, '0')
    );
  }

  function resolveSlotAndColor(slotOrColor) {
    if (!slotOrColor) return { slot: 'gb', color: SKIN_COLORS.gb };
    if (SKIN_COORDS[slotOrColor]) {
      return { slot: slotOrColor, color: SKIN_COLORS[slotOrColor] };
    }
    return { slot: 't', color: String(slotOrColor) };
  }

  function drawTetrioMino(ctx, px, py, size, slotOrColor, alpha, isGhost) {
    ensureSprites();
    const { slot, color } = resolveSlotAndColor(slotOrColor);

    ctx.save();
    if (alpha !== undefined && alpha !== 1) {
      ctx.globalAlpha = alpha;
    }

    if (isGhost && ghostSpriteImg && ghostSpriteImg.complete && ghostSpriteImg.naturalWidth > 0) {
      const ratio = Math.max(1, Math.round(ghostSpriteImg.naturalWidth / 256));
      const pad = 1 * ratio;
      const tile = 46 * ratio;
      ctx.drawImage(ghostSpriteImg, pad, pad, tile, tile, px, py, size, size);
      ctx.restore();
      return;
    }

    if (!isGhost && minoSpriteImg && minoSpriteImg.complete && minoSpriteImg.naturalWidth > 0) {
      const coord = SKIN_COORDS[slot] || SKIN_COORDS.gb;
      const ratio = Math.max(1, Math.round(minoSpriteImg.naturalWidth / 256));
      const pad = 1 * ratio;
      const tile = 46 * ratio;
      const stride = 48 * ratio;
      const sx = pad + coord[0] * stride;
      const sy = pad + coord[1] * stride;
      ctx.drawImage(minoSpriteImg, sx, sy, tile, tile, px, py, size, size);
      ctx.restore();
      return;
    }

    // Crisp flat fallback matching TETR.IO base palette when sprites aren't loaded yet
    ctx.fillStyle = isGhost ? 'rgba(255, 255, 255, 0.25)' : color;
    ctx.fillRect(px, py, size, size);
    ctx.restore();
  }

  function drawWingPiece(ctx, key, boxX, boxY, boxW, boxH, disabled) {
    if (!key || !engine.PIECE_DEFS[key]) return;
    const def = engine.PIECE_DEFS[key];
    const cells = def.rotations[0];
    let minX = 99;
    let minY = 99;
    let maxX = -99;
    let maxY = -99;
    for (const [cx, cy] of cells) {
      if (cx < minX) minX = cx;
      if (cy < minY) minY = cy;
      if (cx > maxX) maxX = cx;
      if (cy > maxY) maxY = cy;
    }
    const pieceW = maxX - minX + 1;
    const pieceH = maxY - minY + 1;
    const cellSize = Math.min((boxW - 14) / Math.max(3.5, pieceW), (boxH - 10) / Math.max(2.5, pieceH), 15);
    const ox = boxX + (boxW - pieceW * cellSize) / 2;
    const oy = boxY + (boxH - pieceH * cellSize) / 2;
    const slot = disabled ? 'd' : def.slot;
    for (const [cx, cy] of cells) {
      drawTetrioMino(
        ctx,
        ox + (cx - minX) * cellSize,
        oy + (cy - minY) * cellSize,
        cellSize,
        slot,
        disabled ? 0.65 : 1,
        false
      );
    }
  }

  function drawWingHeaderBox(ctx, x, y, w, h, title, alignRightCut) {
    const hdrH = 22;
    const cut = 14;
    ctx.save();
    ctx.beginPath();
    if (alignRightCut) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h - cut);
      ctx.lineTo(x + w - cut, y + h);
      ctx.lineTo(x, y + h);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + cut, y + h);
      ctx.lineTo(x, y + h - cut);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, hdrH);
    ctx.fillStyle = '#000000';
    ctx.font = '900 13px HUN, Segoe UI, sans-serif';
    ctx.textAlign = alignRightCut ? 'left' : 'right';
    ctx.fillText(title, alignRightCut ? x + 8 : x + w - 8, y + 16);
    ctx.restore();
  }

  /**
   * Renders the full TETR.IO-style playfield (HOLD left wing, NEXT right wing,
   * U-shaped crisp white well border, real TETR.IO sprite tiles, and left HUD counters).
   */
  function renderPlayfield(canvas, snap, visualOpts) {
    if (!canvas || typeof canvas.getContext !== 'function' || !snap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vOpts = visualOpts || readTetrioUserSettings();
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const wingW = 112;
    const cell = Math.floor(Math.min((w - wingW * 2 - 36) / snap.width, (h - 32) / snap.visibleHeight));
    const boardW = cell * snap.width;
    const boardH = cell * snap.visibleHeight;
    const boardX = Math.floor((w - boardW) / 2);
    const boardY = Math.floor((h - boardH) / 2);

    // Pure TETR.IO black well backdrop + subtle grid
    ctx.fillStyle = `rgba(0, 0, 0, ${vOpts.boardOpacity})`;
    ctx.fillRect(boardX, boardY, boardW, boardH);

    ctx.strokeStyle = `rgba(255, 255, 255, ${vOpts.gridOpacity})`;
    ctx.lineWidth = 1;
    for (let x = 1; x < snap.width; x++) {
      ctx.beginPath();
      ctx.moveTo(boardX + x * cell, boardY);
      ctx.lineTo(boardX + x * cell, boardY + boardH);
      ctx.stroke();
    }
    for (let y = 1; y < snap.visibleHeight; y++) {
      ctx.beginPath();
      ctx.moveTo(boardX, boardY + y * cell);
      ctx.lineTo(boardX + boardW, boardY + y * cell);
      ctx.stroke();
    }

    // HOLD left wing attached flush to board
    const holdX = boardX - wingW;
    drawWingHeaderBox(ctx, holdX, boardY, wingW, 88, 'HOLD', false);
    drawWingPiece(ctx, snap.holdKey, holdX + 4, boardY + 24, wingW - 8, 58, !snap.canHold);

    // NEXT right wing attached flush to board
    const nextX = boardX + boardW;
    drawWingHeaderBox(ctx, nextX, boardY, wingW, 316, 'NEXT', true);
    for (let i = 0; i < Math.min(5, snap.nextKeys.length); i++) {
      drawWingPiece(ctx, snap.nextKeys[i], nextX + 4, boardY + 26 + i * 56, wingW - 8, 52, false);
    }

    // Incoming garbage indicator bar flush on left inner edge
    if (snap.incomingGarbage > 0) {
      const gRows = Math.min(snap.visibleHeight, snap.incomingGarbage);
      const gh = gRows * cell;
      ctx.fillStyle = '#ff294d';
      ctx.fillRect(boardX - 6, boardY + boardH - gh, 5, gh);
    }

    // Placed blocks with real TETR.IO mino texture
    for (let vy = 0; vy < snap.visibleHeight; vy++) {
      const row = snap.board[vy + snap.bufferHeight];
      for (let x = 0; x < snap.width; x++) {
        if (row[x]) {
          drawTetrioMino(ctx, boardX + x * cell, boardY + vy * cell, cell, row[x], 1, false);
        }
      }
    }

    // Ghost & Active piece
    if (snap.active && engine.PIECE_DEFS[snap.active.key]) {
      const def = engine.PIECE_DEFS[snap.active.key];
      const matrix = def.rotations[snap.active.rot];
      for (const [cx, cy] of matrix) {
        const vx = snap.active.x + cx;
        const gvy = snap.ghostY + cy - snap.bufferHeight;
        if (gvy >= 0 && gvy < snap.visibleHeight) {
          drawTetrioMino(
            ctx,
            boardX + vx * cell,
            boardY + gvy * cell,
            cell,
            def.slot,
            vOpts.shadowOpacity,
            true
          );
        }
      }
      for (const [cx, cy] of matrix) {
        const vx = snap.active.x + cx;
        const avy = snap.active.y + cy - snap.bufferHeight;
        if (avy >= -1 && avy < snap.visibleHeight) {
          drawTetrioMino(ctx, boardX + vx * cell, boardY + avy * cell, cell, def.slot, 1, false);
        }
      }
    }

    // Crisp TETR.IO white U-shaped outer border (open at skyline top)
    ctx.beginPath();
    ctx.moveTo(boardX, boardY);
    ctx.lineTo(boardX, boardY + boardH);
    ctx.lineTo(boardX + boardW, boardY + boardH);
    ctx.lineTo(boardX + boardW, boardY);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = snap.toppedOut ? '#ff3d5c' : '#ffffff';
    ctx.stroke();

    // Right-aligned left-side TETR.IO stats below HOLD wing
    const statRightX = boardX - 14;
    const statsBaseY = boardY + boardH - 135;
    ctx.textAlign = 'right';

    ctx.fillStyle = '#d4d9e8';
    ctx.font = '700 12px HUN, Segoe UI, sans-serif';
    ctx.fillText('PIECES', statRightX, statsBaseY);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 22px HUN, Segoe UI, sans-serif';
    ctx.fillText(`${snap.pieces}, ${snap.pps.toFixed(2)}/S`, statRightX, statsBaseY + 22);

    ctx.fillStyle = '#d4d9e8';
    ctx.font = '700 12px HUN, Segoe UI, sans-serif';
    ctx.fillText(snap.mode === '40l' ? 'LINES LEFT' : 'LINES', statRightX, statsBaseY + 48);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 22px HUN, Segoe UI, sans-serif';
    ctx.fillText(
      snap.mode === '40l' ? String(snap.sprintRemaining) : String(snap.lines),
      statRightX,
      statsBaseY + 70
    );

    ctx.fillStyle = '#d4d9e8';
    ctx.font = '700 12px HUN, Segoe UI, sans-serif';
    ctx.fillText(snap.mode === 'vs' ? 'ATTACK' : 'TIME', statRightX, statsBaseY + 96);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 22px HUN, Segoe UI, sans-serif';
    ctx.fillText(
      snap.mode === 'vs'
        ? `${snap.attackSent}, ${snap.apm.toFixed(1)}/M`
        : formatDuration(snap.mode === 'blitz' ? snap.remainingMs : snap.elapsedMs),
      statRightX,
      statsBaseY + 118
    );

    if (snap.lastCallout) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 22px HUN, Segoe UI, sans-serif';
      ctx.fillText(snap.lastCallout, statRightX, boardY + 145);
    }

    if (snap.finished) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(boardX, boardY, boardW, boardH);
      ctx.textAlign = 'center';
      ctx.fillStyle = snap.winReason === '40l_complete' ? '#5aff9c' : '#ffffff';
      ctx.font = '900 22px HUN, Segoe UI, sans-serif';
      const msg =
        snap.winReason === '40l_complete'
          ? 'FINISH!'
          : snap.winReason === 'time_up'
            ? 'TIME UP!'
            : 'TOP OUT';
      ctx.fillText(msg, boardX + boardW / 2, boardY + boardH / 2);
    }
  }

  /**
   * Renders a compact opponent board preview using native TETR.IO skin colors.
   */
  function renderMiniBoard(canvas, compactBoard, alive) {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    if (Array.isArray(compactBoard) && compactBoard.length > 0) {
      const cols = compactBoard[0].length || 10;
      const rows = compactBoard.length;
      const cellW = w / cols;
      const cellH = h / rows;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const val = compactBoard[y][x];
          if (val) {
            drawTetrioMino(
              ctx,
              x * cellW,
              y * cellH,
              Math.ceil(Math.max(cellW, cellH)),
              alive === false ? 'd' : val,
              1,
              false
            );
          }
        }
      }
    }

    ctx.strokeStyle = alive === false ? '#ff3d5c' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);

    if (alive === false) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff4b6e';
      ctx.font = '900 14px HUN, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('KO', w / 2, h / 2 + 5);
    }
  }

  /**
   * Binds TETR.IO's real user keybinds & DAS/ARR/SDF handling to the playable loop.
   */
  function createPlayfieldController(options) {
    const opts = options || {};
    const canvas = opts.canvas;
    let game = opts.game || null;
    let active = false;
    let rafId = null;
    let lastTs = 0;
    let lastSyncTs = 0;
    let userSettings = readTetrioUserSettings();

    const held = {
      left: false,
      right: false,
      down: false,
      dir: 0,
      dasAcc: 0,
      arrAcc: 0
    };

    function resetKeys() {
      held.left = false;
      held.right = false;
      held.down = false;
      held.dir = 0;
      held.dasAcc = 0;
      held.arrAcc = 0;
    }

    function matchesAction(evCandidates, actionName) {
      const list = userSettings.binds[actionName] || [];
      for (const bound of list) {
        if (evCandidates.has(bound)) return true;
      }
      return false;
    }

    function handleKeyDown(ev) {
      if (!active || !game || !ev) return false;
      const candidates = buildEventKeyCandidates(ev);
      let handled = true;

      if (matchesAction(candidates, 'moveLeft')) {
        if (!held.left) {
          held.left = true;
          held.dir = -1;
          held.dasAcc = 0;
          held.arrAcc = 0;
          game.move(-1, 0);
        }
      } else if (matchesAction(candidates, 'moveRight')) {
        if (!held.right) {
          held.right = true;
          held.dir = 1;
          held.dasAcc = 0;
          held.arrAcc = 0;
          game.move(1, 0);
        }
      } else if (matchesAction(candidates, 'softDrop')) {
        if (!held.down) {
          held.down = true;
          if (userSettings.sdf >= 41 && typeof game.sonicDrop === 'function') {
            game.sonicDrop();
          } else {
            game.move(0, 1);
          }
        }
      } else if (matchesAction(candidates, 'rotateCW') && !ev.repeat) {
        game.rotate(1);
      } else if (matchesAction(candidates, 'rotateCCW') && !ev.repeat) {
        game.rotate(-1);
      } else if (matchesAction(candidates, 'rotate180') && !ev.repeat) {
        game.rotate(2);
      } else if (matchesAction(candidates, 'hardDrop') && !ev.repeat) {
        game.hardDrop();
      } else if (matchesAction(candidates, 'hold') && !ev.repeat) {
        game.hold();
      } else if (matchesAction(candidates, 'retry') && !ev.repeat && opts.allowRestart !== false) {
        game.reset();
      } else {
        handled = false;
      }

      return handled;
    }

    function handleKeyUp(ev) {
      if (!ev) return;
      const candidates = buildEventKeyCandidates(ev);
      if (matchesAction(candidates, 'moveLeft')) {
        held.left = false;
        held.dir = held.right ? 1 : 0;
        held.dasAcc = 0;
      }
      if (matchesAction(candidates, 'moveRight')) {
        held.right = false;
        held.dir = held.left ? -1 : 0;
        held.dasAcc = 0;
      }
      if (matchesAction(candidates, 'softDrop')) {
        held.down = false;
      }
    }

    function tick(ts) {
      if (!active) return;
      if (!lastTs) lastTs = ts;
      const dt = Math.min(60, Math.max(0, ts - lastTs));
      lastTs = ts;

      if (game) {
        if (held.dir !== 0) {
          held.dasAcc += dt;
          if (held.dasAcc >= userSettings.dasMs) {
            if (userSettings.arrMs <= 0 && typeof game.instantMove === 'function') {
              game.instantMove(held.dir);
            } else {
              const stepArr = Math.max(1, userSettings.arrMs);
              held.arrAcc += dt;
              while (held.arrAcc >= stepArr) {
                held.arrAcc -= stepArr;
                if (!game.move(held.dir, 0)) break;
              }
            }
          }
        }

        game.step(dt, held.down, userSettings.sdf);
        const snap = game.getSnapshot();
        renderPlayfield(canvas, snap, userSettings);
        if (typeof opts.onFrame === 'function' && ts - lastSyncTs >= 85) {
          lastSyncTs = ts;
          opts.onFrame(snap);
        }
      }

      if (typeof root.requestAnimationFrame === 'function') {
        rafId = root.requestAnimationFrame(tick);
      }
    }

    return {
      reloadUserSettings() {
        userSettings = readTetrioUserSettings();
        return userSettings;
      },
      setGame(nextGame) {
        game = nextGame;
        if (game && canvas) {
          renderPlayfield(canvas, game.getSnapshot(), userSettings);
        }
      },
      start() {
        if (active) return;
        userSettings = readTetrioUserSettings();
        active = true;
        lastTs = 0;
        lastSyncTs = 0;
        resetKeys();
        if (typeof root.requestAnimationFrame === 'function') {
          rafId = root.requestAnimationFrame(tick);
        } else if (game && canvas) {
          renderPlayfield(canvas, game.getSnapshot(), userSettings);
        }
      },
      stop() {
        active = false;
        resetKeys();
        if (rafId !== null && typeof root.cancelAnimationFrame === 'function') {
          root.cancelAnimationFrame(rafId);
        }
        rafId = null;
      },
      handleKeyDown,
      handleKeyUp
    };
  }

  root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
  root.__TWFOX_INTERNAL__.foxmodCanvas = {
    readTetrioUserSettings,
    formatDuration,
    renderPlayfield,
    renderMiniBoard,
    createPlayfieldController
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));
