(function (root, factory) {
  const api = factory();
  root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
  root.__TWFOX_INTERNAL__.quickPlayLogic = api;
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const usNumberFormatter = new Intl.NumberFormat('en-US');

  /**
   * Formats a non-negative altitude in meters to 1 decimal place matching TETR.IO
   * (e.g. "3,262.7 M", or "3,262.7" when withUnit is false).
   *
   * @param {number} value
   * @param {boolean} [withUnit=true]
   * @returns {string}
   */
  function formatAltitude(value, withUnit) {
    const safe = Number.isFinite(value) && value > 0 ? value : 0;
    const tenths = Math.max(0, Math.round(safe * 10));
    const intPart = Math.floor(tenths / 10);
    const decPart = tenths % 10;
    const suffix = withUnit === false ? '' : ' M';
    return usNumberFormatter.format(intPart) + '.' + decPart + suffix;
  }

  /**
   * Parses an altitude string from TETR.IO's Zenith PB display (e.g. "3,262.7 M")
   * into a non-negative float in meters.
   *
   * @param {string|null|undefined} rawText
   * @returns {number}
   */
  function parseAltitudeText(rawText) {
    if (typeof rawText !== 'string') return 0;
    const cleaned = rawText.replace(/,/g, '');
    const match = cleaned.match(/(\d+(?:\.\d+)?)/);
    if (!match) return 0;
    const parsed = Number.parseFloat(match[1]);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 10) / 10 : 0;
  }

  // Exact TETR.IO Zenith Tower floor thresholds (ge.FloorDistance from tetrio.js, F1..F10)
  const ZENITH_FLOOR_DISTANCES = Object.freeze([
    0, 50, 150, 300, 450, 650, 850, 1100, 1350, 1650
  ]);

  /**
   * Computes normalized tick positions (0..1) for each Zenith floor threshold strictly
   * between 0 M and the player's Weekly PB altitude.
   *
   * @param {number} bestAltitude
   * @param {readonly number[]} [floorDistances]
   * @returns {Array<{ floor: number, altitude: number, ratio: number }>}
   */
  function computeFloorTicks(bestAltitude, floorDistances) {
    const best = Number(bestAltitude);
    if (!Number.isFinite(best) || best <= 0) {
      return [];
    }
    const distances = Array.isArray(floorDistances) && floorDistances.length > 0
      ? floorDistances
      : ZENITH_FLOOR_DISTANCES;
    const ticks = [];
    for (let i = 0; i < distances.length; i += 1) {
      const altitude = Number(distances[i]);
      if (!Number.isFinite(altitude) || altitude <= 0 || altitude >= best) {
        continue;
      }
      ticks.push({
        floor: i + 1,
        altitude,
        ratio: altitude / best
      });
    }
    return ticks;
  }

  /**
   * Computes Quick Play (Zenith Tower) Weekly PB pace HUD state:
   * - While currentTenths <= bestTenths: red digits counting down remaining meters
   *   and progressRatio advancing 0..1 on the vertical bar.
   * - Once currentTenths > bestTenths: green digits counting upward surplus meters
   *   with showBar = false so the vertical bar hides cleanly.
   *
   * @param {number} bestAltitude
   * @param {number} currentAltitude
   * @param {{ signedBehind?: boolean }} [options]
   */
  function computeQuickPlayDelta(bestAltitude, currentAltitude, options) {
    const opts = options || {};
    const bestTenths = Math.max(0, Math.round((Number(bestAltitude) || 0) * 10));
    const currentTenths = Math.max(0, Math.round((Number(currentAltitude) || 0) * 10));
    const best = bestTenths / 10;
    const current = currentTenths / 10;
    const surpassed = currentTenths > bestTenths;

    if (surpassed) {
      const surplus = (currentTenths - bestTenths) / 10;
      return {
        best,
        current,
        delta: surplus,
        surpassed: true,
        showBar: false,
        progressRatio: 1,
        state: 'ahead',
        formatted: '+' + formatAltitude(surplus, true),
        formattedBest: formatAltitude(best, true),
        formattedCurrent: formatAltitude(current, true)
      };
    }

    const remaining = (bestTenths - currentTenths) / 10;
    const prefix = opts.signedBehind && remaining > 0 ? '-' : '';
    const progressRatio = bestTenths > 0 ? Math.max(0, Math.min(1, currentTenths / bestTenths)) : 0;

    return {
      best,
      current,
      delta: remaining,
      surpassed: false,
      showBar: true,
      progressRatio,
      state: 'behind',
      formatted: prefix + formatAltitude(remaining, true),
      formattedBest: formatAltitude(best, true),
      formattedCurrent: formatAltitude(current, true)
    };
  }

  return {
    ZENITH_FLOOR_DISTANCES,
    formatAltitude,
    parseAltitudeText,
    computeFloorTicks,
    computeQuickPlayDelta
  };
}));
