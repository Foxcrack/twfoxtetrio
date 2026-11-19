'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatTimeMs,
  parseTimeText,
  computeFortyLinesDelta,
  createFortyLinesTimerDetector
} = require('../src/features/forty-lines-logic');

test('formatTimeMs formats stopwatch milliseconds matching TETR.IO', () => {
  assert.equal(formatTimeMs(0), '0:00.000');
  assert.equal(formatTimeMs(17), '0:00.017');
  assert.equal(formatTimeMs(45320), '0:45.320');
  assert.equal(formatTimeMs(65009), '1:05.009');
  assert.equal(formatTimeMs(3665012), '1:01:05.012');
});

test('parseTimeText parses formatted 40 Lines PB strings safely', () => {
  assert.equal(parseTimeText('0:45.320'), 45320);
  assert.equal(parseTimeText('1:05.009'), 65009);
  assert.equal(parseTimeText('1:01:05.012'), 3665012);
  assert.equal(parseTimeText('42.5'), 42500);
  assert.equal(parseTimeText(''), 0);
  assert.equal(parseTimeText(null), 0);
});

test('computeFortyLinesDelta starts green counting down and turns red counting up at 0', () => {
  const start = computeFortyLinesDelta(45320, 0);
  assert.equal(start.state, 'ahead');
  assert.equal(start.over, false);
  assert.equal(start.formatted, '0:45.320');

  const mid = computeFortyLinesDelta(45320, 15120);
  assert.equal(mid.state, 'ahead');
  assert.equal(mid.over, false);
  assert.equal(mid.formatted, '0:30.200');

  const almostZero = computeFortyLinesDelta(45320, 45303);
  assert.equal(almostZero.state, 'ahead');
  assert.equal(almostZero.over, false);
  assert.equal(almostZero.formatted, '0:00.017');

  const exactZero = computeFortyLinesDelta(45320, 45320);
  assert.equal(exactZero.state, 'behind');
  assert.equal(exactZero.over, true);
  assert.equal(exactZero.formatted, '0:00.000');

  const over = computeFortyLinesDelta(45320, 45337);
  assert.equal(over.state, 'behind');
  assert.equal(over.over, true);
  assert.equal(over.formatted, '+0:00.017');

  const wayOver = computeFortyLinesDelta(45320, 52400);
  assert.equal(wayOver.state, 'behind');
  assert.equal(wayOver.over, true);
  assert.equal(wayOver.formatted, '+0:07.080');
});

test('computeFortyLinesDelta handles zero PB cleanly', () => {
  const atZero = computeFortyLinesDelta(0, 0);
  assert.equal(atZero.state, 'ahead');
  assert.equal(atZero.formatted, '0:00.000');

  const running = computeFortyLinesDelta(0, 12340);
  assert.equal(running.state, 'behind');
  assert.equal(running.formatted, '+0:12.340');
});

test('createFortyLinesTimerDetector extracts Bt(elapsed) across frames, minute rollovers, and quick-retries', () => {
  const detector = createFortyLinesTimerDetector();

  function emitUpdateTimersTick(ms, sec, ts) {
    // Unrelated UpdateVSStats padStart(2, '0') before UpdateTimers
    assert.equal(detector.observe('42', 2, '0', ts - 0.1), null);
    // Pair 1: Bt(n)
    assert.equal(detector.observe(String(ms), 3, '0', ts), null);
    const out = detector.observe(String(sec), 2, '0', ts + 0.01);
    // Pair 2 & 3: Bt(0)
    assert.equal(detector.observe('0', 3, '0', ts + 0.02), null);
    assert.equal(detector.observe('0', 2, '0', ts + 0.03), null);
    assert.equal(detector.observe('0', 3, '0', ts + 0.04), null);
    assert.equal(detector.observe('0', 2, '0', ts + 0.05), null);
    return out;
  }

  assert.equal(emitUpdateTimersTick(0, 0, 10), 0);
  assert.equal(emitUpdateTimersTick(17, 0, 26), 17);
  assert.equal(emitUpdateTimersTick(983, 59, 42), 59983);

  // Rollover into 1:00.000 then 1:05.250
  assert.equal(emitUpdateTimersTick(0, 0, 58), 60000);
  assert.equal(emitUpdateTimersTick(17, 0, 74), 60017);
  assert.equal(emitUpdateTimersTick(250, 5, 90), 65250);

  // Quick-retry (R) from 1:05.250 back to 0:00.000
  assert.equal(emitUpdateTimersTick(0, 0, 106), 0);
  assert.equal(emitUpdateTimersTick(0, 0, 122), 0);

  // Quick-retry right at 0:59.950 -> consecutive (0, 0) frames stay at 0
  assert.equal(emitUpdateTimersTick(950, 59, 138), 59950);
  assert.equal(emitUpdateTimersTick(0, 0, 154), 60000);
  assert.equal(emitUpdateTimersTick(0, 0, 170), 0);
});
