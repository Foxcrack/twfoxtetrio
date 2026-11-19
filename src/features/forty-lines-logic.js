(function (root, factory) {
  const api = factory();
  root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
  root.__TWFOX_INTERNAL__.fortyLinesLogic = api;
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function pad3(n) {
    if (n < 10) return '00' + n;
    if (n < 100) return '0' + n;
    return String(n);
  }

  /**
   * Formats milliseconds using TETR.IO's stopwatch format (m:ss.mmm, or h:mm:ss.mmm if >= 60m).
   *
   * @param {number} ms
   * @returns {string}
   */
  function formatTimeMs(ms) {
    const total = Math.max(0, Math.round(Number(ms) || 0));
    const millis = total % 1000;
    const secs = Math.floor(total / 1000) % 60;
    const totalMins = Math.floor(total / 60000);

    if (totalMins >= 60) {
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      return hours + ':' + pad2(mins) + ':' + pad2(secs) + '.' + pad3(millis);
    }

    return totalMins + ':' + pad2(secs) + '.' + pad3(millis);
  }

  /**
   * Parses TETR.IO formatted time text (e.g. "0:45.320" or "1:02:05.120") into milliseconds.
   *
   * @param {string|null|undefined} rawText
   * @returns {number}
   */
  function parseTimeText(rawText) {
    if (typeof rawText !== 'string') return 0;
    const cleaned = rawText.trim().replace(/\s+/g, '');
    if (!cleaned) return 0;

    const match = cleaned.match(/^(?:(\d+):)?(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/);
    if (match) {
      const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
      const mins = Number.parseInt(match[2], 10);
      const secs = Number.parseInt(match[3], 10);
      const msStr = (match[4] || '0').padEnd(3, '0').slice(0, 3);
      const ms = Number.parseInt(msStr, 10);
      return ((hours * 60 + mins) * 60 + secs) * 1000 + ms;
    }

    const secsMatch = cleaned.match(/^(\d+)(?:\.(\d{1,3}))?$/);
    if (secsMatch) {
      const secs = Number.parseInt(secsMatch[1], 10);
      const msStr = (secsMatch[2] || '0').padEnd(3, '0').slice(0, 3);
      const ms = Number.parseInt(msStr, 10);
      return secs * 1000 + ms;
    }

    return 0;
  }

  /**
   * Computes the 40 Lines PB pace HUD state.
   *
   * Rules:
   * - Starts at bestMs in GREEN ('ahead') and counts DOWN toward 0:00.000.
   * - As soon as elapsedMs reaches/exceeds bestMs (0:00.000), turns RED ('behind')
   *   and counts UP (+0:00.017, +0:01.250, ...).
   *
   * @param {number} bestMs
   * @param {number} elapsedMs
   * @returns {{
   *   bestMs: number,
   *   elapsedMs: number,
   *   deltaMs: number,
   *   over: boolean,
   *   state: 'ahead' | 'behind',
   *   formatted: string,
   *   formattedBest: string,
   *   formattedElapsed: string
   * }}
   */
  function computeFortyLinesDelta(bestMs, elapsedMs) {
    const best = Math.max(0, Math.round(Number(bestMs) || 0));
    const elapsed = Math.max(0, Math.round(Number(elapsedMs) || 0));

    if (best > 0) {
      if (elapsed < best) {
        const remaining = best - elapsed;
        return {
          bestMs: best,
          elapsedMs: elapsed,
          deltaMs: remaining,
          over: false,
          state: 'ahead',
          formatted: formatTimeMs(remaining),
          formattedBest: formatTimeMs(best),
          formattedElapsed: formatTimeMs(elapsed)
        };
      }

      const over = elapsed - best;
      return {
        bestMs: best,
        elapsedMs: elapsed,
        deltaMs: over,
        over: true,
        state: 'behind',
        formatted: (over > 0 ? '+' : '') + formatTimeMs(over),
        formattedBest: formatTimeMs(best),
        formattedElapsed: formatTimeMs(elapsed)
      };
    }

    if (elapsed === 0) {
      return {
        bestMs: 0,
        elapsedMs: 0,
        deltaMs: 0,
        over: false,
        state: 'ahead',
        formatted: formatTimeMs(0),
        formattedBest: formatTimeMs(0),
        formattedElapsed: formatTimeMs(0)
      };
    }

    return {
      bestMs: 0,
      elapsedMs: elapsed,
      deltaMs: elapsed,
      over: true,
      state: 'behind',
      formatted: '+' + formatTimeMs(elapsed),
      formattedBest: formatTimeMs(0),
      formattedElapsed: formatTimeMs(elapsed)
    };
  }

  /**
   * Detects live stopwatch elapsed time emitted by TETR.IO's UpdateTimers(),
   * which formats Bt(elapsedMs) via String.prototype.padStart(3, '0') + padStart(2, '0'),
   * followed immediately by two Bt(0) pairs (for timer=0 when objective_time=0 in 40 Lines).
   *
   * @param {{ maxPairGapMs?: number, maxTickGapMs?: number }} [options]
   */
  function createFortyLinesTimerDetector(options) {
    const maxPairGapMs = options && typeof options.maxPairGapMs === 'number' ? options.maxPairGapMs : 1.5;
    const maxTickGapMs = options && typeof options.maxTickGapMs === 'number' ? options.maxTickGapMs : 2.0;

    let pendingMs = null;
    let pendingMsTime = -Infinity;

    let pairIndexInTick = 0;
    let lastPairTime = -Infinity;

    let minutes = 0;
    let lastSec = 0;
    let lastMs = 0;
    let zeroStreak = 0;

    return {
      reset() {
        pendingMs = null;
        pendingMsTime = -Infinity;
        pairIndexInTick = 0;
        lastPairTime = -Infinity;
        minutes = 0;
        lastSec = 0;
        lastMs = 0;
        zeroStreak = 0;
      },

      /**
       * @param {string} strVal
       * @param {number} maxLength
       * @param {string} fillString
       * @param {number} timestamp
       * @returns {number|null} Confirmed elapsed time in milliseconds, or null.
       */
      observe(strVal, maxLength, fillString, timestamp) {
        if (fillString !== '0') return null;

        if (maxLength === 3) {
          const parsedMs = Number.parseInt(strVal, 10);
          if (Number.isInteger(parsedMs) && parsedMs >= 0 && parsedMs < 1000) {
            pendingMs = parsedMs;
            pendingMsTime = timestamp;
          }
          return null;
        }

        if (maxLength !== 2 || pendingMs === null) {
          return null;
        }

        if (timestamp - pendingMsTime > maxPairGapMs) {
          pendingMs = null;
          return null;
        }

        const ms = pendingMs;
        pendingMs = null;

        const sec = Number.parseInt(strVal, 10);
        if (!Number.isInteger(sec) || sec < 0 || sec >= 60) {
          return null;
        }

        if (timestamp - lastPairTime > maxTickGapMs) {
          pairIndexInTick = 0;
        }

        if (pairIndexInTick === 1 && ms === 0 && sec === 0) {
          pairIndexInTick = 2;
          lastPairTime = timestamp;
          return null;
        }

        if (pairIndexInTick === 2 && ms === 0 && sec === 0) {
          pairIndexInTick = 0;
          lastPairTime = timestamp;
          return null;
        }

        pairIndexInTick = 1;
        lastPairTime = timestamp;

        if (ms === 0 && sec === 0) {
          zeroStreak++;
          if (lastSec === 59 && lastMs >= 800 && zeroStreak === 1) {
            minutes++;
            lastSec = 0;
            lastMs = 0;
          } else {
            minutes = 0;
            lastSec = 0;
            lastMs = 0;
          }
        } else {
          zeroStreak = 0;
          if (lastSec >= 50 && sec <= 10) {
            minutes++;
          }
          lastSec = sec;
          lastMs = ms;
        }

        return (minutes * 60 + sec) * 1000 + ms;
      }
    };
  }

  return {
    formatTimeMs,
    parseTimeText,
    computeFortyLinesDelta,
    createFortyLinesTimerDetector
  };
}));
