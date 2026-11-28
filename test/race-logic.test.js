const test = require('node:test');
const assert = require('node:assert/strict');

const raceLogic = require('../src/features/race-logic');

test('race-logic enforces 2..5 player ready checks, floor mapping, and target switching', () => {
  assert.equal(raceLogic.MAX_RACE_PLAYERS, 5);
  assert.equal(raceLogic.MIN_RACE_PLAYERS, 2);

  // Only 1 player ready -> cannot launch
  assert.equal(
    raceLogic.areAllRacePlayersReady([{ id: 'host', name: 'A', ready: true }]),
    false
  );

  // 5 players connected, 4 ready and 1 unready -> cannot launch
  const fivePlayers = [
    { id: 'host', name: 'HostFox', ready: true, alive: true, altitude: 120 },
    { id: 'p2', name: 'Runner2', ready: true, alive: true, altitude: 340 },
    { id: 'p3', name: 'Runner3', ready: true, alive: true, altitude: 210 },
    { id: 'p4', name: 'Runner4', ready: true, alive: true, altitude: 90 },
    { id: 'p5', name: 'Runner5', ready: false, alive: true, altitude: 50 }
  ];
  assert.equal(raceLogic.areAllRacePlayersReady(fivePlayers), false);

  // Once 5th clicks ready -> all 5 ready
  fivePlayers[4].ready = true;
  assert.equal(raceLogic.areAllRacePlayersReady(fivePlayers), true);

  // 6 players exceeds cap -> false
  const sixPlayers = fivePlayers.concat({ id: 'p6', name: 'Extra', ready: true, alive: true });
  assert.equal(raceLogic.areAllRacePlayersReady(sixPlayers), false);

  // Dead player auto-picks highest-altitude living opponent, preserves valid switch, returns null when all dead
  fivePlayers[0].alive = false;
  const autoTarget = raceLogic.pickNextAliveTarget(fivePlayers, 'host', null);
  assert.equal(autoTarget.id, 'p2');
  const switched = raceLogic.pickNextAliveTarget(fivePlayers, 'host', 'p3');
  assert.equal(switched.id, 'p3');

  fivePlayers[1].alive = false;
  fivePlayers[2].alive = false;
  fivePlayers[3].alive = false;
  fivePlayers[4].alive = false;
  assert.equal(raceLogic.pickNextAliveTarget(fivePlayers, 'host', 'p3'), null);

  // Standings rank by peak altitude descending -> p2 (340), p3 (210), HostFox (120), Runner4 (90), Runner5 (50)
  const standings = raceLogic.computeRaceStandings(fivePlayers, [], 1000, 61000);
  assert.deepEqual(
    standings.map((s) => `${s.placement}:${s.name}:${s.altitude}`),
    ['1:Runner2:340', '2:Runner3:210', '3:HostFox:120', '4:Runner4:90', '5:Runner5:50']
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

test('race-logic sanitizes held piece and next queue up to 5 pieces', () => {
  assert.equal(raceLogic.sanitizePieceKey('T'), 't');
  assert.equal(raceLogic.sanitizePieceKey({ type: 'I' }), 'i');
  assert.equal(raceLogic.sanitizePieceKey('invalid'), null);
  assert.deepEqual(
    raceLogic.sanitizeNextQueue(['i', { type: 'T' }, 'bad', 'o', 's', 'z', 'j']),
    ['i', 't', 'o', 's', 'z']
  );
});
