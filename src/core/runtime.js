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
  const quickPlayLogic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.quickPlayLogic;
  const multiplayerLogic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.multiplayerLogic;
  const zenQpLogic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.zenQpLogic;
  const soloLobbyLogic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.soloLobbyLogic;
  if (!blitzLogic || !fortyLinesLogic || !quickPlayLogic || !multiplayerLogic) {
    return;
  }

  const CONFIG_STORAGE_KEY = 'twfoxtetrio_config_v1';
  const ANON_BLITZ_PB_KEY = 'twfoxtetrio_anon_blitz_pb_v1';
  const ANON_40L_PB_KEY = 'twfoxtetrio_anon_40l_pb_v1';
  const ANON_ZENITH_PB_KEY = 'twfoxtetrio_anon_zenith_pb_v1';
  const ANON_ZENITHEX_PB_KEY = 'twfoxtetrio_anon_zenithex_pb_v1';

  const DEFAULT_ZEN_QP_MODS = zenQpLogic
    ? zenQpLogic.createEmptySelection()
    : {
        expert: 'off',
        nohold: 'off',
        messy: 'off',
        gravity: 'off',
        volatile: 'off',
        doublehole: 'off',
        invisible: 'off',
        allspin: 'off'
      };

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
    quickPlayTracker: {
      enabled: true,
      showSubtitle: true,
      signedBehind: false
    },
    multiplayerLeaderboard: {
      enabled: true,
      maxRows: 12,
      includeQuickPlay: false
    },
    zenQuickPlayMods: { ...DEFAULT_ZEN_QP_MODS },
    foxPawBadge: {
      enabled: true
    },
    language: {
      locale: 'en'
    }
  };

  function cloneDefaults() {
    return {
      blitzTracker: { ...DEFAULT_CONFIG.blitzTracker },
      fortyLinesTracker: { ...DEFAULT_CONFIG.fortyLinesTracker },
      quickPlayTracker: { ...DEFAULT_CONFIG.quickPlayTracker },
      multiplayerLeaderboard: { ...DEFAULT_CONFIG.multiplayerLeaderboard },
      zenQuickPlayMods: zenQpLogic ? zenQpLogic.createEmptySelection() : { ...DEFAULT_ZEN_QP_MODS },
      foxPawBadge: { ...DEFAULT_CONFIG.foxPawBadge },
      language: { ...DEFAULT_CONFIG.language }
    };
  }

  function applyConfigPatch(target, patch) {
    if (!patch || typeof patch !== 'object') return false;
    let changed = false;
    for (const sectionKey of Object.keys(DEFAULT_CONFIG)) {
      if (patch[sectionKey] && typeof patch[sectionKey] === 'object') {
        if (sectionKey === 'zenQuickPlayMods' && zenQpLogic) {
          target.zenQuickPlayMods = zenQpLogic.normalizeZenModSelection({
            ...target.zenQuickPlayMods,
            ...patch.zenQuickPlayMods
          });
        } else {
          Object.assign(target[sectionKey], patch[sectionKey]);
        }
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
    currentAltitude: 0,
    bestZenithAltitude: 0,
    bestZenithExAltitude: 0,
    zenithActive: false,
    zenithExpert: false,
    inMultiplayer: false,
    inZenith: false,
    selfUsername: '',
    leaderboard: [],
    isAnonymous: false,
    practiceZenActive: false
  };

  const listeners = new Set();
  const features = new Map();
  const fetchedZenithUsers = new Set();
  let domInitialized = false;
  let leaderboardTimer = null;
  let leaderboardTimerPeriod = 0;

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
    const nextZenithPB = readPbValue('pbdisplay_zenith_inner', ANON_ZENITH_PB_KEY, quickPlayLogic.parseAltitudeText);
    const nextZenithExPB = readPbValue('pbdisplay_zenithex_inner', ANON_ZENITHEX_PB_KEY, quickPlayLogic.parseAltitudeText);
    const changed =
      nextScorePB !== state.bestScore ||
      nextTimePB !== state.bestTimeMs ||
      nextZenithPB !== state.bestZenithAltitude ||
      nextZenithExPB !== state.bestZenithExAltitude;
    state.bestScore = nextScorePB;
    state.bestTimeMs = nextTimePB;
    state.bestZenithAltitude = nextZenithPB;
    state.bestZenithExAltitude = nextZenithExPB;
    return changed;
  }

  function maybeFetchWeeklyZenithPbFallback(isExpert) {
    if (state.isAnonymous || !state.selfUsername || typeof root.fetch !== 'function') return;
    const currentPb = isExpert ? state.bestZenithExAltitude : state.bestZenithAltitude;
    if (currentPb > 0) return;

    const cleanUser = state.selfUsername.trim().toLowerCase();
    if (!cleanUser) return;
    const endpoint = isExpert ? 'zenithex' : 'zenith';
    const cacheKey = endpoint + ':' + cleanUser;
    if (fetchedZenithUsers.has(cacheKey)) return;
    fetchedZenithUsers.add(cacheKey);

    root
      .fetch('https://ch.tetr.io/api/users/' + encodeURIComponent(cleanUser) + '/summaries/' + endpoint)
      .then((resp) => (resp && resp.ok ? resp.json() : null))
      .then((json) => {
        const alt = Number(json && json.data && json.data.record && json.data.record.results && json.data.record.results.stats && json.data.record.results.stats.zenith && json.data.record.results.stats.zenith.altitude);
        if (!Number.isFinite(alt) || alt <= 0) return;
        const parsed = Math.round(alt * 10) / 10;
        if (isExpert && state.bestZenithExAltitude === 0) {
          state.bestZenithExAltitude = parsed;
          emitState();
        } else if (!isExpert && state.bestZenithAltitude === 0) {
          state.bestZenithAltitude = parsed;
          emitState();
        }
      })
      .catch(() => {});
  }

  function maybePersistAnonZenithResult() {
    if (!document.body || !document.body.classList.contains('anon')) return;
    const zMenu = document.getElementById('zenithmenu');
    if (!zMenu || !zMenu.classList.contains('inresults')) return;
    const resEl = document.getElementById('zenith_result');
    if (!resEl) return;

    const finalAlt = quickPlayLogic.parseAltitudeText(resEl.textContent);
    if (finalAlt <= 0) return;

    const isEx = zMenu.classList.contains('reversed');
    const elemId = isEx ? 'pbdisplay_zenithex_inner' : 'pbdisplay_zenith_inner';
    const key = isEx ? ANON_ZENITHEX_PB_KEY : ANON_ZENITH_PB_KEY;
    const pbEl = document.getElementById(elemId);
    if (pbEl && !pbEl.classList.contains('hidden')) return;

    const prevAnonPB = readPbValue(elemId, key, quickPlayLogic.parseAltitudeText);
    if (finalAlt > prevAnonPB) {
      try {
        if (root.localStorage) {
          root.localStorage.setItem(key, quickPlayLogic.formatAltitude(finalAlt, true));
        }
      } catch (_) {}
      if (isEx) state.bestZenithExAltitude = finalAlt;
      else state.bestZenithAltitude = finalAlt;
    }
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
      if (!/FINAL SCORE|PUNTUACIÓN FINAL/i.test(headerText)) return;

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
      if (!/FINAL TIME|TIEMPO FINAL/i.test(headerText)) return;

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

  function computeZenithActiveFlag() {
    const bodyEl = document.body;
    if (!bodyEl || !bodyEl.classList.contains('inzenith')) return false;
    if (bodyEl.classList.contains('spectating')) return false;
    // Live TETR.IO adds body.ingame_phys for every active local run (including AGAIN retries),
    // while #zenithmenu retains a stale .inresults class between deaths and AGAIN.
    if (bodyEl.classList.contains('ingame_phys')) return true;
    const zMenu = document.getElementById('zenithmenu');
    if (zMenu) {
      if (zMenu.classList.contains('hidden')) return true;
      return zMenu.classList.contains('rolledup') && !zMenu.classList.contains('inresults');
    }
    const menusEl = document.getElementById('menus');
    return Boolean(menusEl && menusEl.classList.contains('hidden'));
  }

  function sampleZenithProgress() {
    refreshSelfUsername();
    const zMenu = document.getElementById('zenithmenu');
    const selfZ = rosterTracker.getSelfZenithState(state.selfUsername);
    const nextActive = computeZenithActiveFlag();
    const nextExpert = Boolean(selfZ.isExpert || (zMenu && zMenu.classList.contains('reversed')));
    const prevActive = state.zenithActive;
    let nextAlt = prevActive ? state.currentAltitude : 0;
    if (selfZ.found) {
      nextAlt = selfZ.altitude;
    }
    if (nextActive && !prevActive) {
      refreshPBs();
      maybeFetchWeeklyZenithPbFallback(nextExpert);
      if (!selfZ.found) nextAlt = 0;
    }
    if (!nextActive && prevActive) {
      nextAlt = 0;
    }

    const changed =
      nextActive !== state.zenithActive ||
      nextExpert !== state.zenithExpert ||
      nextAlt !== state.currentAltitude;
    state.zenithActive = nextActive;
    state.zenithExpert = nextExpert;
    state.currentAltitude = nextAlt;
    return changed;
  }

  function sampleLeaderboard() {
    refreshSelfUsername();
    state.leaderboard = state.inMultiplayer
      ? rosterTracker.sample(state.selfUsername, {
          useScoreboard: Boolean(state.inZenith && config.multiplayerLeaderboard.includeQuickPlay)
        })
      : [];
    sampleZenithProgress();
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
      exitPracticeZenSession(false);
      state.mode = 'blitz';
      state.inGame = true;
      state.currentScore = 0;
      state.currentTimeMs = 0;
      refreshPBs();
      emitState();
    } else if (modeName === '40 Lines') {
      exitPracticeZenSession(false);
      state.mode = '40l';
      state.inGame = true;
      state.currentScore = 0;
      state.currentTimeMs = 0;
      refreshPBs();
      emitState();
    } else {
      if (modeName !== 'Custom Solo') {
        exitPracticeZenSession(false);
      }
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

  let activeZenWrapper = null;
  let applyingZenMods = false;
  let hookAppliedDuringPull = false;
  let practiceZenRequested = false;
  let practiceZenActive = false;
  let lastEndedPracticeZen = false;
  let pendingSoloPractice = null;
  let activeSoloPractice = null;
  let lastEndedSoloPractice = null;

  function applySoloOptionsToSetopts(setopts, rawOpts) {
    if (!setopts || typeof setopts !== 'object') return;
    const opts = soloLobbyLogic ? soloLobbyLogic.normalizeModeOptions(rawOpts) : rawOpts || {};
    setopts.stride = Boolean(opts.stride);
    setopts.no_szo = Boolean(opts.stride);
    setopts.pro = Boolean(opts.pro);
    setopts.pro_alert = Boolean(opts.pro && opts.proAlert);
    setopts.pro_retry = Boolean(opts.pro && opts.proRetry);
    if (opts.stride) {
      setopts.countdown = true;
      setopts.countdown_interval = 450;
      setopts.precountdown = 0;
      setopts.prestart = 250;
      setopts.zoominto = 'fast';
    }
    if (opts.pro) {
      setopts.slot_counter4 = 'keys';
      setopts.slot_counter5 = 'finesse';
    }
  }

  function recordActiveSoloRun(menusEl, menuType) {
    if (!activeSoloPractice || !soloLobbyLogic) return false;
    const gState = activeSoloPractice.wrapper && activeSoloPractice.wrapper.state;
    const stats = gState && gState.stats;
    let score = Number(stats && stats.score) || 0;
    let lines = Number(stats && stats.lines) || 0;
    const frame = Number(gState && gState.frame) || 0;
    let timeMs = frame > 0 ? Math.round(frame * (1000 / 60)) : 0;
    let completed = activeSoloPractice.modeKey === 'marathon' && lines >= 150;

    if (menuType === 'results' && menusEl) {
      const headerEl = document.getElementById('result_header');
      const resultEl = document.getElementById('result_result');
      if (headerEl && resultEl) {
        const headerText = headerEl.textContent || '';
        if (/FINAL SCORE|PUNTUACIÓN FINAL/i.test(headerText)) {
          const parsedScore = blitzLogic.parseScoreText(resultEl.textContent);
          if (parsedScore > score) score = parsedScore;
          if (activeSoloPractice.modeKey === 'marathon') completed = true;
        } else if (/FINAL TIME|TIEMPO FINAL/i.test(headerText)) {
          const parsedTime = fortyLinesLogic.parseTimeText(resultEl.textContent);
          if (parsedTime > 0) timeMs = parsedTime;
          if (activeSoloPractice.modeKey === 'marathon') {
            lines = Math.max(lines, 150);
            completed = true;
          }
        }
      }
    }

    if (score <= 0 && lines <= 0 && !completed) return false;
    const rec = soloLobbyLogic.recordSoloResult(activeSoloPractice.modeKey, activeSoloPractice.opts, {
      score,
      lines,
      timeMs,
      completed
    });
    return Boolean(rec && rec.updated);
  }

  function attachSoloPracticeWrapper(wrapper) {
    if (!wrapper || typeof wrapper !== 'object') return;
    const gState = wrapper.state;
    if (!gState || !gState.setoptions || gState.setoptions.usezenconfig) return;

    const spec = pendingSoloPractice || (activeSoloPractice && activeSoloPractice.wrapper !== wrapper
      ? { modeKey: activeSoloPractice.modeKey, opts: activeSoloPractice.opts }
      : null);
    if (!spec) return;

    if (activeSoloPractice && activeSoloPractice.wrapper && activeSoloPractice.wrapper !== wrapper) {
      recordActiveSoloRun(null, null);
    }

    pendingSoloPractice = null;
    applySoloOptionsToSetopts(gState.setoptions, spec.opts);
    activeSoloPractice = {
      modeKey: spec.modeKey,
      opts: spec.opts,
      wrapper
    };
  }

  function setPracticeZenPanelVisibility(visible) {
    const zenPanel = document.getElementById('zen_panel');
    const qpSection = document.getElementById('twfoxtetrio-zen-qp-section');
    if (zenPanel && zenPanel.classList) {
      if (visible) zenPanel.classList.remove('hidden');
      else zenPanel.classList.add('hidden');
    }
    if (qpSection && qpSection.classList) {
      if (visible) qpSection.classList.remove('hidden');
      else qpSection.classList.add('hidden');
    }
  }

  function exitPracticeZenSession(fromMenuReturn) {
    const wasActive = practiceZenActive || practiceZenRequested || Boolean(activeZenWrapper);
    practiceZenRequested = false;
    if (practiceZenActive) {
      lastEndedPracticeZen = Boolean(fromMenuReturn);
    }
    practiceZenActive = false;
    state.practiceZenActive = false;
    activeZenWrapper = null;
    if (wasActive) {
      setPracticeZenPanelVisibility(false);
    }
    return wasActive;
  }

  function applyModsToActiveZenWrapper(triggerPull) {
    if (!practiceZenActive || !zenQpLogic || !activeZenWrapper || !activeZenWrapper.state) return false;
    if (activeZenWrapper.state.destroyed) {
      activeZenWrapper = null;
      return false;
    }
    if (applyingZenMods) return false;
    hookAppliedDuringPull = false;
    if (triggerPull && typeof activeZenWrapper.pullZenConfig === 'function') {
      activeZenWrapper.pullZenConfig();
    }
    if (!hookAppliedDuringPull) {
      applyingZenMods = true;
      try {
        zenQpLogic.applyZenQpModsToGameState(activeZenWrapper.state, config.zenQuickPlayMods);
      } finally {
        applyingZenMods = false;
      }
    }
    return true;
  }

  function installZenSetoptionsHooks(wrapper) {
    const gState = wrapper && wrapper.state;
    const setopts = gState && gState.setoptions;
    if (!gState || !setopts || !setopts.usezenconfig || setopts.__twfoxZenHooked) return;

    try {
      let survivalVal = setopts.survivalmode;
      Object.defineProperty(setopts, 'survivalmode', {
        configurable: true,
        enumerable: true,
        get() {
          return survivalVal;
        },
        set(nextVal) {
          survivalVal = nextVal;
          if (practiceZenActive && !applyingZenMods && zenQpLogic) {
            applyingZenMods = true;
            try {
              setopts.can_undo = true;
              zenQpLogic.applyZenQpModsToGameState(gState, config.zenQuickPlayMods);
              hookAppliedDuringPull = true;
            } finally {
              applyingZenMods = false;
            }
          }
        }
      });

      let lockVal = setopts.locktime;
      Object.defineProperty(setopts, 'locktime', {
        configurable: true,
        enumerable: true,
        get() {
          return lockVal;
        },
        set(nextVal) {
          lockVal = nextVal;
          if (practiceZenActive && !applyingZenMods && zenQpLogic) {
            applyingZenMods = true;
            try {
              zenQpLogic.applyZenGravityMods(gState, config.zenQuickPlayMods);
            } finally {
              applyingZenMods = false;
            }
          }
        }
      });

      Object.defineProperty(setopts, '__twfoxZenHooked', {
        value: true,
        enumerable: false
      });
    } catch (_) {}
  }

  function attachZenGameWrapper(wrapper) {
    if (!practiceZenRequested || !wrapper || typeof wrapper !== 'object') return;
    const gState = wrapper.state;
    if (!gState || !gState.setoptions) return;

    practiceZenRequested = false;
    lastEndedPracticeZen = false;
    practiceZenActive = true;
    state.practiceZenActive = true;

    const setopts = gState.setoptions;
    setopts.usezenconfig = true;
    setopts.zenlevels = false;
    setopts.nolockout = true;
    setopts.retryisclear = true;
    setopts.can_undo = true;
    setopts.stride = true;
    setopts.infinite_stock = true;
    setopts.pro = true;
    setopts.garbagespecialbonus = true;
    setopts.clutch = true;
    setopts.b2bcharging = true;
    setopts.b2bcharge_at = 4;
    setopts.b2bcharge_base = 3;
    setopts.allclear_garbage = 5;
    setopts.allclear_b2b = 1;
    setopts.allclear_b2b_sends = true;

    activeZenWrapper = wrapper;
    if (typeof wrapper.loadZenConfig === 'function') {
      try {
        wrapper.loadZenConfig();
      } catch (_) {}
    }
    installZenSetoptionsHooks(wrapper);
    setPracticeZenPanelVisibility(true);
    applyModsToActiveZenWrapper(typeof wrapper.pullZenConfig === 'function');
    emitState();
  }

  function installMapHook() {
    const origMapSet = Map.prototype.set;
    if (origMapSet.__twfoxWrapped) return;

    function wrappedMapSet(key, value) {
      const result = origMapSet.call(this, key, value);
      if (value !== null && typeof value === 'object') {
        rosterTracker.observeMapSet(this, key, value);
        attachZenGameWrapper(value);
        attachSoloPracticeWrapper(value);
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

  function stopLeaderboardPolling() {
    if (leaderboardTimer !== null) {
      clearInterval(leaderboardTimer);
      leaderboardTimer = null;
      leaderboardTimerPeriod = 0;
    }
    rosterTracker.reset();
    state.leaderboard = [];
    state.zenithActive = false;
    state.currentAltitude = 0;
  }

  function startLeaderboardPolling() {
    const desiredPeriod = state.inZenith ? 80 : 200;
    if (leaderboardTimer !== null && leaderboardTimerPeriod === desiredPeriod) return;
    if (leaderboardTimer !== null) {
      clearInterval(leaderboardTimer);
      leaderboardTimer = null;
    }
    leaderboardTimerPeriod = desiredPeriod;
    sampleLeaderboard();
    emitState();
    leaderboardTimer = setInterval(() => {
      if (!state.inMultiplayer && !state.inZenith) return;
      sampleLeaderboard();
      emitState();
    }, desiredPeriod);
  }

  function syncBodyState() {
    const bodyEl = document.body;
    if (!bodyEl) return;

    const nextMulti = bodyEl.classList.contains('multiplexed');
    const nextZenith = bodyEl.classList.contains('inzenith');
    const prevZenith = state.inZenith;

    if (nextMulti !== state.inMultiplayer || nextZenith !== state.inZenith) {
      state.inMultiplayer = nextMulti;
      state.inZenith = nextZenith;
      if (nextZenith && !prevZenith) {
        refreshPBs();
        maybeFetchWeeklyZenithPbFallback(false);
      }
      if (nextMulti || nextZenith) {
        startLeaderboardPolling();
      } else {
        stopLeaderboardPolling();
        emitState();
      }
      return;
    }

    if ((nextMulti || nextZenith) && sampleZenithProgress()) {
      emitState();
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
        const menuType = menusEl.getAttribute('data-menu-type');
        let needEmit = false;
        if (!menusHidden) {
          const onResults = menuType === 'results';
          if (activeSoloPractice) {
            if (recordActiveSoloRun(menusEl, menuType)) {
              needEmit = true;
            }
            if (onResults) {
              lastEndedSoloPractice = {
                modeKey: activeSoloPractice.modeKey,
                opts: activeSoloPractice.opts
              };
            } else {
              lastEndedSoloPractice = null;
            }
            activeSoloPractice = null;
          } else if (!onResults) {
            lastEndedSoloPractice = null;
          }
          if (practiceZenActive && exitPracticeZenSession(onResults)) {
            needEmit = true;
          } else if (!onResults) {
            lastEndedPracticeZen = false;
          }
        }
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
            needEmit = true;
          }
        }
        if (sampleZenithProgress()) {
          needEmit = true;
        }
        if (needEmit) {
          emitState();
        }
      };

      const startResultsBtn = document.getElementById('start_results');
      if (startResultsBtn && !startResultsBtn.__twfoxPracticeZenBound) {
        startResultsBtn.__twfoxPracticeZenBound = true;
        startResultsBtn.addEventListener('click', function () {
          if (lastEndedPracticeZen) {
            practiceZenRequested = true;
          }
          if (lastEndedSoloPractice) {
            pendingSoloPractice = lastEndedSoloPractice;
          }
        });
      }

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
    observePbElement('pbdisplay_zenith_inner');
    observePbElement('pbdisplay_zenithex_inner');

    const zenithMenuEl = document.getElementById('zenithmenu');
    if (zenithMenuEl) {
      const zMenuObserver = new MutationObserver(() => {
        maybePersistAnonZenithResult();
        if (sampleZenithProgress()) {
          emitState();
        }
      });
      zMenuObserver.observe(zenithMenuEl, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    const meEl = document.getElementById('me_username');
    if (meEl) {
      const meObserver = new MutationObserver(() => {
        refreshSelfUsername();
      });
      meObserver.observe(meEl, {
        childList: true,
        characterData: true,
        subtree: true
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
    version: '0.6.2',
    getState() {
      refreshSelfUsername();
      return {
        ...state,
        leaderboard: state.leaderboard.slice()
      };
    },
    getConfig() {
      return {
        blitzTracker: { ...config.blitzTracker },
        fortyLinesTracker: { ...config.fortyLinesTracker },
        quickPlayTracker: { ...config.quickPlayTracker },
        multiplayerLeaderboard: { ...config.multiplayerLeaderboard },
        zenQuickPlayMods: { ...config.zenQuickPlayMods },
        foxPawBadge: { ...config.foxPawBadge },
        language: { ...config.language }
      };
    },
    enterPracticeZen() {
      practiceZenRequested = true;
      lastEndedPracticeZen = false;
    },
    prepareSoloPracticeLaunch(modeKey, opts) {
      pendingSoloPractice = { modeKey, opts: opts || {} };
      lastEndedSoloPractice = null;
    },
    clearSoloPracticeLaunch() {
      pendingSoloPractice = null;
      activeSoloPractice = null;
      lastEndedSoloPractice = null;
    },
    exitPracticeZen() {
      if (exitPracticeZenSession(false)) {
        emitState();
      }
    },
    reapplyZenQpMods() {
      return applyModsToActiveZenWrapper(true);
    },
    updateConfig(patch) {
      if (applyConfigPatch(config, patch)) {
        saveConfig(config);
        if (patch && Object.prototype.hasOwnProperty.call(patch, 'zenQuickPlayMods')) {
          applyModsToActiveZenWrapper(true);
        }
        emitState();
      }
      return this.getConfig();
    },
    resetConfig() {
      config = cloneDefaults();
      saveConfig(config);
      applyModsToActiveZenWrapper(true);
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
