(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
  root.__TWFOX_INTERNAL__.raceLogic = api;
}(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const MAX_RACE_PLAYERS = 4;
  const MIN_RACE_PLAYERS = 2;
  const RACE_GAME_MODE = 'race';
  const RACE_COUNTDOWN_MS = 2800;

  const BOARD_WIDTH = 10;
  const VISIBLE_HEIGHT = 20;

  const FLOOR_DISTANCES = Object.freeze([0, 50, 150, 300, 450, 650, 850, 1100, 1350, 1650]);
  const FLOOR_NAMES = Object.freeze([
    'HALLWAY',
    'HOTEL',
    'CASINO',
    'ARENA',
    'MUSEUM',
    'OFFICES',
    'LABORATORY',
    'CORE',
    'CORRUPTION',
    'SUMMIT'
  ]);
  const FLOOR_COLORS = Object.freeze([
    '#c76b4c',
    '#e07a5f',
    '#f2cc8f',
    '#ffb703',
    '#fb8500',
    '#ef476f',
    '#4cc9f0',
    '#b5179e',
    '#9d4edd',
    '#ffd166'
  ]);

  const VALID_SLOTS = new Set(['z', 'l', 'o', 's', 'i', 'j', 't', 'd', 'gb', 'gbd']);

  // Standard TETR.IO 7-tetromino shapes (rot 0..3) used only as a read-only visual fallback
  // when rendering active falling pieces onto Race preview canvases.
  const FALLBACK_TETROMINO_SHAPES = Object.freeze({
    i: [
      [[0, 1], [1, 1], [2, 1], [3, 1]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[1, 0], [1, 1], [1, 2], [1, 3]]
    ],
    j: [
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[1, 0], [1, 1], [0, 2], [1, 2]]
    ],
    l: [
      [[2, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 1], [0, 2]],
      [[0, 0], [1, 0], [1, 1], [1, 2]]
    ],
    o: [
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]]
    ],
    s: [
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[1, 1], [2, 1], [0, 2], [1, 2]],
      [[0, 0], [0, 1], [1, 1], [1, 2]]
    ],
    t: [
      [[1, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [1, 2]],
      [[1, 0], [0, 1], [1, 1], [1, 2]]
    ],
    z: [
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[2, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[1, 0], [0, 1], [1, 1], [0, 2]]
    ]
  });

  function clampAltitude(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 10) / 10;
  }

  function computeFloorFromAltitude(altitude, explicitFloor) {
    const safeAlt = clampAltitude(altitude);
    let floor = Math.floor(Number(explicitFloor) || 0);
    if (floor < 1 || floor > 10) {
      floor = 1;
      for (let i = FLOOR_DISTANCES.length - 1; i >= 0; i--) {
        if (safeAlt >= FLOOR_DISTANCES[i]) {
          floor = i + 1;
          break;
        }
      }
    }
    const idx = Math.max(0, Math.min(9, floor - 1));
    const startAlt = FLOOR_DISTANCES[idx] || 0;
    const endAlt = FLOOR_DISTANCES[idx + 1] || (startAlt + 350);
    const progress = endAlt > startAlt
      ? Math.max(0, Math.min(1, (safeAlt - startAlt) / (endAlt - startAlt)))
      : 1;
    return {
      floor,
      name: FLOOR_NAMES[idx],
      color: FLOOR_COLORS[idx],
      progress
    };
  }

  function sanitizePieceKey(raw) {
    if (!raw) return null;
    const rawStr = typeof raw === 'string'
      ? raw
      : (typeof raw === 'object' ? (raw.type || raw.key || raw.c || '') : '');
    const clean = String(rawStr || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(FALLBACK_TETROMINO_SHAPES, clean) ? clean : null;
  }

  function sanitizeNextQueue(rawNext) {
    if (!Array.isArray(rawNext)) return [];
    const out = [];
    for (let i = 0; i < rawNext.length && out.length < 5; i++) {
      const k = sanitizePieceKey(rawNext[i]);
      if (k) out.push(k);
    }
    return out;
  }

  function sanitizeCellValue(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') {
      const clean = raw.trim().toLowerCase();
      if (VALID_SLOTS.has(clean)) return clean;
      if (clean === '#') return 'gb';
      if (clean === '@') return 'gbd';
      return null;
    }
    if (typeof raw === 'object') {
      const candidate = raw.c || raw.t || raw.type || raw.skin;
      if (typeof candidate === 'string') {
        const clean = candidate.trim().toLowerCase();
        return VALID_SLOTS.has(clean) ? clean : 'd';
      }
      return 'd';
    }
    if (typeof raw === 'number' && raw > 0) return 'd';
    return null;
  }

  function normalizeCompactBoard(rawBoard, fallingPiece, bufferHeightOverride) {
    const out = [];
    for (let y = 0; y < VISIBLE_HEIGHT; y++) {
      out.push(new Array(BOARD_WIDTH).fill(null));
    }

    let sourceRows = null;
    let width = BOARD_WIDTH;
    if (Array.isArray(rawBoard)) {
      sourceRows = rawBoard;
    } else if (rawBoard && Array.isArray(rawBoard.b)) {
      sourceRows = rawBoard.b;
      width = Math.max(1, Math.min(BOARD_WIDTH, Number(rawBoard.w) || BOARD_WIDTH));
    }

    let inferredBuffer = 0;
    if (sourceRows && sourceRows.length > 0) {
      inferredBuffer = Math.max(0, sourceRows.length - VISIBLE_HEIGHT);
      const startRow = Math.max(0, sourceRows.length - VISIBLE_HEIGHT);
      const destOffset = Math.max(0, VISIBLE_HEIGHT - sourceRows.length);
      for (let r = startRow; r < sourceRows.length; r++) {
        const destY = destOffset + (r - startRow);
        if (destY < 0 || destY >= VISIBLE_HEIGHT) continue;
        const srcRow = sourceRows[r];
        if (!Array.isArray(srcRow)) continue;
        const cols = Math.min(BOARD_WIDTH, Math.min(width, srcRow.length));
        for (let c = 0; c < cols; c++) {
          out[destY][c] = sanitizeCellValue(srcRow[c]);
        }
      }
    }

    if (fallingPiece && typeof fallingPiece === 'object' && fallingPiece.type) {
      const key = String(fallingPiece.type).trim().toLowerCase();
      const rotList = FALLBACK_TETROMINO_SHAPES[key];
      if (rotList) {
        const rot = ((Math.floor(Number(fallingPiece.r) || 0) % 4) + 4) % 4;
        const cells = rotList[rot] || rotList[0];
        const px = Math.round(Number(fallingPiece.x) || 0);
        const rawY = Math.round(Number(fallingPiece.y) || 0);
        const buf = Number.isFinite(Number(bufferHeightOverride))
          ? Number(bufferHeightOverride)
          : inferredBuffer;
        const baseY = rawY >= VISIBLE_HEIGHT || buf > 0 ? rawY - buf : rawY;
        for (let i = 0; i < cells.length; i++) {
          const cx = px + cells[i][0];
          const cy = baseY + cells[i][1];
          if (cx >= 0 && cx < BOARD_WIDTH && cy >= 0 && cy < VISIBLE_HEIGHT) {
            if (!out[cy][cx]) {
              out[cy][cx] = key;
            }
          }
        }
      }
    }

    return out;
  }

  function areAllRacePlayersReady(players, minPlayers, maxPlayers) {
    const min = Math.max(2, Number(minPlayers) || MIN_RACE_PLAYERS);
    const max = Math.max(min, Number(maxPlayers) || MAX_RACE_PLAYERS);
    if (!Array.isArray(players)) return false;
    const active = players.filter((p) => p && !p.spectator && !p.disconnected);
    if (active.length < min || active.length > max) return false;
    return active.every((p) => Boolean(p.ready));
  }

  function getAliveRacePlayers(players, excludeId) {
    if (!Array.isArray(players)) return [];
    return players.filter(
      (p) => p && !p.spectator && !p.disconnected && p.alive !== false && p.id !== excludeId
    );
  }

  function pickNextAliveTarget(players, selfId, currentTargetId) {
    const alive = getAliveRacePlayers(players, selfId);
    if (alive.length === 0) return null;
    if (currentTargetId) {
      const existing = alive.find((p) => p.id === currentTargetId);
      if (existing) return existing;
    }
    const sorted = alive.slice().sort((a, b) => {
      const altA = clampAltitude(a.peakAltitude !== undefined ? a.peakAltitude : a.altitude);
      const altB = clampAltitude(b.peakAltitude !== undefined ? b.peakAltitude : b.altitude);
      if (altB !== altA) return altB - altA;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return sorted[0];
  }

  function computeRaceStandings(players, disconnectedPlayers, roundStartMs, endedMs) {
    const startTs = Number(roundStartMs) || 0;
    const endTs = Number(endedMs) || startTs;
    const pool = []
      .concat(Array.isArray(players) ? players : [])
      .concat(Array.isArray(disconnectedPlayers) ? disconnectedPlayers : [])
      .filter((p) => p && !p.spectator);

    const sorted = pool.slice().sort((a, b) => {
      const altA = clampAltitude(a.peakAltitude !== undefined ? Math.max(Number(a.peakAltitude) || 0, Number(a.altitude) || 0) : a.altitude);
      const altB = clampAltitude(b.peakAltitude !== undefined ? Math.max(Number(b.peakAltitude) || 0, Number(b.altitude) || 0) : b.altitude);
      if (altB !== altA) return altB - altA;
      const floorA = Number(a.floor) || 1;
      const floorB = Number(b.floor) || 1;
      if (floorB !== floorA) return floorB - floorA;
      if ((Number(b.score) || 0) !== (Number(a.score) || 0)) {
        return (Number(b.score) || 0) - (Number(a.score) || 0);
      }
      if (Boolean(a.disconnected) !== Boolean(b.disconnected)) {
        return a.disconnected ? 1 : -1;
      }
      const durA = Number(a.durationMs) || (a.eliminatedAt && startTs ? Math.max(0, a.eliminatedAt - startTs) : 0);
      const durB = Number(b.durationMs) || (b.eliminatedAt && startTs ? Math.max(0, b.eliminatedAt - startTs) : 0);
      if (durB !== durA) return durB - durA;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    return sorted.map((p, idx) => {
      const alt = clampAltitude(
        p.peakAltitude !== undefined ? Math.max(Number(p.peakAltitude) || 0, Number(p.altitude) || 0) : p.altitude
      );
      const floorInfo = computeFloorFromAltitude(alt, p.floor);
      const stopTs = p.eliminatedAt && p.eliminatedAt > startTs ? p.eliminatedAt : endTs;
      const computedDuration = Number(p.durationMs) > 0
        ? Number(p.durationMs)
        : (startTs > 0 ? Math.max(0, stopTs - startTs) : 0);
      return {
        id: p.id,
        name: p.name,
        isHost: Boolean(p.isHost),
        placement: idx + 1,
        alive: Boolean(p.alive),
        disconnected: Boolean(p.disconnected),
        altitude: alt,
        floor: floorInfo.floor,
        floorName: floorInfo.name,
        score: Number(p.score) || 0,
        lines: Number(p.lines) || 0,
        pps: Number(p.pps) || 0,
        apm: Number(p.apm) || 0,
        wins: Number(p.wins) || 0,
        durationMs: computedDuration
      };
    });
  }

  function svgToDataUrl(svgText) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
  }

  function buildRaceCardArtUrls() {
    // Match official TETR.IO card PNG sheet dimensions (550x770) with identical transparent halo margins
    // around the solid card frame [x=39, y=60, w=472, h=649] so it aligns seamlessly in #zenith_deck_cards.
    const frontSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="550" height="770" viewBox="0 0 550 770">' +
      '<defs>' +
      '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#351610"/>' +
      '<stop offset="55%" stop-color="#1d0c15"/>' +
      '<stop offset="100%" stop-color="#0f070e"/>' +
      '</linearGradient>' +
      '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#ffe2a8"/>' +
      '<stop offset="55%" stop-color="#ff944d"/>' +
      '<stop offset="100%" stop-color="#ff5e4d"/>' +
      '</linearGradient>' +
      '</defs>' +
      '<rect x="39" y="60" width="472" height="649" rx="18" fill="url(#bg)"/>' +
      '<rect x="53" y="74" width="444" height="621" rx="12" fill="none" stroke="url(#gold)" stroke-width="5"/>' +
      '<rect x="65" y="86" width="420" height="597" rx="7" fill="none" stroke="rgba(255,190,140,0.34)" stroke-width="2"/>' +
      '<text x="86" y="132" fill="#ffd9b3" font-family="sans-serif" font-weight="900" font-size="30" letter-spacing="2">IX</text>' +
      '<path d="M446 104 L454 118 L470 109 L465 130 L427 130 L422 109 L438 118 Z" fill="url(#gold)"/>' +
      '<path d="M275 152 L297 188 L338 168 L324 216 L226 216 L212 168 L253 188 Z" fill="url(#gold)"/>' +
      '<g fill="rgba(255,146,72,0.18)" stroke="url(#gold)" stroke-width="3.5">' +
      '<rect x="98" y="294" width="68" height="220" rx="5"/>' +
      '<rect x="190" y="262" width="68" height="252" rx="5"/>' +
      '<rect x="292" y="242" width="68" height="272" rx="5"/>' +
      '<rect x="384" y="278" width="68" height="236" rx="5"/>' +
      '</g>' +
      '<g fill="#ffdcb8">' +
      '<rect x="116" y="390" width="32" height="32" rx="3"/><rect x="116" y="432" width="32" height="32" rx="3"/>' +
      '<rect x="208" y="346" width="32" height="32" rx="3"/><rect x="208" y="388" width="32" height="32" rx="3"/>' +
      '<rect x="310" y="296" width="32" height="32" rx="3"/><rect x="310" y="338" width="32" height="32" rx="3"/>' +
      '<rect x="402" y="366" width="32" height="32" rx="3"/><rect x="402" y="408" width="32" height="32" rx="3"/>' +
      '</g>' +
      '<text x="275" y="592" text-anchor="middle" fill="#fff0db" font-family="sans-serif" font-weight="900" font-size="42" letter-spacing="4">THE RACE</text>' +
      '<text x="275" y="632" text-anchor="middle" fill="#ff9e6b" font-family="sans-serif" font-weight="800" font-size="20" letter-spacing="4">4P TOWER RACE</text>' +
      '</svg>';

    const backSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="550" height="770" viewBox="0 0 550 770">' +
      '<rect x="39" y="60" width="472" height="649" rx="18" fill="#180a0f"/>' +
      '<rect x="53" y="74" width="444" height="621" rx="12" fill="none" stroke="#8d361d" stroke-width="5"/>' +
      '<circle cx="275" cy="385" r="88" fill="none" stroke="#ff7b1c" stroke-width="4" opacity="0.65"/>' +
      '<circle cx="275" cy="385" r="32" fill="#ff7b1c" opacity="0.35"/>' +
      '</svg>';

    const throbSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="550" height="770" viewBox="0 0 550 770">' +
      '<rect x="35" y="56" width="480" height="657" rx="20" fill="none" stroke="#ff9642" stroke-width="9" opacity="0.78"/>' +
      '</svg>';

    return {
      frontUrl: svgToDataUrl(frontSvg),
      backUrl: svgToDataUrl(backSvg),
      throbUrl: svgToDataUrl(throbSvg)
    };
  }

  return {
    MAX_RACE_PLAYERS,
    MIN_RACE_PLAYERS,
    RACE_GAME_MODE,
    RACE_COUNTDOWN_MS,
    BOARD_WIDTH,
    VISIBLE_HEIGHT,
    FLOOR_DISTANCES,
    FLOOR_NAMES,
    FLOOR_COLORS,
    clampAltitude,
    computeFloorFromAltitude,
    sanitizePieceKey,
    sanitizeNextQueue,
    normalizeCompactBoard,
    areAllRacePlayersReady,
    getAliveRacePlayers,
    pickNextAliveTarget,
    computeRaceStandings,
    buildRaceCardArtUrls
  };
}));
