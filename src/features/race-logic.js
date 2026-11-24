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
    const frontSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 264 360">' +
      '<defs>' +
      '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#2c120d"/>' +
      '<stop offset="52%" stop-color="#190b16"/>' +
      '<stop offset="100%" stop-color="#0d0811"/>' +
      '</linearGradient>' +
      '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#ffe18c"/>' +
      '<stop offset="50%" stop-color="#ff8c3a"/>' +
      '<stop offset="100%" stop-color="#ff4d6d"/>' +
      '</linearGradient>' +
      '</defs>' +
      '<rect x="0" y="0" width="264" height="360" rx="14" fill="url(#bg)"/>' +
      '<rect x="10" y="10" width="244" height="340" rx="10" fill="none" stroke="url(#gold)" stroke-width="3"/>' +
      '<rect x="18" y="18" width="228" height="324" rx="6" fill="none" stroke="rgba(255,190,120,0.35)" stroke-width="1.5"/>' +
      '<text x="132" y="44" text-anchor="middle" fill="#ffd89c" font-family="sans-serif" font-weight="900" font-size="14" letter-spacing="4">IX · FOXMOD</text>' +
      '<path d="M132 72 L147 96 L176 82 L166 116 L98 116 L88 82 L117 96 Z" fill="url(#gold)"/>' +
      '<g fill="rgba(255,140,66,0.22)" stroke="url(#gold)" stroke-width="2">' +
      '<rect x="34" y="156" width="38" height="114" rx="3"/>' +
      '<rect x="82" y="138" width="38" height="132" rx="3"/>' +
      '<rect x="144" y="128" width="38" height="142" rx="3"/>' +
      '<rect x="192" y="146" width="38" height="124" rx="3"/>' +
      '</g>' +
      '<g fill="#ffd89c">' +
      '<rect x="44" y="210" width="18" height="18" rx="2"/><rect x="44" y="232" width="18" height="18" rx="2"/>' +
      '<rect x="92" y="184" width="18" height="18" rx="2"/><rect x="92" y="206" width="18" height="18" rx="2"/>' +
      '<rect x="154" y="154" width="18" height="18" rx="2"/><rect x="154" y="176" width="18" height="18" rx="2"/>' +
      '<rect x="202" y="196" width="18" height="18" rx="2"/><rect x="202" y="218" width="18" height="18" rx="2"/>' +
      '</g>' +
      '<text x="132" y="308" text-anchor="middle" fill="#fff2d6" font-family="sans-serif" font-weight="900" font-size="23" letter-spacing="2">THE RACE</text>' +
      '<text x="132" y="328" text-anchor="middle" fill="#ff9e64" font-family="sans-serif" font-weight="800" font-size="11" letter-spacing="2">4P TOWER RACE</text>' +
      '</svg>';

    const backSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 264 360">' +
      '<rect x="0" y="0" width="264" height="360" rx="14" fill="#180a10"/>' +
      '<rect x="10" y="10" width="244" height="340" rx="10" fill="none" stroke="#8d361d" stroke-width="3"/>' +
      '<circle cx="132" cy="180" r="46" fill="none" stroke="#ff7b1c" stroke-width="2.5" opacity="0.65"/>' +
      '<circle cx="132" cy="180" r="18" fill="#ff7b1c" opacity="0.35"/>' +
      '</svg>';

    const throbSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 264 360">' +
      '<rect x="6" y="6" width="252" height="348" rx="12" fill="none" stroke="#ff9642" stroke-width="6" opacity="0.75"/>' +
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
    normalizeCompactBoard,
    areAllRacePlayersReady,
    getAliveRacePlayers,
    pickNextAliveTarget,
    computeRaceStandings,
    buildRaceCardArtUrls
  };
}));
