(function (root) {
  'use strict';

  const SOLO_PB_STORAGE_KEY = 'twfoxtetrio_solo_pbs_v1';
  const SOLO_OPTS_STORAGE_KEY = 'twfoxtetrio_solo_opts_v1';

  const SOLO_MUSIC_CHOICES = Object.freeze([
    { id: 'RANDOMcalm', label: 'RANDOM: CALM' },
    { id: 'hyper-velocity', label: 'HYPER VELOCITY' },
    { id: 'kaze', label: 'KAZE NO TAKI' },
    { id: 'RANDOMupbeat', label: 'RANDOM: UPBEAT' }
  ]);

  const SOLO_MODE_SPECS = Object.freeze({
    fourWide: {
      key: 'fourWide',
      title: '4WIDE',
      subtitle: 'PRACTICE STACKING COMBOS INSIDE A 4-WIDE WELL USING THE REAL TETR.IO ENGINE.',
      footer: 'press start to begin practicing 4-wide combos',
      pbTitle: 'PERSONAL BEST SCORE',
      pbKind: 'score',
      hasProFinesseSubOpts: true,
      hasPentominoSelectors: false,
      theme: {
        headerGrad: 'linear-gradient(to bottom, #382b22 0, #1d1612 100%)',
        headerBorder: '#48362a',
        headerText: '#d99a64',
        blockBg: '#523d2d',
        blockTop: '#99633b',
        blockLeft: '#77563e',
        blockBottom: '#271c14',
        blockRight: '#3b291c',
        text: '#ffd28c',
        muted: '#c9954c',
        startBg: '#70523c',
        startBorder: '#b3825d',
        startColor: '#f4c19a'
      }
    },
    pentomino: {
      key: 'pentomino',
      title: 'PENTOMINOS',
      subtitle: '12-PIECE PENTOMINOES, 7-BAG TETROMINOES, OR 19-PIECE CHAOS WITH REAL TETR.IO CONTROLS.',
      footer: 'press start to play pentominoes',
      pbTitle: 'PERSONAL BEST',
      pbKind: 'dynamic',
      hasProFinesseSubOpts: false,
      hasPentominoSelectors: true,
      theme: {
        headerGrad: 'linear-gradient(to bottom, #4e2c2c 0, #311d1d 100%)',
        headerBorder: '#6e2f2f',
        headerText: '#f09ba8',
        blockBg: '#46222a',
        blockTop: '#9c3e52',
        blockLeft: '#6e2d3b',
        blockBottom: '#210e13',
        blockRight: '#33171d',
        text: '#ffb5c2',
        muted: '#d67889',
        startBg: '#6e2c3a',
        startBorder: '#bd556b',
        startColor: '#ffd4dc'
      }
    },
    marathon: {
      key: 'marathon',
      title: 'MARATHON',
      subtitle: 'CLASSIC 150-LINE SURVIVAL & SCORE CHALLENGE WITH ESCALATING GRAVITY LEVELS.',
      footer: 'press start to begin 150-line marathon',
      pbTitle: 'PERSONAL BEST SCORE',
      pbKind: 'marathon',
      hasProFinesseSubOpts: true,
      hasPentominoSelectors: false,
      theme: {
        headerGrad: 'linear-gradient(to bottom, #1b243d 0, #111626 100%)',
        headerBorder: '#354878',
        headerText: '#88afff',
        blockBg: '#222b44',
        blockTop: '#3e5285',
        blockLeft: '#2f3f69',
        blockBottom: '#101524',
        blockRight: '#1a2136',
        text: '#cfe0ff',
        muted: '#7f9cd6',
        startBg: '#2b3e6e',
        startBorder: '#5777c4',
        startColor: '#dbe8ff'
      }
    }
  });

  const DEFAULT_MODE_OPTIONS = Object.freeze({
    pro: false,
    proAlert: false,
    proRetry: false,
    stride: true,
    song: 'RANDOMcalm',
    pieceSet: 'pentomino',
    subMode: 'zen'
  });

  function formatMsCompact(ms) {
    const safe = Math.max(0, Math.round(Number(ms) || 0));
    const minutes = Math.floor(safe / 60000);
    const seconds = Math.floor((safe % 60000) / 1000);
    const millis = safe % 1000;
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  function normalizeModeOptions(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const validPieceSets = new Set(['pentomino', 'tetromino', 'chaos']);
    const validSubModes = new Set(['zen', '40l', 'blitz']);
    const validSongs = new Set(SOLO_MUSIC_CHOICES.map((m) => m.id));
    return {
      pro: Boolean(src.pro),
      proAlert: Boolean(src.proAlert),
      proRetry: Boolean(src.proRetry),
      stride: src.stride === undefined ? true : Boolean(src.stride),
      song: validSongs.has(src.song) ? src.song : 'RANDOMcalm',
      pieceSet: validPieceSets.has(src.pieceSet) ? src.pieceSet : 'pentomino',
      subMode: validSubModes.has(src.subMode) ? src.subMode : 'zen'
    };
  }

  function loadAllOptions(storage) {
    const store = storage || (typeof root !== 'undefined' && root.localStorage);
    const out = {
      fourWide: normalizeModeOptions({ stride: true }),
      pentomino: normalizeModeOptions({ stride: true, pieceSet: 'pentomino', subMode: 'zen' }),
      marathon: normalizeModeOptions({ stride: true })
    };
    if (!store || typeof store.getItem !== 'function') return out;
    try {
      const raw = store.getItem(SOLO_OPTS_STORAGE_KEY);
      if (!raw) return out;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const k of Object.keys(out)) {
          if (parsed[k]) out[k] = normalizeModeOptions(parsed[k]);
        }
      }
    } catch (_) {}
    return out;
  }

  function saveAllOptions(allOpts, storage) {
    const store = storage || (typeof root !== 'undefined' && root.localStorage);
    if (!store || typeof store.setItem !== 'function') return;
    try {
      store.setItem(SOLO_OPTS_STORAGE_KEY, JSON.stringify(allOpts || {}));
    } catch (_) {}
  }

  function getPbStorageSlot(modeKey, opts) {
    if (modeKey === 'pentomino') {
      const n = normalizeModeOptions(opts);
      return `pentomino:${n.pieceSet}:${n.subMode}`;
    }
    return modeKey === 'marathon' ? 'marathon' : 'fourWide';
  }

  function loadAllPbs(storage) {
    const store = storage || (typeof root !== 'undefined' && root.localStorage);
    if (!store || typeof store.getItem !== 'function') return {};
    try {
      const raw = store.getItem(SOLO_PB_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveAllPbs(pbs, storage) {
    const store = storage || (typeof root !== 'undefined' && root.localStorage);
    if (!store || typeof store.setItem !== 'function') return;
    try {
      store.setItem(SOLO_PB_STORAGE_KEY, JSON.stringify(pbs || {}));
    } catch (_) {}
  }

  /**
   * Records a completed or aborted solo run result and updates the mode's personal best
   * when beaten. Returns `{ pbs, updated, entry }`.
   */
  function recordSoloResult(modeKey, opts, result, storage) {
    const pbs = loadAllPbs(storage);
    const slot = getPbStorageSlot(modeKey, opts);
    const prev = pbs[slot] && typeof pbs[slot] === 'object' ? { ...pbs[slot] } : {};
    const score = Math.max(0, Math.round(Number(result && result.score) || 0));
    const lines = Math.max(0, Math.round(Number(result && result.lines) || 0));
    const timeMs = Math.max(0, Math.round(Number(result && result.timeMs) || 0));
    const completed = Boolean(result && result.completed);
    let updated = false;

    if (modeKey === 'pentomino') {
      const n = normalizeModeOptions(opts);
      if (n.subMode === '40l') {
        if (completed && timeMs > 0 && (!prev.bestTimeMs || timeMs < prev.bestTimeMs)) {
          prev.bestTimeMs = timeMs;
          updated = true;
        }
        if (score > (prev.bestScore || 0)) {
          prev.bestScore = score;
          if (!prev.bestTimeMs) updated = true;
        }
      } else {
        if (score > (prev.bestScore || 0)) {
          prev.bestScore = score;
          updated = true;
        }
        if (lines > (prev.bestLines || 0)) {
          prev.bestLines = lines;
          if (!prev.bestScore) updated = true;
        }
      }
    } else if (modeKey === 'marathon') {
      if (score > (prev.bestScore || 0)) {
        prev.bestScore = score;
        updated = true;
      }
      if (completed && timeMs > 0 && (!prev.bestTimeMs || timeMs < prev.bestTimeMs)) {
        prev.bestTimeMs = timeMs;
        updated = true;
      }
      if (lines > (prev.bestLines || 0)) {
        prev.bestLines = lines;
      }
    } else {
      // fourWide
      if (score > (prev.bestScore || 0)) {
        prev.bestScore = score;
        updated = true;
      }
      if (lines > (prev.bestLines || 0)) {
        prev.bestLines = lines;
      }
    }

    if (updated) {
      prev.updatedAt = Date.now();
    }
    pbs[slot] = prev;
    saveAllPbs(pbs, storage);
    return { pbs, updated, entry: prev, slot };
  }

  /**
   * Formats heading label, big PB value, and secondary stat line for the solo pre-game lobby.
   */
  function formatSoloPbDisplay(modeKey, opts, pbs) {
    const slot = getPbStorageSlot(modeKey, opts);
    const entry = pbs && pbs[slot] && typeof pbs[slot] === 'object' ? pbs[slot] : null;

    if (modeKey === 'pentomino') {
      const n = normalizeModeOptions(opts);
      const setTag = n.pieceSet === 'chaos' ? 'CAOS 19' : n.pieceSet === 'tetromino' ? 'TETROMINO 7' : 'PENTOMINO 12';
      if (n.subMode === '40l') {
        return {
          title: `PERSONAL BEST (${setTag} · 40L)`,
          value: entry && entry.bestTimeMs > 0 ? formatMsCompact(entry.bestTimeMs) : '--:--.---',
          subtitle: entry && entry.bestTimeMs > 0
            ? `BEST TIME · ${Math.round(entry.bestScore || 0).toLocaleString('en-US')} PTS`
            : 'NO 40 LINES TIME YET — CLEAR 40 LINES TO SET A RECORD'
        };
      }
      if (n.subMode === 'blitz') {
        return {
          title: `PERSONAL BEST (${setTag} · BLITZ 2:00)`,
          value: entry && entry.bestScore > 0 ? entry.bestScore.toLocaleString('en-US') : '0',
          subtitle: entry && entry.bestLines > 0
            ? `BEST SCORE · ${entry.bestLines} LINES`
            : 'NO BLITZ RECORD YET — PLAY A 2:00 RUN TO SET ONE'
        };
      }
      return {
        title: `PERSONAL BEST (${setTag} · ZEN)`,
        value: entry && entry.bestScore > 0 ? entry.bestScore.toLocaleString('en-US') : '0',
        subtitle: entry && entry.bestLines > 0
          ? `HIGHEST PRACTICE SCORE · ${entry.bestLines} LINES`
          : 'PRACTICE RECORD TRACKED AUTOMATICALLY'
      };
    }

    if (modeKey === 'marathon') {
      return {
        title: 'PERSONAL BEST SCORE',
        value: entry && entry.bestScore > 0 ? entry.bestScore.toLocaleString('en-US') : '0',
        subtitle: entry && entry.bestTimeMs > 0
          ? `BEST 150L CLEAR TIME: ${formatMsCompact(entry.bestTimeMs)}`
          : entry && entry.bestLines > 0
            ? `FURTHEST RUN: ${entry.bestLines} / 150 LINES`
            : 'CLEAR 150 LINES TO RECORD A COMPLETION TIME'
      };
    }

    // fourWide
    return {
      title: 'PERSONAL BEST SCORE',
      value: entry && entry.bestScore > 0 ? entry.bestScore.toLocaleString('en-US') : '0',
      subtitle: entry && entry.bestLines > 0
        ? `BEST LINES IN 4-WIDE: ${entry.bestLines}`
        : 'NO 4-WIDE RECORD YET — START A RUN TO SET ONE'
    };
  }

  /**
   * Builds merged TETR.IO custom preset & engine runtime options for Stride / Pro Mode.
   */
  function buildCustomLaunchConfig(basePreset, rawOpts) {
    const opts = normalizeModeOptions(rawOpts);
    const preset = Object.assign({}, basePreset || {});
    preset.stride = opts.stride;
    preset.no_szo = opts.stride;
    preset.pro = opts.pro;
    preset.pro_alert = opts.pro && opts.proAlert;
    preset.pro_retry = opts.pro && opts.proRetry;
    preset.song = opts.song || basePreset.song || 'RANDOMcalm';
    preset.countdown = true;
    preset.countdown_interval = opts.stride ? 450 : 1000;
    preset.precountdown = opts.stride ? 0 : 3000;
    preset.prestart = opts.stride ? 250 : 1000;
    preset.zoominto = opts.stride ? 'fast' : 'slow';
    if (opts.pro) {
      preset.slot_counter4 = 'keys';
      preset.slot_counter5 = 'finesse';
    }
    return { preset, options: opts };
  }

  /**
   * Ensures first piece of initial bag avoids S, Z, and O when Stride no_szo is active.
   */
  function applyNoSzoFirstPiece(pool) {
    if (!Array.isArray(pool) || pool.length <= 3) return pool;
    const SZO = new Set(['S', 'Z', 'O']);
    if (!SZO.has(pool[0])) return pool;
    const safeIdx = pool.findIndex((k) => !SZO.has(k));
    if (safeIdx > 0) {
      const tmp = pool[0];
      pool[0] = pool[safeIdx];
      pool[safeIdx] = tmp;
    }
    return pool;
  }

  const exported = {
    SOLO_PB_STORAGE_KEY,
    SOLO_OPTS_STORAGE_KEY,
    SOLO_MUSIC_CHOICES,
    SOLO_MODE_SPECS,
    DEFAULT_MODE_OPTIONS,
    formatMsCompact,
    normalizeModeOptions,
    loadAllOptions,
    saveAllOptions,
    getPbStorageSlot,
    loadAllPbs,
    saveAllPbs,
    recordSoloResult,
    formatSoloPbDisplay,
    buildCustomLaunchConfig,
    applyNoSzoFirstPiece
  };

  root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
  root.__TWFOX_INTERNAL__.soloLobbyLogic = exported;

  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = exported;
  }
}(typeof globalThis !== 'undefined' ? globalThis : window));
