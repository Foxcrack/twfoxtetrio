'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatScore,
  parseScoreText,
  computeBlitzDelta,
  createDoubleCallScoreDetector
} = require('../src/features/blitz-logic');

test('parseScoreText parses formatted TETR.IO scores safely', () => {
  assert.equal(parseScoreText('142,500'), 142500);
  assert.equal(parseScoreText('1.234.567'), 1234567);
  assert.equal(parseScoreText('0'), 0);
  assert.equal(parseScoreText(''), 0);
  assert.equal(parseScoreText(null), 0);
  assert.equal(parseScoreText(undefined), 0);
});

test('formatScore formats integers with en-US commas', () => {
  assert.equal(formatScore(0), '0');
  assert.equal(formatScore(950), '950');
  assert.equal(formatScore(142500), '142,500');
});

test('computeBlitzDelta shows (best - current) in red when behind or tied', () => {
  const start = computeBlitzDelta(100000, 0);
  assert.equal(start.state, 'behind');
  assert.equal(start.surpassed, false);
  assert.equal(start.delta, 100000);
  assert.equal(start.formatted, '100,000');

  const mid = computeBlitzDelta(100000, 42500);
  assert.equal(mid.state, 'behind');
  assert.equal(mid.surpassed, false);
  assert.equal(mid.delta, 57500);
  assert.equal(mid.formatted, '57,500');

  const tied = computeBlitzDelta(100000, 100000);
  assert.equal(tied.state, 'behind');
  assert.equal(tied.surpassed, false);
  assert.equal(tied.delta, 0);
  assert.equal(tied.formatted, '0');
});

test('computeBlitzDelta supports signedBehind display option', () => {
  const behind = computeBlitzDelta(100000, 40000, { signedBehind: true });
  assert.equal(behind.formatted, '-60,000');

  const tied = computeBlitzDelta(100000, 100000, { signedBehind: true });
  assert.equal(tied.formatted, '0');

  const ahead = computeBlitzDelta(100000, 102500, { signedBehind: true });
  assert.equal(ahead.formatted, '+2,500');
});

test('computeBlitzDelta turns green and adds upward once current > best', () => {
  const justPassed = computeBlitzDelta(100000, 100001);
  assert.equal(justPassed.state, 'ahead');
  assert.equal(justPassed.surpassed, true);
  assert.equal(justPassed.delta, 1);
  assert.equal(justPassed.formatted, '+1');

  const climbing = computeBlitzDelta(100000, 118450);
  assert.equal(climbing.state, 'ahead');
  assert.equal(climbing.surpassed, true);
  assert.equal(climbing.delta, 18450);
  assert.equal(climbing.formatted, '+18,450');

  const zeroPbStart = computeBlitzDelta(0, 0);
  assert.equal(zeroPbStart.state, 'behind');
  assert.equal(zeroPbStart.formatted, '0');

  const zeroPbScored = computeBlitzDelta(0, 240);
  assert.equal(zeroPbScored.state, 'ahead');
  assert.equal(zeroPbScored.formatted, '+240');
});

test('createDoubleCallScoreDetector confirms UpdateCounts score pairs and ignores stray calls', () => {
  const detector = createDoubleCallScoreDetector({ maxGapMs: 2.5 });

  // Frame 1: score=0, pieces=0 -> 0, 0, 0
  assert.equal(detector.observe(0, 'en-US', 10.0), null);
  assert.equal(detector.observe(0, 'en-US', 10.05), 0);
  assert.equal(detector.observe(0, 'en-US', 10.1), null);

  // Stray non-US or unrelated single call between frames
  assert.equal(detector.observe(999999, 'de-DE', 15.0), null);
  assert.equal(detector.observe(88888, 'en-US', 20.0), null);

  // Frame 2 (16ms later): score=240, pieces=2 -> 240, 240, 120
  assert.equal(detector.observe(240, 'en-US', 26.0), null);
  assert.equal(detector.observe(240, 'en-US', 26.05), 240);
  assert.equal(detector.observe(120, 'en-US', 26.1), null);

  // Frame 3 (high refresh rate 1ms later!): softdrop +2 -> 242, 242, 121
  assert.equal(detector.observe(242, 'en-US', 27.1), null);
  assert.equal(detector.observe(242, 'en-US', 27.12), 242);
  assert.equal(detector.observe(121, 'en-US', 27.14), null);

  // Quick-retry (R) resets score to 0
  assert.equal(detector.observe(0, 'en-US', 43.0), null);
  assert.equal(detector.observe(0, 'en-US', 43.02), 0);
  assert.equal(detector.observe(0, 'en-US', 43.04), null);
});
