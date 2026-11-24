(function (root, factory) {
  const api = factory();
  root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
  root.__TWFOX_INTERNAL__.multiplayerLogic = api;
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  /**
   * Computes live TETR.IO VS Score using the same formula as UpdateVSStats() / siom.Export().
   *
   * @param {{ piecesplaced?: number, garbage?: { attack?: number, cleared?: number } } | null | undefined} stats
   * @param {number} elapsedFrames
   * @param {boolean} isZero
   * @returns {number}
   */
  function computePlayerVs(stats, elapsedFrames, isZero) {
    if (isZero || !stats || !Number.isFinite(elapsedFrames) || elapsedFrames <= 0) {
      return 0;
    }
    const seconds = elapsedFrames / 60;
    if (seconds <= 0) return 0;

    const attack = (stats.garbage && Number(stats.garbage.attack)) || 0;
    const cleared = (stats.garbage && Number(stats.garbage.cleared)) || 0;
    const pieces = Number(stats.piecesplaced) || 0;

    if (pieces <= 0 && attack <= 0 && cleared <= 0) {
      return 0;
    }

    const vs = ((attack + cleared) / Math.max(1, pieces)) * (pieces / seconds) * 100;
    return Number.isFinite(vs) && vs >= 0 ? vs : 0;
  }

  /**
   * Formats a VS score with two decimal places (e.g. "142.35").
   *
   * @param {number} vs
   * @returns {string}
   */
  function formatVs(vs) {
    const safe = Number.isFinite(vs) && vs >= 0 ? vs : 0;
    return safe.toFixed(2);
  }

  /**
   * Sorts leaderboard entries by highest VS first, breaking ties deterministically.
   *
   * @param {Array<{ id: string, username: string, vs: number, alive: boolean, isSelf: boolean }>} entries
   */
  function sortLeaderboardEntries(entries) {
    return entries.slice().sort(function (a, b) {
      if (b.vs !== a.vs) return b.vs - a.vs;
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      return a.username.localeCompare(b.username);
    });
  }

  function isGameWrapper(val) {
    return Boolean(
      val &&
      typeof val === 'object' &&
      typeof val.getOwner === 'function' &&
      typeof val.getFrame === 'function' &&
      val.state &&
      val.state.stats
    );
  }

  function isZenithScoreboardEntry(val) {
    return Boolean(
      val &&
      typeof val === 'object' &&
      typeof val.username === 'string' &&
      val.stats &&
      typeof val.stats.vsscore === 'number'
    );
  }

  function buildGameSnapshotEntry(gameWrapper, key, gamesMap, selfUsername) {
    const id = String(gameWrapper.id != null ? gameWrapper.id : key);
    let username = '';
    try {
      username = gameWrapper.getOwner() || '';
    } catch (_) {}
    if (!username && gamesMap && typeof gamesMap.getUsernameByID === 'function') {
      username = gamesMap.getUsernameByID(key) || '';
    }
    if (!username) {
      username = id;
    }

    const gState = gameWrapper.state || {};
    const time = gState.time || {};
    const isZero = Boolean(time.zero);
    const frameOffset = Number(time.frameoffset) || 0;
    let currentFrame = 0;
    try {
      currentFrame = Number(gameWrapper.getFrame()) || 0;
    } catch (_) {}
    const elapsedFrames = Math.max(0, currentFrame - frameOffset);

    const alive = typeof gameWrapper.isPlaying === 'function'
      ? Boolean(gameWrapper.isPlaying())
      : Boolean(gState.playing !== false);

    const normalizedSelf = typeof selfUsername === 'string' ? selfUsername.toLowerCase() : '';
    const isSelf = Boolean(
      (gamesMap && gamesMap.self === gameWrapper) ||
      (normalizedSelf && username.toLowerCase() === normalizedSelf)
    );

    return {
      id,
      username,
      vs: computePlayerVs(gState.stats, elapsedFrames, isZero),
      alive,
      isSelf
    };
  }

  /**
   * Tracks multiplayer round participants via TETR.IO's internal Ja games Map
   * (and optionally Zenith scoreboard Map), retaining eliminated players with
   * their frozen final VS score until the next round begins.
   */
  function createMultiplayerRosterTracker() {
    let activeGamesMap = null;
    let activeScoreboardMap = null;
    const roundPlayers = new Map();

    return {
      reset() {
        activeGamesMap = null;
        activeScoreboardMap = null;
        roundPlayers.clear();
      },

      observeMapSet(mapInstance, key, value) {
        if (isGameWrapper(value)) {
          if (mapInstance !== activeGamesMap) {
            activeGamesMap = mapInstance;
            roundPlayers.clear();
          }
          const entry = buildGameSnapshotEntry(value, key, activeGamesMap, null);
          roundPlayers.set(entry.id, entry);
          return true;
        }

        if (isZenithScoreboardEntry(value)) {
          activeScoreboardMap = mapInstance;
          return true;
        }

        return false;
      },

      sample(selfUsername, options) {
        const opts = options || {};
        const normalizedSelf = typeof selfUsername === 'string' ? selfUsername.toLowerCase() : '';

        if (opts.useScoreboard && activeScoreboardMap) {
          const list = [];
          for (const item of activeScoreboardMap.values()) {
            if (!item || typeof item.username !== 'string' || !item.stats) continue;
            list.push({
              id: String(item.gameid || item.id || item.username),
              username: item.username,
              vs: Number.isFinite(item.stats.vsscore) && item.stats.vsscore >= 0 ? item.stats.vsscore : 0,
              alive: Boolean(item.alive),
              isSelf: Boolean(normalizedSelf && item.username.toLowerCase() === normalizedSelf)
            });
          }
          return sortLeaderboardEntries(list);
        }

        if (!activeGamesMap) {
          return [];
        }

        const seenIds = new Set();
        for (const [key, gameWrapper] of activeGamesMap.entries()) {
          if (!isGameWrapper(gameWrapper)) continue;
          const entry = buildGameSnapshotEntry(gameWrapper, key, activeGamesMap, selfUsername);
          seenIds.add(entry.id);
          roundPlayers.set(entry.id, entry);
        }

        for (const [id, entry] of roundPlayers.entries()) {
          if (!seenIds.has(id)) {
            entry.alive = false;
            if (normalizedSelf && entry.username.toLowerCase() === normalizedSelf) {
              entry.isSelf = true;
            }
          }
        }

        return sortLeaderboardEntries(Array.from(roundPlayers.values()));
      },

      getSelfZenithState(selfUsername) {
        const normalizedSelf = typeof selfUsername === 'string' ? selfUsername.toLowerCase() : '';
        if (activeGamesMap) {
          let selfWrapper = activeGamesMap.self || null;
          if (!selfWrapper && normalizedSelf) {
            for (const [, gameWrapper] of activeGamesMap.entries()) {
              if (!isGameWrapper(gameWrapper)) continue;
              let owner = '';
              try {
                owner = gameWrapper.getOwner() || '';
              } catch (_) {}
              if (owner && owner.toLowerCase() === normalizedSelf) {
                selfWrapper = gameWrapper;
                break;
              }
            }
          }
          if (isGameWrapper(selfWrapper)) {
            const gState = selfWrapper.state || {};
            const zStats = gState.stats && gState.stats.zenith;
            let alt = NaN;
            if (typeof selfWrapper.getZenithAltitude === 'function') {
              alt = Number(selfWrapper.getZenithAltitude());
            } else if (zStats && typeof zStats.altitude === 'number') {
              alt = Number(zStats.altitude);
            }
            const setOpts = gState.setoptions || {};
            const isExpert = Boolean(
              setOpts.zenith_expert ||
              (Array.isArray(setOpts.zenith_mods) && setOpts.zenith_mods.includes('expert'))
            );
            const alive = typeof selfWrapper.isPlaying === 'function'
              ? Boolean(selfWrapper.isPlaying())
              : Boolean(gState.playing !== false);
            return {
              found: Number.isFinite(alt),
              altitude: Number.isFinite(alt) && alt >= 0 ? alt : 0,
              isExpert,
              alive
            };
          }
        }

        if (activeScoreboardMap && normalizedSelf) {
          for (const item of activeScoreboardMap.values()) {
            if (!item || typeof item.username !== 'string' || !item.stats) continue;
            if (item.username.toLowerCase() !== normalizedSelf) continue;
            const alt = Number(item.stats.altitude);
            if (Number.isFinite(alt) && alt >= 0) {
              return {
                found: true,
                altitude: alt,
                isExpert: Boolean(Array.isArray(item.mods) && item.mods.includes('expert')),
                alive: Boolean(item.alive)
              };
            }
          }
        }

        return { found: false, altitude: 0, isExpert: false, alive: false };
      },

      /**
       * Passively captures the local player's live Zenith state and compact 20x10 board
       * without mutating any TETR.IO state objects or interfering with gameplay.
       */
      getSelfZenithSnapshot(selfUsername) {
        const normalizedSelf = typeof selfUsername === 'string' ? selfUsername.toLowerCase() : '';
        if (!activeGamesMap) {
          return {
            found: false,
            alive: false,
            altitude: 0,
            floor: 1,
            isExpert: false,
            score: 0,
            lines: 0,
            pieces: 0,
            pps: 0,
            apm: 0,
            elapsedMs: 0,
            board: null,
            falling: null,
            bufferHeight: 20
          };
        }

        let selfWrapper = activeGamesMap.self || null;
        if (!selfWrapper && normalizedSelf) {
          for (const [, gameWrapper] of activeGamesMap.entries()) {
            if (!isGameWrapper(gameWrapper)) continue;
            let owner = '';
            try {
              owner = gameWrapper.getOwner() || '';
            } catch (_) {}
            if (owner && owner.toLowerCase() === normalizedSelf) {
              selfWrapper = gameWrapper;
              break;
            }
          }
        }

        if (!isGameWrapper(selfWrapper)) {
          const fallback = this.getSelfZenithState(selfUsername);
          return {
            ...fallback,
            floor: 1,
            score: 0,
            lines: 0,
            pieces: 0,
            pps: 0,
            apm: 0,
            elapsedMs: 0,
            board: null,
            falling: null,
            bufferHeight: 20
          };
        }

        const gState = selfWrapper.state || {};
        const stats = gState.stats || {};
        const zStats = stats.zenith || {};
        let alt = NaN;
        if (typeof selfWrapper.getZenithAltitude === 'function') {
          alt = Number(selfWrapper.getZenithAltitude());
        } else if (typeof zStats.altitude === 'number') {
          alt = Number(zStats.altitude);
        }
        const safeAlt = Number.isFinite(alt) && alt >= 0 ? Math.round(alt * 10) / 10 : 0;
        const floor = Math.max(1, Math.min(10, Math.floor(Number(zStats.floor) || 1)));
        const setOpts = gState.setoptions || {};
        const isExpert = Boolean(
          setOpts.zenith_expert ||
          (Array.isArray(setOpts.zenith_mods) && setOpts.zenith_mods.includes('expert'))
        );
        const alive = typeof selfWrapper.isPlaying === 'function'
          ? Boolean(selfWrapper.isPlaying())
          : Boolean(gState.playing !== false);

        let rawBoard = Array.isArray(gState.board) ? gState.board : null;
        if (!rawBoard && typeof selfWrapper.ejectBoardState === 'function') {
          try {
            rawBoard = selfWrapper.ejectBoardState();
          } catch (_) {}
        }

        const falling = gState.falling && typeof gState.falling === 'object'
          ? {
              type: gState.falling.type || '',
              x: Number(gState.falling.x) || 0,
              y: Number(gState.falling.y) || 0,
              r: Number(gState.falling.r) || 0
            }
          : null;

        let currentFrame = 0;
        try {
          currentFrame = Number(selfWrapper.getFrame()) || 0;
        } catch (_) {}
        const frameOffset = Number(gState.time && gState.time.frameoffset) || 0;
        const elapsedFrames = Math.max(0, currentFrame - frameOffset);
        const elapsedSec = elapsedFrames / 60;
        const pieces = Number(stats.piecesplaced) || 0;
        const attack = (stats.garbage && Number(stats.garbage.attack)) || 0;
        const pps = elapsedSec > 0 ? pieces / elapsedSec : 0;
        const apm = elapsedSec > 0 ? (attack * 60) / elapsedSec : 0;
        const bufferHeight = Number.isFinite(Number(setOpts.boardbuffer))
          ? Number(setOpts.boardbuffer)
          : (Array.isArray(gState.board) ? Math.max(0, gState.board.length - (Number(setOpts.boardheight) || 20)) : 0);

        return {
          found: Number.isFinite(alt),
          alive,
          altitude: safeAlt,
          floor,
          isExpert,
          score: Number(stats.score) || 0,
          lines: Number(stats.lines) || 0,
          pieces,
          pps: Number.isFinite(pps) ? pps : 0,
          apm: Number.isFinite(apm) ? apm : 0,
          elapsedMs: Math.round(elapsedFrames * (1000 / 60)),
          board: rawBoard,
          falling,
          bufferHeight
        };
      }
    };
  }

  return {
    computePlayerVs,
    formatVs,
    sortLeaderboardEntries,
    createMultiplayerRosterTracker
  };
}));
