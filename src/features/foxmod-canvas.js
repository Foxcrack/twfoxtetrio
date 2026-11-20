(function (root) {
  'use strict';

  const engine = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.pentominoEngine;
  if (!engine) {
    return;
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

  function drawBeveledCell(ctx, px, py, size, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.fillRect(px + 0.5, py + 0.5, size - 1, size - 1);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(px + 0.5, py + 0.5, size - 1, Math.max(2, size * 0.16));
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(px + 0.5, py + size - Math.max(2, size * 0.18) - 0.5, size - 1, Math.max(2, size * 0.18));
    ctx.restore();
  }

  function drawMiniPiece(ctx, key, boxX, boxY, boxW, boxH, disabled) {
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
    const cellSize = Math.min((boxW - 10) / Math.max(3, pieceW), (boxH - 10) / Math.max(2.5, pieceH), 14);
    const ox = boxX + (boxW - pieceW * cellSize) / 2;
    const oy = boxY + (boxH - pieceH * cellSize) / 2;
    const color = disabled ? '#596178' : def.color;
    for (const [cx, cy] of cells) {
      drawBeveledCell(
        ctx,
        ox + (cx - minX) * cellSize,
        oy + (cy - minY) * cellSize,
        cellSize,
        color,
        disabled ? 0.55 : 1
      );
    }
  }

  /**
   * Renders the full main playfield (Hold, Incoming Garbage, 10x20 grid, Ghost, Next x5).
   */
  function renderPlayfield(canvas, snap) {
    if (!canvas || typeof canvas.getContext !== 'function' || !snap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const sideW = 84;
    const cell = Math.floor(Math.min((w - sideW * 2 - 22) / snap.width, (h - 20) / snap.visibleHeight));
    const boardW = cell * snap.width;
    const boardH = cell * snap.visibleHeight;
    const boardX = Math.floor((w - boardW) / 2);
    const boardY = Math.floor((h - boardH) / 2);

    // Left panel: HOLD
    ctx.fillStyle = '#0e121c';
    ctx.strokeStyle = 'rgba(130, 155, 225, 0.32)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(boardX - sideW - 10, boardY, sideW, 74);
    ctx.strokeRect(boardX - sideW - 10, boardY, sideW, 74);
    ctx.fillStyle = '#9aa8cf';
    ctx.font = 'bold 11px HUN, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HOLD', boardX - sideW - 4, boardY + 14);
    drawMiniPiece(ctx, snap.holdKey, boardX - sideW - 8, boardY + 18, sideW - 4, 52, !snap.canHold);

    // Incoming garbage bar on left edge of board
    const gBarX = boardX - 7;
    ctx.fillStyle = '#141926';
    ctx.fillRect(gBarX, boardY, 5, boardH);
    if (snap.incomingGarbage > 0) {
      const gRows = Math.min(snap.visibleHeight, snap.incomingGarbage);
      const gh = gRows * cell;
      ctx.fillStyle = '#ff3b5c';
      ctx.fillRect(gBarX, boardY + boardH - gh, 5, gh);
    }

    // Board background & subtle grid
    ctx.fillStyle = '#090c14';
    ctx.fillRect(boardX, boardY, boardW, boardH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
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

    // Placed blocks
    for (let vy = 0; vy < snap.visibleHeight; vy++) {
      const row = snap.board[vy + snap.bufferHeight];
      for (let x = 0; x < snap.width; x++) {
        if (row[x]) {
          drawBeveledCell(ctx, boardX + x * cell, boardY + vy * cell, cell, row[x], 1);
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
          drawBeveledCell(ctx, boardX + vx * cell, boardY + gvy * cell, cell, def.color, 0.24);
        }
      }
      for (const [cx, cy] of matrix) {
        const vx = snap.active.x + cx;
        const avy = snap.active.y + cy - snap.bufferHeight;
        if (avy >= 0 && avy < snap.visibleHeight) {
          drawBeveledCell(ctx, boardX + vx * cell, boardY + avy * cell, cell, def.color, 1);
        }
      }
    }

    ctx.strokeStyle = snap.toppedOut ? '#ff4666' : 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 2;
    ctx.strokeRect(boardX, boardY, boardW, boardH);

    // Right panel: NEXT x5
    const nextX = boardX + boardW + 10;
    const nextH = 290;
    ctx.fillStyle = '#0e121c';
    ctx.strokeStyle = 'rgba(130, 155, 225, 0.32)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(nextX, boardY, sideW, nextH);
    ctx.strokeRect(nextX, boardY, sideW, nextH);
    ctx.fillStyle = '#9aa8cf';
    ctx.fillText('NEXT', nextX + 6, boardY + 14);
    for (let i = 0; i < Math.min(5, snap.nextKeys.length); i++) {
      drawMiniPiece(ctx, snap.nextKeys[i], nextX + 2, boardY + 20 + i * 53, sideW - 4, 50, false);
    }

    // Left lower stats box
    const statsY = boardY + 84;
    ctx.fillStyle = '#9aa8cf';
    ctx.font = 'bold 10px HUN, Segoe UI, sans-serif';
    const statLines = [
      ['LINES', snap.mode === '40l' ? `${snap.lines}/40` : String(snap.lines)],
      ['PIECES', `${snap.pieces} (${snap.pps.toFixed(1)}/s)`],
      ['ATK', String(snap.attackSent)],
      ['SCORE', snap.score.toLocaleString('en-US')],
      ['TIME', formatDuration(snap.mode === 'blitz' ? snap.remainingMs : snap.elapsedMs)]
    ];
    for (let i = 0; i < statLines.length; i++) {
      const sy = statsY + i * 38;
      ctx.fillStyle = '#7c8bb5';
      ctx.font = 'bold 10px HUN, Segoe UI, sans-serif';
      ctx.fillText(statLines[i][0], boardX - sideW - 10, sy + 10);
      ctx.fillStyle = '#eef2ff';
      ctx.font = 'bold 14px HUN, Segoe UI, sans-serif';
      ctx.fillText(statLines[i][1], boardX - sideW - 10, sy + 26);
    }

    // Callout overlay on board
    if (snap.lastCallout) {
      ctx.save();
      ctx.font = '900 18px HUN, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = snap.lastCallout.includes('PENTA') ? '#ffaa44' : '#ffe074';
      ctx.fillText(snap.lastCallout, boardX + boardW / 2, boardY + 34);
      ctx.restore();
    }

    if (snap.finished) {
      ctx.fillStyle = 'rgba(8, 10, 16, 0.72)';
      ctx.fillRect(boardX, boardY, boardW, boardH);
      ctx.fillStyle = snap.winReason === '40l_complete' ? '#4cff9c' : '#ff9a52';
      ctx.font = '900 20px HUN, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      const msg =
        snap.winReason === '40l_complete'
          ? '40 LINES CLEAR!'
          : snap.winReason === 'time_up'
            ? 'TIME UP!'
            : 'TOP OUT';
      ctx.fillText(msg, boardX + boardW / 2, boardY + boardH / 2);
    }
  }

  /**
   * Renders a compact opponent board preview for P2P multiplayer rooms.
   */
  function renderMiniBoard(canvas, compactBoard, alive) {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#090c14';
    ctx.fillRect(0, 0, w, h);

    if (Array.isArray(compactBoard) && compactBoard.length > 0) {
      const cols = compactBoard[0].length || 10;
      const rows = compactBoard.length;
      const cellW = w / cols;
      const cellH = h / rows;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const color = compactBoard[y][x];
          if (color) {
            ctx.fillStyle = alive === false ? '#5a6070' : color;
            ctx.fillRect(x * cellW, y * cellH, Math.ceil(cellW), Math.ceil(cellH));
          }
        }
      }
    }

    if (alive === false) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff5c7a';
      ctx.font = '900 13px HUN, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('KO', w / 2, h / 2 + 4);
    }
  }

  /**
   * Manages keyboard DAS/ARR and the animation loop while an active playable view is open.
   */
  function createPlayfieldController(options) {
    const opts = options || {};
    const canvas = opts.canvas;
    let game = opts.game || null;
    let active = false;
    let rafId = null;
    let lastTs = 0;
    let lastSyncTs = 0;

    const DAS_MS = 133;
    const ARR_MS = 17;
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

    function handleKeyDown(ev) {
      if (!active || !game || !ev) return false;
      const code = ev.code || ev.key;
      let handled = true;

      if (code === 'ArrowLeft') {
        if (!held.left) {
          held.left = true;
          held.dir = -1;
          held.dasAcc = 0;
          held.arrAcc = 0;
          game.move(-1, 0);
        }
      } else if (code === 'ArrowRight') {
        if (!held.right) {
          held.right = true;
          held.dir = 1;
          held.dasAcc = 0;
          held.arrAcc = 0;
          game.move(1, 0);
        }
      } else if (code === 'ArrowDown') {
        if (!held.down) {
          held.down = true;
          game.move(0, 1);
        }
      } else if ((code === 'ArrowUp' || code === 'KeyX') && !ev.repeat) {
        game.rotate(1);
      } else if ((code === 'KeyZ' || code === 'ControlLeft' || code === 'ControlRight') && !ev.repeat) {
        game.rotate(-1);
      } else if (code === 'KeyA' && !ev.repeat) {
        game.rotate(2);
      } else if (code === 'Space' && !ev.repeat) {
        game.hardDrop();
      } else if ((code === 'KeyC' || code === 'ShiftLeft' || code === 'ShiftRight') && !ev.repeat) {
        game.hold();
      } else if (code === 'KeyR' && !ev.repeat && opts.allowRestart !== false) {
        game.reset();
      } else {
        handled = false;
      }

      return handled;
    }

    function handleKeyUp(ev) {
      if (!ev) return;
      const code = ev.code || ev.key;
      if (code === 'ArrowLeft') {
        held.left = false;
        held.dir = held.right ? 1 : 0;
        held.dasAcc = 0;
      } else if (code === 'ArrowRight') {
        held.right = false;
        held.dir = held.left ? -1 : 0;
        held.dasAcc = 0;
      } else if (code === 'ArrowDown') {
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
          if (held.dasAcc >= DAS_MS) {
            held.arrAcc += dt;
            while (held.arrAcc >= ARR_MS) {
              held.arrAcc -= ARR_MS;
              if (!game.move(held.dir, 0)) break;
            }
          }
        }

        game.step(dt, held.down);
        const snap = game.getSnapshot();
        renderPlayfield(canvas, snap);
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
      setGame(nextGame) {
        game = nextGame;
        if (game && canvas) {
          renderPlayfield(canvas, game.getSnapshot());
        }
      },
      start() {
        if (active) return;
        active = true;
        lastTs = 0;
        lastSyncTs = 0;
        resetKeys();
        if (typeof root.requestAnimationFrame === 'function') {
          rafId = root.requestAnimationFrame(tick);
        } else if (game && canvas) {
          renderPlayfield(canvas, game.getSnapshot());
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
    formatDuration,
    renderPlayfield,
    renderMiniBoard,
    createPlayfieldController
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));
