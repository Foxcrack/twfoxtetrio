const test = require('node:test');
const assert = require('node:assert/strict');

const raceLogic = require('../src/features/race-logic');

test('race-logic enforces 2..4 player ready checks, floor mapping, and target switching', () => {
  assert.equal(raceLogic.MAX_RACE_PLAYERS, 4);
  assert.equal(raceLogic.MIN_RACE_PLAYERS, 2);

  // Only 1 player ready -> cannot launch
  assert.equal(
    raceLogic.areAllRacePlayersReady([{ id: 'host', name: 'A', ready: true }]),
    false
  );

  // 4 players connected, 3 ready and 1 unready -> cannot launch
  const fourPlayers = [
    { id: 'host', name: 'HostFox', ready: true, alive: true, altitude: 120 },
    { id: 'p2', name: 'Runner2', ready: true, alive: true, altitude: 340 },
    { id: 'p3', name: 'Runner3', ready: true, alive: true, altitude: 210 },
    { id: 'p4', name: 'Runner4', ready: false, alive: true, altitude: 90 }
  ];
  assert.equal(raceLogic.areAllRacePlayersReady(fourPlayers), false);

  // Once 4th clicks ready -> all 4 ready
  fourPlayers[3].ready = true;
  assert.equal(raceLogic.areAllRacePlayersReady(fourPlayers), true);

  // 5 players exceeds cap -> false
  const fivePlayers = fourPlayers.concat({ id: 'p5', name: 'Extra', ready: true, alive: true });
  assert.equal(raceLogic.areAllRacePlayersReady(fivePlayers), false);

  // Dead player auto-picks highest-altitude living opponent, preserves valid switch, returns null when all dead
  fourPlayers[0].alive = false;
  const autoTarget = raceLogic.pickNextAliveTarget(fourPlayers, 'host', null);
  assert.equal(autoTarget.id, 'p2');
  const switched = raceLogic.pickNextAliveTarget(fourPlayers, 'host', 'p3');
  assert.equal(switched.id, 'p3');

  fourPlayers[1].alive = false;
  fourPlayers[2].alive = false;
  fourPlayers[3].alive = false;
  assert.equal(raceLogic.pickNextAliveTarget(fourPlayers, 'host', 'p3'), null);

  // Standings rank by peak altitude descending -> p2 (340), p3 (210), HostFox (120), Runner4 (90)
  const standings = raceLogic.computeRaceStandings(fourPlayers, [], 1000, 61000);
  assert.deepEqual(
    standings.map((s) => `${s.placement}:${s.name}:${s.altitude}`),
    ['1:Runner2:340', '2:Runner3:210', '3:HostFox:120', '4:Runner4:90']
  );

  // Floor helper accuracy
  assert.equal(raceLogic.computeFloorFromAltitude(0).floor, 1);
  assert.equal(raceLogic.computeFloorFromAltitude(320).floor, 4);
  assert.equal(raceLogic.computeFloorFromAltitude(1700).floor, 10);
});

test('race-logic normalizes full 40x10 TETR.IO board + active falling piece safely to 20x10', () => {
  const fullBoard = [];
  for (let y = 0; y < 40; y++) {
    fullBoard.push(new Array(10).fill(null));
  }
  fullBoard[39][0] = 'z';
  fullBoard[39][1] = 'gb';

  const compact = raceLogic.normalizeCompactBoard(
    fullBoard,
    { type: 't', x: 3, y: 25, r: 0 },
    20
  );
  assert.equal(compact.length, 20);
  assert.equal(compact[19][0], 'z');
  assert.equal(compact[19][1], 'gb');
  // T spawn rot 0 cells: [1,0], [0,1], [1,1], [2,1] at (3, 25 - 20 = 5)
  assert.equal(compact[5][4], 't');
  assert.equal(compact[6][3], 't');
  assert.equal(compact[6][4], 't');
  assert.equal(compact[6][5], 't');

  const art = raceLogic.buildRaceCardArtUrls();
  assert.ok(art.frontUrl.startsWith('data:image/svg+xml'));
  assert.ok(art.backUrl.startsWith('data:image/svg+xml'));
});
