(function (root) {
  'use strict';

  const loc = root.location;
  if (!loc || (loc.protocol !== 'https:' && loc.protocol !== 'http:')) {
    return;
  }

  if (root.__TWFOX_TETRIO__) {
    return;
  }

  const logic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.blitzLogic;
  if (!logic) {
    return;
  }

  const CONFIG_STORAGE_KEY = 'twfoxtetrio_config_v1';
  const ANON_BLITZ_PB_KEY = 'twfoxtetrio_anon_blitz_pb_v1';

  const DEFAULT_CONFIG = {
    blitzTracker: {
      enabled: true,
      showSubtitle: true,
      signedBehind: false
    }
  };

  function cloneDefaults() {
    return {
      blitzTracker: { ...DEFAULT_CONFIG.blitzTracker }
    };
  }

  function loadConfig() {
    const base = cloneDefaults();
    try {
      const raw = root.localStorage ? root.localStorage.getItem(CONFIG_STORAGE_KEY) : null;
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.blitzTracker && typeof parsed.blitzTracker === 'object') {
        Object.assign(base.blitzTracker, parsed.blitzTracker);
      }
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
    isAnonymous: false
  };

  const listeners = new Set();
  const features = new Map();
  let domInitialized = false;

  function emitState() {
    const snapshot = { ...state };
    for (const listener of listeners) {
      try {
        listener(snapshot, config);
      } catch (err) {
        console.error('[twfoxtetrio] listener error:', err);
      }
    }
  }

  function readBlitzPBFromDOM() {
    const pbEl = document.getElementById('pbdisplay_blitz_inner');
    const isAnon = document.body ? document.body.classList.contains('anon') : false;
    state.isAnonymous = isAnon;

    if (pbEl && !pbEl.classList.contains('hidden')) {
      return logic.parseScoreText(pbEl.textContent);
    }

    if (isAnon) {
      try {
        const stored = root.localStorage ? root.localStorage.getItem(ANON_BLITZ_PB_KEY) : null;
        return logic.parseScoreText(stored);
      } catch (_) {}
    }

    return 0;
  }

  function refreshPB() {
    const nextPB = readBlitzPBFromDOM();
    if (nextPB !== state.bestScore) {
      state.bestScore = nextPB;
      return true;
    }
    return false;
  }

  function maybePersistAnonBlitzResult(menusEl) {
    if (!menusEl) return;
    if (menusEl.getAttribute('data-menu-type') !== 'results') return;
    if (!document.body || !document.body.classList.contains('anon')) return;

    const pbEl = document.getElementById('pbdisplay_blitz_inner');
    if (pbEl && !pbEl.classList.contains('hidden')) return;

    const headerEl = document.getElementById('result_header');
    const resultEl = document.getElementById('result_result');
    if (!headerEl || !resultEl) return;
    if (!/FINAL SCORE/i.test(headerEl.textContent || '')) return;

    const finalScore = logic.parseScoreText(resultEl.textContent);
    const prevAnonPB = readBlitzPBFromDOM();
    if (finalScore > prevAnonPB) {
      try {
        if (root.localStorage) {
          root.localStorage.setItem(ANON_BLITZ_PB_KEY, String(finalScore));
        }
      } catch (_) {}
      state.bestScore = finalScore;
    }
  }

  const scoreDetector = logic.createDoubleCallScoreDetector({ maxGapMs: 2.5 });

  function handlePaqEntry(entry) {
    if (!Array.isArray(entry)) return;
    if (entry[0] !== 'trackEvent' || entry[1] !== 'Activity' || entry[2] !== 'Start Game') {
      return;
    }

    const modeName = entry[3];
    scoreDetector.reset();

    if (modeName === 'Blitz') {
      state.mode = 'blitz';
      state.inGame = true;
      state.currentScore = 0;
      refreshPB();
      emitState();
    } else {
      const wasActive = state.mode === 'blitz' || state.inGame;
      state.mode = typeof modeName === 'string' ? modeName : 'other';
      state.inGame = true;
      state.currentScore = 0;
      if (wasActive) {
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

  function initDomObservers() {
    if (domInitialized) return;
    domInitialized = true;

    const menusEl = document.getElementById('menus');
    const pbEl = document.getElementById('pbdisplay_blitz_inner');

    if (refreshPB()) {
      emitState();
    }

    if (menusEl) {
      const syncMenusState = () => {
        const menusHidden = menusEl.classList.contains('hidden');
        if (!menusHidden && state.inGame) {
          const wasBlitz = state.mode === 'blitz';
          if (wasBlitz) {
            maybePersistAnonBlitzResult(menusEl);
          }
          state.inGame = false;
          state.mode = null;
          state.currentScore = 0;
          scoreDetector.reset();
          if (wasBlitz) {
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

    if (pbEl) {
      const pbObserver = new MutationObserver(() => {
        if (refreshPB()) {
          emitState();
        }
      });
      pbObserver.observe(pbEl, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }

    for (const [name, featureInit] of features.entries()) {
      try {
        featureInit(api);
      } catch (err) {
        console.error('[twfoxtetrio] failed to start feature "' + name + '":', err);
      }
    }
  }

  const api = {
    version: '0.1.0',
    getState() {
      return { ...state };
    },
    getConfig() {
      return {
        blitzTracker: { ...config.blitzTracker }
      };
    },
    updateConfig(patch) {
      if (patch && typeof patch === 'object' && patch.blitzTracker && typeof patch.blitzTracker === 'object') {
        Object.assign(config.blitzTracker, patch.blitzTracker);
        saveConfig(config);
        emitState();
      }
      return this.getConfig();
    },
    subscribe(listener) {
      if (typeof listener !== 'function') return function () {};
      listeners.add(listener);
      listener({ ...state }, config);
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

  root.__TWFOX_TETRIO__ = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDomObservers, { once: true });
  } else {
    initDomObservers();
  }
}(typeof globalThis !== 'undefined' ? globalThis : window));
