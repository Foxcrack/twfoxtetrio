'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computePlayerVs,
  formatVs,
  sortLeaderboardEntries,
  createMultiplayerRosterTracker
} = require('../src/features/multiplayer-logic');

test('computePlayerVs matches TETR.IO VS formula and handles countdown/zero states', () => {
  const stats = { piecesplaced: 50, garbage: { attack: 20, cleared: 10 } };
  assert.equal(computePlayerVs(stats, 0, false), 0);
  assert.equal(computePlayerVs(stats, 600, true), 0);

  // 600 frames = 10 seconds -> (20 + 10) / 10 * 100 = 300.00 VS
  assert.equal(computePlayerVs(stats, 600, false), 300);

  // 1800 frames = 30 seconds -> (20 + 10) / 30 * 100 = 100.00 VS
  assert.equal(computePlayerVs(stats, 1800, false), 100);

  assert.equal(computePlayerVs({ piecesplaced: 0, garbage: { attack: 0, cleared: 0 } }, 600, false), 0);
});

test('formatVs formats VS score to 2 decimal places', () => {
  assert.equal(formatVs(0), '0.00');
  assert.equal(formatVs(142.346), '142.35');
  assert.equal(formatVs(-5), '0.00');
});

test('sortLeaderboardEntries orders highest VS first with deterministic tie-breakers', () => {
  const sorted = sortLeaderboardEntries([
    { id: '1', username: 'charlie', vs: 80.5, alive: true, isSelf: false },
    { id: '2', username: 'alice', vs: 140.25, alive: true, isSelf: false },
    { id: '3', username: 'bob', vs: 140.25, alive: false, isSelf: false },
    { id: '4', username: 'fox', vs: 112.0, alive: true, isSelf: true }
  ]);

  assert.deepEqual(
    sorted.map((e) => e.username),
    ['alice', 'bob', 'fox', 'charlie']
  );
});

test('createMultiplayerRosterTracker tracks live VS, keeps KO players frozen, and resets on new round', () => {
  const tracker = createMultiplayerRosterTracker();

  function makeFakeGame(id, username, attack, cleared, pieces, frame) {
    return {
      id,
      getOwner: () => username,
      getFrame: () => frame,
      isPlaying: () => true,
      state: {
        time: { zero: false, frameoffset: 0 },
        stats: { piecesplaced: pieces, garbage: { attack, cleared } }
      }
    };
  }

  const round1Map = new Map();
  const gSelf = makeFakeGame('g1', 'fox', 10, 5, 30, 600); // 150.00 VS
  const gOpp = makeFakeGame('g2', 'rival', 20, 4, 40, 600); // 240.00 VS
  round1Map.self = gSelf;

  tracker.observeMapSet(round1Map, 'g1', gSelf);
  round1Map.set('g1', gSelf);
  tracker.observeMapSet(round1Map, 'g2', gOpp);
  round1Map.set('g2', gOpp);

  let lb = tracker.sample('fox');
  assert.deepEqual(lb.map((e) => [e.username, formatVs(e.vs), e.alive, e.isSelf]), [
    ['rival', '240.00', true, false],
    ['fox', '150.00', true, true]
  ]);

  // Fox surges ahead, rival gets KO'd and detached from round1Map
  gSelf.state.stats.garbage.attack = 28; // 33 / 15s * 100 = 220.00 VS
  gSelf.getFrame = () => 900;
  round1Map.delete('g2');

  lb = tracker.sample('fox');
  assert.deepEqual(lb.map((e) => [e.username, formatVs(e.vs), e.alive, e.isSelf]), [
    ['rival', '240.00', false, false],
    ['fox', '220.00', true, true]
  ]);

  // New round creates a fresh Ja Map -> resets previous KO players
  const round2Map = new Map();
  const gSelfR2 = makeFakeGame('g3', 'fox', 0, 0, 0, 0);
  round2Map.self = gSelfR2;
  round2Map.set('g3', gSelfR2);
  tracker.observeMapSet(round2Map, 'g3', gSelfR2);

  lb = tracker.sample('fox');
  assert.equal(lb.length, 1);
  assert.equal(lb[0].username, 'fox');
  assert.equal(lb[0].vs, 0);
});
