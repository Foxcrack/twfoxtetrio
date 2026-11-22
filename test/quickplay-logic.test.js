'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatAltitude,
  parseAltitudeText,
  computeQuickPlayDelta
} = require('../src/features/quickplay-logic');

test('parseAltitudeText parses formatted Zenith altitude strings cleanly', () => {
  assert.equal(parseAltitudeText('3,262.7 M'), 3262.7);
  assert.equal(parseAltitudeText('450.2M'), 450.2);
  assert.equal(parseAltitudeText('1200'), 1200);
  assert.equal(parseAltitudeText('0.0 M'), 0);
  assert.equal(parseAltitudeText(''), 0);
  assert.equal(parseAltitudeText(null), 0);
});

test('formatAltitude formats altitude with 1 decimal and US separators', () => {
  assert.equal(formatAltitude(0), '0.0 M');
  assert.equal(formatAltitude(3262.7), '3,262.7 M');
  assert.equal(formatAltitude(3262.7, false), '3,262.7');
  assert.equal(formatAltitude(-5), '0.0 M');
});

test('computeQuickPlayDelta counts down with bar visible while behind Weekly PB', () => {
  const start = computeQuickPlayDelta(1000, 0);
  assert.equal(start.state, 'behind');
  assert.equal(start.surpassed, false);
  assert.equal(start.showBar, true);
  assert.equal(start.progressRatio, 0);
  assert.equal(start.formatted, '1,000.0 M');

  const mid = computeQuickPlayDelta(1000, 750);
  assert.equal(mid.state, 'behind');
  assert.equal(mid.showBar, true);
  assert.equal(mid.progressRatio, 0.75);
  assert.equal(mid.formatted, '250.0 M');

  const signed = computeQuickPlayDelta(1000, 750, { signedBehind: true });
  assert.equal(signed.formatted, '-250.0 M');

  const tied = computeQuickPlayDelta(1000, 1000);
  assert.equal(tied.state, 'behind');
  assert.equal(tied.surpassed, false);
  assert.equal(tied.showBar, true);
  assert.equal(tied.progressRatio, 1);
  assert.equal(tied.formatted, '0.0 M');
});

test('computeQuickPlayDelta turns green, counts up, and hides bar once Weekly PB is surpassed', () => {
  const ahead = computeQuickPlayDelta(1000, 1142.3);
  assert.equal(ahead.state, 'ahead');
  assert.equal(ahead.surpassed, true);
  assert.equal(ahead.showBar, false);
  assert.equal(ahead.progressRatio, 1);
  assert.equal(ahead.formatted, '+142.3 M');

  const noPbStart = computeQuickPlayDelta(0, 0);
  assert.equal(noPbStart.state, 'behind');
  assert.equal(noPbStart.showBar, true);

  const noPbClimb = computeQuickPlayDelta(0, 42.5);
  assert.equal(noPbClimb.state, 'ahead');
  assert.equal(noPbClimb.showBar, false);
  assert.equal(noPbClimb.formatted, '+42.5 M');
});
