'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ZEN_QP_MODS,
  createEmptySelection,
  normalizeZenModSelection,
  toggleZenModState,
  hasAnyActiveMods,
  hasGarbageDependentMods,
  applyZenQpModsToGameState
} = require('../src/features/zen-qp-logic');

test('ZEN_QP_MODS includes all 8 solo Quick Play cards with normal and reversed states', () => {
  assert.equal(ZEN_QP_MODS.length, 8);
  assert.deepEqual(
    ZEN_QP_MODS.map((m) => m.id),
    ['expert', 'nohold', 'messy', 'gravity', 'volatile', 'doublehole', 'invisible', 'allspin']
  );

  const empty = createEmptySelection();
  assert.equal(hasAnyActiveMods(empty), false);
  assert.equal(toggleZenModState('off', 'normal'), 'normal');
  assert.equal(toggleZenModState('normal', 'normal'), 'off');
  assert.equal(toggleZenModState('off', 'reversed'), 'reversed');
  assert.equal(toggleZenModState('normal', 'reversed'), 'reversed');
  assert.equal(toggleZenModState('reversed', 'reversed'), 'off');

  const normalized = normalizeZenModSelection({
    nohold: true,
    invisible: 'reversed',
    unknownKey: 'normal',
    gravity: 'invalid'
  });
  assert.equal(normalized.nohold, 'normal');
  assert.equal(normalized.invisible, 'reversed');
  assert.equal(normalized.gravity, 'off');
  assert.equal('unknownKey' in normalized, false);
  assert.equal(hasAnyActiveMods(normalized), true);
  assert.equal(hasGarbageDependentMods(normalized), false);
  assert.equal(hasGarbageDependentMods({ doublehole: 'normal' }), true);
});

test('applyZenQpModsToGameState applies card effects cleanly and restores defaults when turned off', () => {
  const gameState = {
    g: 0.02,
    holdlocked: false,
    stats: { zenlevel: 4 },
    setoptions: {
      usezenconfig: true,
      display_hold: true,
      infinite_hold: false,
      infinite_movement: false,
      locktime: 30,
      spinbonuses: 'T-spins+',
      receivemultiplier: 1,
      messiness_change: 1,
      messiness_inner: 0,
      messiness_nosame: false,
      messiness_center: true,
      garbagefavor: 33,
      garbagephase: 165,
      survival_messiness: 100
    }
  };

  // Enable stack of normal cards (nohold, invisible, allspin, doublehole, volatile, gravity)
  applyZenQpModsToGameState(gameState, {
    nohold: 'normal',
    invisible: 'normal',
    allspin: 'normal',
    doublehole: 'normal',
    volatile: 'normal',
    gravity: 'normal'
  });

  assert.equal(gameState.setoptions.display_hold, false);
  assert.equal(gameState.holdlocked, true);
  assert.equal(gameState.setoptions.invisible, true);
  assert.equal(gameState.setoptions.master_invisible, false);
  assert.equal(gameState.setoptions.zenith_allspin, true);
  assert.equal(gameState.setoptions.spinbonuses, 'all+');
  assert.equal(gameState.setoptions.zenith_doublehole, true);
  assert.equal(gameState.setoptions.zenith_volatile, true);
  assert.equal(gameState.setoptions.receivemultiplier, 2);
  assert.equal(gameState.setoptions.zenith_gravity, true);
  assert.ok(gameState.g >= 1.5);
  assert.equal(gameState.setoptions.locktime, 24);
  assert.deepEqual(
    gameState.setoptions.zenith_mods,
    ['nohold', 'gravity', 'volatile', 'doublehole', 'invisible', 'allspin']
  );

  // Flip gravity + doublehole + invisible to Reversed: reversed mods sit first for zenith_mods[0] checks
  applyZenQpModsToGameState(gameState, {
    doublehole: 'reversed',
    gravity: 'reversed',
    invisible: 'reversed'
  });
  assert.equal(gameState.g, 20);
  assert.equal(gameState.setoptions.locktime, 16);
  assert.equal(gameState.setoptions.invisible, false);
  assert.equal(gameState.setoptions.master_invisible, true);
  assert.equal(gameState.setoptions.display_hold, true);
  assert.equal(gameState.holdlocked, false);
  assert.deepEqual(
    gameState.setoptions.zenith_mods,
    ['gravity_reversed', 'doublehole_reversed', 'invisible_reversed']
  );

  // Turning everything OFF clears all modded flags cleanly
  applyZenQpModsToGameState(gameState, createEmptySelection());
  assert.equal(gameState.setoptions.zenith_mods.length, 0);
  assert.equal(gameState.setoptions.zenith_doublehole, false);
  assert.equal(gameState.setoptions.zenith_volatile, false);
  assert.equal(gameState.setoptions.zenith_allspin, false);
  assert.equal(gameState.setoptions.master_invisible, false);
  assert.equal(gameState.setoptions.invisible, false);
  assert.equal(gameState.setoptions.receivemultiplier, 1);
});
