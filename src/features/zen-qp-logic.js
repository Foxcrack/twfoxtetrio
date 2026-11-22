(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
  root.__TWFOX_INTERNAL__.zenQpLogic = api;
}(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const ZEN_QP_MODS = Object.freeze([
    Object.freeze({
      id: 'expert',
      short: 'EX',
      name: 'EXPERT',
      revShort: 'EX-R',
      revName: 'THE TYRANT',
      accent: '#ff5268',
      needsGarbage: false,
      desc: 'Tighter lock delay, faster gravity & messier harsher rules.',
      revDesc: 'Extreme gravity pressure & 1.5x incoming garbage.'
    }),
    Object.freeze({
      id: 'nohold',
      short: 'NH',
      name: 'NO HOLD',
      revShort: 'NH-R',
      revName: 'ASCETICISM',
      accent: '#ffb347',
      needsGarbage: false,
      desc: 'Disables Hold piece completely.',
      revDesc: 'No Hold + alternating 2-hole garbage splits.'
    }),
    Object.freeze({
      id: 'messy',
      short: 'MS',
      name: 'MESSIER GARBAGE',
      revShort: 'MS-R',
      revName: 'LOADED DICE',
      accent: '#ff70a6',
      needsGarbage: true,
      desc: 'Garbage holes switch columns unpredictably.',
      revDesc: '100% chaotic hole changes per garbage line.'
    }),
    Object.freeze({
      id: 'gravity',
      short: 'GV',
      name: 'GRAVITY',
      revShort: 'GV-R',
      revName: 'FREEFALL',
      accent: '#6ec6ff',
      needsGarbage: false,
      desc: 'Strong escalating gravity & faster lock delay.',
      revDesc: 'Instant 20G drop & strict lock delay.'
    }),
    Object.freeze({
      id: 'volatile',
      short: 'VL',
      name: 'VOLATILE',
      revShort: 'VL-R',
      revName: 'LAST STAND',
      accent: '#ff8c42',
      needsGarbage: true,
      desc: '2x incoming garbage & doubled canceling fatigue.',
      revDesc: '3x incoming garbage centered favoring survival risk.'
    }),
    Object.freeze({
      id: 'doublehole',
      short: 'DH',
      name: 'DOUBLE HOLE',
      revShort: 'DH-R',
      revName: 'DAMNATION',
      accent: '#d96bff',
      needsGarbage: true,
      desc: '50% chance for garbage lines to spawn with 2 holes.',
      revDesc: 'Swiss-cheese garbage lines with 6-7 holes.'
    }),
    Object.freeze({
      id: 'invisible',
      short: 'IN',
      name: 'INVISIBLE',
      revShort: 'IN-R',
      revName: 'THE EXILE',
      accent: '#9eb6ff',
      needsGarbage: false,
      desc: 'Placed minos only pulse visible once every 5 seconds.',
      revDesc: 'Placed minos vanish completely after locking.'
    }),
    Object.freeze({
      id: 'allspin',
      short: 'AS',
      name: 'ALL-SPIN',
      revShort: 'AS-R',
      revName: 'THE WARLOCK',
      accent: '#4dffb8',
      needsGarbage: false,
      desc: 'Rewards all-spins, but dupe clears spawn wound garbage.',
      revDesc: 'Spins only (+20 wound lines on dupe clear, non-spins = 1L).'
    })
  ]);

  const MOD_IDS = ZEN_QP_MODS.map((m) => m.id);
  const VALID_STATES = new Set(['off', 'normal', 'reversed']);

  function createEmptySelection() {
    const out = {};
    for (const id of MOD_IDS) {
      out[id] = 'off';
    }
    return out;
  }

  /**
   * Normalizes a ZEN Quick Play mod map so every card is 'off', 'normal', or 'reversed'.
   */
  function normalizeZenModSelection(raw) {
    const out = createEmptySelection();
    if (!raw || typeof raw !== 'object') {
      return out;
    }
    for (const id of MOD_IDS) {
      const val = raw[id];
      if (val === true || val === 'normal') {
        out[id] = 'normal';
      } else if (val === 'reversed') {
        out[id] = 'reversed';
      } else {
        out[id] = VALID_STATES.has(val) ? val : 'off';
      }
    }
    return out;
  }

  /**
   * Returns next state when toggling normal click vs reverse button on a card.
   */
  function toggleZenModState(current, mode) {
    const cur = VALID_STATES.has(current) ? current : 'off';
    if (mode === 'reversed') {
      return cur === 'reversed' ? 'off' : 'reversed';
    }
    return cur === 'off' ? 'normal' : 'off';
  }

  function hasAnyActiveMods(selection) {
    const norm = normalizeZenModSelection(selection);
    return MOD_IDS.some((id) => norm[id] !== 'off');
  }

  function hasGarbageDependentMods(selection) {
    const norm = normalizeZenModSelection(selection);
    return ZEN_QP_MODS.some((m) => m.needsGarbage && norm[m.id] !== 'off');
  }

  /**
   * Applies gravity & lock-delay modifiers from active cards (safe to invoke after
   * TETR.IO's UpdateZenGravity() on level-ups as well).
   */
  function applyZenGravityMods(gameState, selection) {
    if (!gameState || !gameState.setoptions) return false;
    const norm = normalizeZenModSelection(selection);
    const setopts = gameState.setoptions;
    const zenLevel = Math.max(1, Number(gameState.stats && gameState.stats.zenlevel) || 1);

    if (norm.gravity === 'reversed') {
      gameState.g = 20;
      setopts.infinite_movement = false;
      setopts.locktime = Math.min(Number(setopts.locktime) || 30, 16);
      return true;
    }

    if (norm.gravity === 'normal') {
      const targetG = Math.min(20, 0.85 + (zenLevel - 1) * 0.25);
      gameState.g = Math.max(Number(gameState.g) || 0, targetG);
      setopts.infinite_movement = false;
      setopts.locktime = Math.min(Number(setopts.locktime) || 30, 24);
    }

    if (norm.expert === 'reversed') {
      gameState.g = Math.max(Number(gameState.g) || 0, 0.8);
      setopts.infinite_movement = false;
      setopts.locktime = Math.min(Number(setopts.locktime) || 30, 18);
    } else if (norm.expert === 'normal') {
      gameState.g = Math.max(Number(gameState.g) || 0, 0.3);
      setopts.locktime = Math.min(Number(setopts.locktime) || 30, 24);
    }

    return true;
  }

  /**
   * Applies all active QP Card effects directly onto TETR.IO's ZEN gameState / setoptions.
   * Restores clean defaults whenever a card is toggled OFF so repeated toggles never leave stale flags.
   */
  function applyZenQpModsToGameState(gameState, selection) {
    if (!gameState || !gameState.setoptions) return null;
    const norm = normalizeZenModSelection(selection);
    const setopts = gameState.setoptions;

    if (!gameState.zenith || typeof gameState.zenith !== 'object') {
      gameState.zenith = {
        garbageside: 0,
        garbageahead: [],
        lastclearcount: null,
        lastclearpiece: null,
        lastclearspin: null,
        lastclearwasdupe: false
      };
    }

    // Clear previous card overrides first so turning a card off restores clean base ZEN behavior
    setopts.zenith_expert = false;
    setopts.zenith_messy = false;
    setopts.zenith_gravity = false;
    setopts.zenith_volatile = false;
    setopts.zenith_doublehole = false;
    setopts.zenith_allspin = false;
    setopts.display_hold = true;
    setopts.invisible = false;
    setopts.master_invisible = false;
    setopts.receivemultiplier = 1;
    setopts.clutch = true;

    const normalMods = [];
    const reversedMods = [];

    if (norm.expert !== 'off') {
      const isRev = norm.expert === 'reversed';
      setopts.zenith_expert = true;
      setopts.garbagefavor = 0;
      setopts.messiness_change = Math.max(Number(setopts.messiness_change) || 0, isRev ? 0.6 : 0.35);
      setopts.messiness_inner = Math.max(Number(setopts.messiness_inner) || 0, isRev ? 0.3 : 0.15);
      setopts.garbagephase = Math.min(Number(setopts.garbagephase) || 165, 60);
      if (isRev) {
        setopts.receivemultiplier = Math.max(Number(setopts.receivemultiplier) || 1, 1.5);
        reversedMods.push('expert_reversed');
      } else {
        normalMods.push('expert');
      }
    }

    if (norm.nohold !== 'off') {
      setopts.display_hold = false;
      setopts.infinite_hold = false;
      gameState.holdlocked = true;
      if (norm.nohold === 'reversed') {
        reversedMods.push('nohold_reversed');
      } else {
        normalMods.push('nohold');
      }
    } else if (gameState.holdlocked === true && gameState.__twfoxForcedNoHold) {
      gameState.holdlocked = false;
    }
    gameState.__twfoxForcedNoHold = norm.nohold !== 'off';

    if (norm.messy !== 'off') {
      const isRev = norm.messy === 'reversed';
      setopts.zenith_messy = true;
      setopts.messiness_change = isRev ? 1 : Math.max(Number(setopts.messiness_change) || 0, 0.85);
      setopts.messiness_inner = isRev ? 1 : Math.max(Number(setopts.messiness_inner) || 0, 0.55);
      setopts.messiness_nosame = true;
      setopts.messiness_center = false;
      setopts.garbagefavor = 0;
      setopts.survival_messiness = 100;
      if (isRev) {
        reversedMods.push('messy_reversed');
      } else {
        normalMods.push('messy');
      }
    }

    if (norm.gravity !== 'off') {
      setopts.zenith_gravity = true;
      if (norm.gravity === 'reversed') {
        reversedMods.push('gravity_reversed');
      } else {
        normalMods.push('gravity');
      }
    }

    if (norm.volatile !== 'off') {
      const isRev = norm.volatile === 'reversed';
      setopts.zenith_volatile = true;
      if (isRev) {
        setopts.receivemultiplier = Math.max(Number(setopts.receivemultiplier) || 1, 3);
        setopts.garbagefavor = 50;
        setopts.messiness_center = true;
        reversedMods.push('volatile_reversed');
      } else {
        setopts.receivemultiplier = Math.max(Number(setopts.receivemultiplier) || 1, 2);
        normalMods.push('volatile');
      }
    }

    if (norm.doublehole !== 'off') {
      setopts.zenith_doublehole = true;
      if (norm.doublehole === 'reversed') {
        reversedMods.push('doublehole_reversed');
      } else {
        normalMods.push('doublehole');
      }
    }

    if (norm.invisible !== 'off') {
      if (norm.invisible === 'reversed') {
        setopts.invisible = false;
        setopts.master_invisible = true;
        reversedMods.push('invisible_reversed');
      } else {
        setopts.invisible = true;
        setopts.master_invisible = false;
        normalMods.push('invisible');
      }
    }

    if (norm.allspin !== 'off') {
      setopts.zenith_allspin = true;
      setopts.spinbonuses = 'all+';
      if (norm.allspin === 'reversed') {
        setopts.clutch = false;
        reversedMods.push('allspin_reversed');
      } else {
        normalMods.push('allspin');
      }
    }

    applyZenGravityMods(gameState, norm);

    // Put active reversed mod at index 0 so TETR.IO's zenith_mods[0] checks fire cleanly
    setopts.zenith_mods = reversedMods.concat(normalMods);

    return {
      selection: norm,
      activeMods: setopts.zenith_mods.slice()
    };
  }

  return {
    ZEN_QP_MODS,
    MOD_IDS,
    createEmptySelection,
    normalizeZenModSelection,
    toggleZenModState,
    hasAnyActiveMods,
    hasGarbageDependentMods,
    applyZenGravityMods,
    applyZenQpModsToGameState
  };
}));
