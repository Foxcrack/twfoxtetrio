(function (root, factory) {
  const api = factory();
  root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
  root.__TWFOX_INTERNAL__.blitzLogic = api;
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const usNumberFormatter = new Intl.NumberFormat('en-US');

  /**
   * Formats a non-negative integer using US thousands separators.
   * Uses a dedicated Intl.NumberFormat instance to avoid re-entering
   * any Number.prototype.toLocaleString hook.
   *
   * @param {number} value
   * @returns {string}
   */
  function formatScore(value) {
    const safe = Number.isFinite(value) ? Math.trunc(value) : 0;
    return usNumberFormatter.format(safe);
  }

  /**
   * Extracts a non-negative integer score from formatted DOM text such as "142,500".
   *
   * @param {string|null|undefined} rawText
   * @returns {number}
   */
  function parseScoreText(rawText) {
    if (typeof rawText !== 'string') return 0;
    const digits = rawText.replace(/[^0-9]/g, '');
    if (!digits) return 0;
    const parsed = Number.parseInt(digits, 10);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  }

  /**
   * Computes the Blitz personal-best delta HUD state.
   *
   * Rules:
   * - While currentScore <= bestScore: not yet surpassed -> RED, displaying (bestScore - currentScore).
   *   (Optionally prefixed with '-' if signedBehind is enabled.)
   * - Once currentScore > bestScore: surpassed -> GREEN, displaying +(currentScore - bestScore)
   *   and counting upward as points are added.
   *
   * @param {number} bestScore
   * @param {number} currentScore
   * @param {{ signedBehind?: boolean }} [options]
   * @returns {{
   *   best: number,
   *   current: number,
   *   delta: number,
   *   surpassed: boolean,
   *   state: 'behind' | 'ahead',
   *   formatted: string,
   *   formattedBest: string,
   *   formattedCurrent: string
   * }}
   */
  function computeBlitzDelta(bestScore, currentScore, options) {
    const opts = options || {};
    const best = Math.max(0, Math.floor(Number(bestScore) || 0));
    const current = Math.max(0, Math.floor(Number(currentScore) || 0));
    const surpassed = current > best;

    if (surpassed) {
      const surplus = current - best;
      return {
        best,
        current,
        delta: surplus,
        surpassed: true,
        state: 'ahead',
        formatted: '+' + formatScore(surplus),
        formattedBest: formatScore(best),
        formattedCurrent: formatScore(current)
      };
    }

    const remaining = best - current;
    const prefix = opts.signedBehind && remaining > 0 ? '-' : '';
    return {
      best,
      current,
      delta: remaining,
      surpassed: false,
      state: 'behind',
      formatted: prefix + formatScore(remaining),
      formattedBest: formatScore(best),
      formattedCurrent: formatScore(current)
    };
  }

  /**
   * Detects live score updates emitted synchronously by TETR.IO's UpdateCounts(),
   * which calls score.toLocaleString('en-US') twice back-to-back (for "score" and "spp").
   *
   * @param {{ maxGapMs?: number }} [options]
   */
  function createDoubleCallScoreDetector(options) {
    const maxGapMs = options && typeof options.maxGapMs === 'number' ? options.maxGapMs : 2.5;
    let lastCandidate = null;
    let lastTimestamp = -Infinity;

    return {
      reset() {
        lastCandidate = null;
        lastTimestamp = -Infinity;
      },

      /**
       * @param {number} value
       * @param {string} locale
       * @param {number} timestamp
       * @returns {number|null} Confirmed score if paired synchronously, otherwise null.
       */
      observe(value, locale, timestamp) {
        if (locale !== 'en-US') return null;
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || !Number.isFinite(value)) {
          return null;
        }

        const gap = timestamp - lastTimestamp;
        if (lastCandidate === value && gap >= 0 && gap <= maxGapMs) {
          lastCandidate = null;
          lastTimestamp = -Infinity;
          return value;
        }

        lastCandidate = value;
        lastTimestamp = timestamp;
        return null;
      }
    };
  }

  return {
    formatScore,
    parseScoreText,
    computeBlitzDelta,
    createDoubleCallScoreDetector
  };
}));
