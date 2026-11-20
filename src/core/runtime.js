(function (root) {
  'use strict';

  const loc = root.location;
  if (!loc || (loc.protocol !== 'https:' && loc.protocol !== 'http:')) {
    return;
  }

  if (root.__TWFOX_TETRIO__) {
    return;
  }

  const blitzLogic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.blitzLogic;
  const fortyLinesLogic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.fortyLinesLogic;
  const multiplayerLogic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.multiplayerLogic;
  if (!blitzLogic || !fortyLinesLogic || !multiplayerLogic) {
    return;
  }

  const CONFIG_STORAGE_KEY = 'twfoxtetrio_config_v1';
  const ANON_BLITZ_PB_KEY = 'twfoxtetrio_anon_blitz_pb_v1';
  const ANON_40L_PB_KEY = 'twfoxtetrio_anon_40l_pb_v1';

  const DEFAULT_CONFIG = {
    blitzTracker: {
      enabled: true,
      showSubtitle: true,
      signedBehind: false
    },
    fortyLinesTracker: {
      enabled: true,
      showSubtitle: true
    },
    multiplayerLeaderboard: {
      enabled: true,
      maxRows: 12,
      includeQuickPlay: false
    }
  };

  function cloneDefaults() {
    return {
      blitzTracker: { ...DEFAULT_CONFIG.blitzTracker },
      fortyLinesTracker: { ...DEFAULT_CONFIG.fortyLinesTracker },
      multiplayerLeaderboard: { ...DEFAULT_CONFIG.multiplayerLeaderboard }
    };
  }

  function applyConfigPatch(target, patch) {
    if (!patch || typeof patch !== 'object') return false;
    let changed = false;
    for (const sectionKey of Object.keys(DEFAULT_CONFIG)) {
      if (patch[sectionKey] && typeof patch[sectionKey] === 'object') {
        Object.assign(target[sectionKey], patch[sectionKey]);
        changed = true;
      }
    }
    return changed;
  }

  function loadConfig() {
    const base = cloneDefaults();
    try {
      const raw = root.localStorage ? root.localStorage.getItem(CONFIG_STORAGE_KEY) : null;
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      applyConfigPatch(base, parsed);
    } catch (_) {}
    return base;
  }

  function saveConfig(cfg) {
    try {
      if (root.localStorage) {
        root.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
      }
    } catch (_) {}
  }

  let config = loadConfig();

  const state = {
    mode: null,
    inGame: false,
    currentScore: 0,
    bestScore: 0,
    currentTimeMs: 0,
    bestTimeMs: 0,
    inMultiplayer: false,
    inZenith: false,
    selfUsername: '',
    leaderboard: [],
    isAnonymous: false
  };

  const listeners = new Set();
  const features = new Map();
  let domInitialized = false;
  let leaderboardTimer = null;

  function emitState() {
    const snapshot = {
      ...state,
      leaderboard: state.leaderboard.slice()
    };
    for (const listener of listeners) {
      try {
        listener(snapshot, config);
      } catch (err) {
        console.error('[twfoxtetrio] listener error:', err);
      }
    }
  }

  function readPbValue(elementId, anonStorageKey, parser) {
    const pbEl = document.getElementById(elementId);
    const isAnon = document.body ? document.body.classList.contains('anon') : false;
    state.isAnonymous = isAnon;

    if (pbEl && !pbEl.classList.contains('hidden')) {
      return parser(pbEl.textContent);
    }

    if (isAnon) {
      try {
        const stored = root.localStorage ? root.localStorage.getItem(anonStorageKey) : null;
        return parser(stored);
      } catch (_) {}
    }

    return 0;
  }

  function refreshPBs() {
    const nextScorePB = readPbValue('pbdisplay_blitz_inner', ANON_BLITZ_PB_KEY, blitzLogic.parseScoreText);
    const nextTimePB = readPbValue('pbdisplay_40l_inner', ANON_40L_PB_KEY, fortyLinesLogic.parseTimeText);
    const changed = nextScorePB !== state.bestScore || nextTimePB !== state.bestTimeMs;
    state.bestScore = nextScorePB;
    state.bestTimeMs = nextTimePB;
    return changed;
  }

  function maybePersistAnonResult(menusEl, endedMode) {
    if (!menusEl) return;
    if (menusEl.getAttribute('data-menu-type') !== 'results') return;
    if (!document.body || !document.body.classList.contains('anon')) return;

    const headerEl = document.getElementById('result_header');
    const resultEl = document.getElementById('result_result');
    if (!headerEl || !resultEl) return;

    const headerText = headerEl.textContent || '';

    if (endedMode === 'blitz') {
      const pbEl = document.getElementById('pbdisplay_blitz_inner');
      if (pbEl && !pbEl.classList.contains('hidden')) return;
      if (!/FINAL SCORE/i.test(headerText)) return;

      const finalScore = blitzLogic.parseScoreText(resultEl.textContent);
      const prevAnonPB = readPbValue('pbdisplay_blitz_inner', ANON_BLITZ_PB_KEY, blitzLogic.parseScoreText);
      if (finalScore > prevAnonPB) {
        try {
          if (root.localStorage) {
            root.localStorage.setItem(ANON_BLITZ_PB_KEY, String(finalScore));
          }
        } catch (_) {}
        state.bestScore = finalScore;
      }
      return;
    }

    if (endedMode === '40l') {
      const pbEl = document.getElementById('pbdisplay_40l_inner');
      if (pbEl && !pbEl.classList.contains('hidden')) return;
      if (!/FINAL TIME/i.test(headerText)) return;

      const finalMs = fortyLinesLogic.parseTimeText(resultEl.textContent);
      const prevAnonPB = readPbValue('pbdisplay_40l_inner', ANON_40L_PB_KEY, fortyLinesLogic.parseTimeText);
      if (finalMs > 0 && (prevAnonPB === 0 || finalMs < prevAnonPB)) {
        try {
          if (root.localStorage) {
            root.localStorage.setItem(ANON_40L_PB_KEY, fortyLinesLogic.formatTimeMs(finalMs));
          }
        } catch (_) {}
        state.bestTimeMs = finalMs;
      }
    }
  }

  const scoreDetector = blitzLogic.createDoubleCallScoreDetector({ maxGapMs: 2.5 });
  const timerDetector = fortyLinesLogic.createFortyLinesTimerDetector({ maxPairGapMs: 1.5, maxTickGapMs: 2.0 });
  const rosterTracker = multiplayerLogic.createMultiplayerRosterTracker();

  function refreshSelfUsername() {
    const meEl = document.getElementById('me_username');
    if (meEl && typeof meEl.textContent === 'string') {
      state.selfUsername = meEl.textContent.trim();
    }
  }

  function sampleLeaderboard() {
    refreshSelfUsername();
    state.leaderboard = rosterTracker.sample(state.selfUsername, {
      useScoreboard: Boolean(state.inZenith && config.multiplayerLeaderboard.includeQuickPlay)
    });
  }

  function handlePaqEntry(entry) {
    if (!Array.isArray(entry)) return;
    if (entry[0] !== 'trackEvent' || entry[1] !== 'Activity' || entry[2] !== 'Start Game') {
      return;
    }

    const modeName = entry[3];
    scoreDetector.reset();
    timerDetector.reset();

    if (modeName === 'Blitz') {
      state.mode = 'blitz';
      state.inGame = true;
      state.currentScore = 0;
      state.currentTimeMs = 0;
      refreshPBs();
      emitState();
    } else if (modeName === '40 Lines') {
      state.mode = '40l';
      state.inGame = true;
      state.currentScore = 0;
      state.currentTimeMs = 0;
      refreshPBs();
      emitState();
    } else {
      const wasTracked = state.inGame && (state.mode === 'blitz' || state.mode === '40l');
      state.mode = typeof modeName === 'string' ? modeName : 'other';
      state.inGame = true;
      state.currentScore = 0;
      state.currentTimeMs = 0;
      if (wasTracked) {
        emitState();
      }
    }
  }

  function installPaqHook() {
    function wrapPaqTarget(target) {
      if (!target || (typeof target !== 'object' && typeof target !== 'function')) {
        return target;
      }
      if (target.__twfoxWrapped) {
        return target;
      }

      let activePush = target.push;
      function wrappedPush() {
        for (let i = 0; i < arguments.length; i++) {
          handlePaqEntry(arguments[i]);
        }
        return typeof activePush === 'function' ? activePush.apply(this, arguments) : arguments.length;
      }

      try {
        Object.defineProperty(target, 'push', {
          configurable: true,
          enumerable: false,
          get() {
            return wrappedPush;
          },
          set(nextPush) {
            if (typeof nextPush === 'function' && nextPush !== wrappedPush) {
              activePush = nextPush;
            }
          }
        });
        Object.defineProperty(target, '__twfoxWrapped', {
          value: true,
          enumerable: false
        });
      } catch (_) {
        if (typeof activePush === 'function') {
          target.push = wrappedPush;
        }
      }

      return target;
    }

    let currentPaq = Array.isArray(root._paq) ? root._paq : [];
    for (let i = 0; i < currentPaq.length; i++) {
      handlePaqEntry(currentPaq[i]);
    }
    currentPaq = wrapPaqTarget(currentPaq);

    try {
      Object.defineProperty(root, '_paq', {
        configurable: true,
        enumerable: true,
        get() {
          return currentPaq;
        },
        set(nextVal) {
          currentPaq = wrapPaqTarget(nextVal);
        }
      });
    } catch (_) {}
  }

  function installLocaleHook() {
    const origToLocaleString = Number.prototype.toLocaleString;
    if (origToLocaleString.__twfoxWrapped) return;

    function wrappedToLocaleString(locale) {
      if (
        state.inGame &&
        state.mode === 'blitz' &&
        arguments.length === 1 &&
        locale === 'en-US'
      ) {
        const numericVal = typeof this === 'number'
          ? this
          : (this instanceof Number ? this.valueOf() : NaN);
        const confirmed = scoreDetector.observe(numericVal, locale, performance.now());
        if (confirmed !== null && confirmed !== state.currentScore) {
          state.currentScore = confirmed;
          emitState();
        }
      }
      return origToLocaleString.apply(this, arguments);
    }

    try {
      Object.defineProperty(wrappedToLocaleString, '__twfoxWrapped', {
        value: true,
        enumerable: false
      });
    } catch (_) {}

    Number.prototype.toLocaleString = wrappedToLocaleString;
  }

  function installPadStartHook() {
    const origPadStart = String.prototype.padStart;
    if (origPadStart.__twfoxWrapped) return;

    function wrappedPadStart(maxLength, fillString) {
      if (
        state.inGame &&
        state.mode === '40l' &&
        arguments.length === 2 &&
        fillString === '0' &&
        (maxLength === 3 || maxLength === 2)
      ) {
        const strVal = typeof this === 'string' ? this : String(this);
        const confirmedMs = timerDetector.observe(strVal, maxLength, fillString, performance.now());
        if (confirmedMs !== null && confirmedMs !== state.currentTimeMs) {
          state.currentTimeMs = confirmedMs;
          emitState();
        }
      }
      return origPadStart.apply(this, arguments);
    }

    try {
      Object.defineProperty(wrappedPadStart, '__twfoxWrapped', {
        value: true,
        enumerable: false
      });
    } catch (_) {}

    String.prototype.padStart = wrappedPadStart;
  }

  function installMapHook() {
    const origMapSet = Map.prototype.set;
    if (origMapSet.__twfoxWrapped) return;

    function wrappedMapSet(key, value) {
      const result = origMapSet.call(this, key, value);
      if (value !== null && typeof value === 'object') {
        rosterTracker.observeMapSet(this, key, value);
      }
      return result;
    }

    try {
      Object.defineProperty(wrappedMapSet, '__twfoxWrapped', {
        value: true,
        enumerable: false
      });
    } catch (_) {}

    Map.prototype.set = wrappedMapSet;
  }

  function observePbElement(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const observer = new MutationObserver(() => {
      if (refreshPBs()) {
        emitState();
      }
    });
    observer.observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function startLeaderboardPolling() {
    if (leaderboardTimer !== null) return;
    sampleLeaderboard();
    emitState();
    leaderboardTimer = setInterval(() => {
      if (!state.inMultiplayer) return;
      sampleLeaderboard();
      emitState();
    }, 200);
  }

  function stopLeaderboardPolling() {
    if (leaderboardTimer !== null) {
      clearInterval(leaderboardTimer);
      leaderboardTimer = null;
    }
    rosterTracker.reset();
    state.leaderboard = [];
  }

  function syncBodyState() {
    const bodyEl = document.body;
    if (!bodyEl) return;

    const nextMulti = bodyEl.classList.contains('multiplexed');
    const nextZenith = bodyEl.classList.contains('inzenith');

    if (nextMulti !== state.inMultiplayer || nextZenith !== state.inZenith) {
      state.inMultiplayer = nextMulti;
      state.inZenith = nextZenith;
      if (nextMulti) {
        startLeaderboardPolling();
      } else {
        stopLeaderboardPolling();
        emitState();
      }
    }
  }

  function initDomObservers() {
    if (domInitialized) return;
    domInitialized = true;

    const menusEl = document.getElementById('menus');
    refreshSelfUsername();

    if (refreshPBs()) {
      emitState();
    }

    if (menusEl) {
      const syncMenusState = () => {
        const menusHidden = menusEl.classList.contains('hidden');
        if (!menusHidden && state.inGame) {
          const prevMode = state.mode;
          if (prevMode === 'blitz' || prevMode === '40l') {
            maybePersistAnonResult(menusEl, prevMode);
          }
          state.inGame = false;
          state.mode = null;
          state.currentScore = 0;
          state.currentTimeMs = 0;
          scoreDetector.reset();
          timerDetector.reset();
          if (prevMode === 'blitz' || prevMode === '40l') {
            emitState();
          }
        }
      };

      const menuObserver = new MutationObserver(syncMenusState);
      menuObserver.observe(menusEl, {
        attributes: true,
        attributeFilter: ['class', 'data-menu-type']
      });
    }

    if (document.body) {
      syncBodyState();
      const bodyObserver = new MutationObserver(syncBodyState);
      bodyObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    observePbElement('pbdisplay_blitz_inner');
    observePbElement('pbdisplay_40l_inner');

    for (const [name, featureInit] of features.entries()) {
      try {
        featureInit(api);
      } catch (err) {
        console.error('[twfoxtetrio] failed to start feature "' + name + '":', err);
      }
    }
  }

  const api = {
    version: '0.4.0',
    getState() {
      return {
        ...state,
        leaderboard: state.leaderboard.slice()
      };
    },
    getConfig() {
      return {
        blitzTracker: { ...config.blitzTracker },
        fortyLinesTracker: { ...config.fortyLinesTracker },
        multiplayerLeaderboard: { ...config.multiplayerLeaderboard }
      };
    },
    updateConfig(patch) {
      if (applyConfigPatch(config, patch)) {
        saveConfig(config);
        emitState();
      }
      return this.getConfig();
    },
    resetConfig() {
      config = cloneDefaults();
      saveConfig(config);
      emitState();
      return this.getConfig();
    },
    subscribe(listener) {
      if (typeof listener !== 'function') return function () {};
      listeners.add(listener);
      listener(this.getState(), config);
      return function () {
        listeners.delete(listener);
      };
    },
    registerFeature(name, initFn) {
      if (typeof name !== 'string' || typeof initFn !== 'function') return;
      if (features.has(name)) return;
      features.set(name, initFn);
      if (domInitialized) {
        try {
          initFn(api);
        } catch (err) {
          console.error('[twfoxtetrio] failed to start feature "' + name + '":', err);
        }
      }
    }
  };

  installPaqHook();
  installLocaleHook();
  installPadStartHook();
  installMapHook();

  root.__TWFOX_TETRIO__ = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDomObservers, { once: true });
  } else {
    initDomObservers();
  }
}(typeof globalThis !== 'undefined' ? globalThis : window));
