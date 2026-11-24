(function (root) {
  'use strict';

  const api = root.__TWFOX_TETRIO__;
  if (!api) return;

  const internals = (root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {});
  const logic = internals.modUpdaterLogic || root.TWFOX_MOD_UPDATER_LOGIC;
  if (!logic) return;

  function getI18nLogic() {
    const bag = root.__TWFOX_INTERNAL__ || internals;
    return (bag && bag.i18nLogic) || root.TWFOX_I18N_LOGIC || null;
  }

  function getLocale() {
    try {
      const cfg = api && typeof api.getConfig === 'function' ? api.getConfig() : null;
      const raw = cfg && cfg.language && cfg.language.locale;
      const i18n = getI18nLogic();
      return i18n && typeof i18n.normalizeLocale === 'function'
        ? i18n.normalizeLocale(raw)
        : raw === 'es'
          ? 'es'
          : 'en';
    } catch (_) {
      return 'en';
    }
  }

  function tr(enText) {
    const i18n = getI18nLogic();
    return i18n && typeof i18n.translateText === 'function'
      ? i18n.translateText(enText, getLocale())
      : enText;
  }

  function base64ToUtf8(b64) {
    const clean = String(b64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
    if (typeof Buffer === 'function') {
      return Buffer.from(clean, 'base64').toString('utf8');
    }
    const bin = typeof atob === 'function' ? atob(clean) : '';
    if (typeof TextDecoder === 'function') {
      try {
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
          bytes[i] = bin.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
      } catch (_) {}
    }
    try {
      return decodeURIComponent(escape(bin));
    } catch (_) {
      return bin;
    }
  }

  async function fetchRemoteText(url) {
    if (!logic.isAllowedUpdateUrl(url)) {
      throw new Error('Disallowed update URL: ' + url);
    }

    if (root.IPC && typeof root.IPC.invoke === 'function') {
      try {
        const res = await root.IPC.invoke('twfoxtetrio-fetch', url);
        if (res && typeof res.status === 'number') {
          if (!res.ok) {
            const err = new Error(`HTTP ${res.status} fetching ${url}`);
            err.status = res.status;
            throw err;
          }
          if (typeof res.text === 'string') return res.text;
          return base64ToUtf8(res.base64 || '');
        }
      } catch (ipcErr) {
        if (ipcErr && typeof ipcErr.status === 'number') {
          throw ipcErr;
        }
      }
    }

    const fetcher = typeof root.fetch === 'function' ? root.fetch : null;
    if (!fetcher) {
      throw new Error('No HTTP client available to check updates');
    }
    const resp = await fetcher(url, { cache: 'no-store' });
    if (!resp || !resp.ok) {
      const status = resp && resp.status ? resp.status : 0;
      const err = new Error(`HTTP ${status} fetching ${url}`);
      err.status = status;
      throw err;
    }
    if (typeof resp.text === 'function') {
      return await resp.text();
    }
    if (typeof resp.json === 'function') {
      return JSON.stringify(await resp.json());
    }
    return '';
  }

  const installedVersion = String(api.version || '0.6.6')
    .trim()
    .replace(/^v/i, '');

  const detectedPlatform =
    typeof navigator !== 'undefined' && /linux/i.test(String(navigator.platform || navigator.userAgent || ''))
      ? 'linux'
      : typeof navigator !== 'undefined' && /mac/i.test(String(navigator.platform || navigator.userAgent || ''))
        ? 'darwin'
        : 'win32';

  const FOX_BADGE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17 7" shape-rendering="crispEdges" aria-hidden="true">' +
    '<rect x="6" y="0" width="1" height="1" fill="#ffca96"/><rect x="10" y="0" width="1" height="1" fill="#ffca96"/>' +
    '<rect x="0" y="1" width="4" height="1" fill="#ffca96"/><rect x="6" y="1" width="5" height="1" fill="#ffca96"/>' +
    '<rect x="13" y="1" width="1" height="1" fill="#ffca96"/><rect x="15" y="1" width="1" height="1" fill="#ffca96"/>' +
    '<rect x="0" y="2" width="4" height="1" fill="#ff8234"/><rect x="6" y="2" width="1" height="1" fill="#ff8234"/>' +
    '<rect x="10" y="2" width="1" height="1" fill="#ff8234"/><rect x="13" y="2" width="1" height="1" fill="#ff8234"/>' +
    '<rect x="15" y="2" width="1" height="1" fill="#ff8234"/><rect x="0" y="3" width="1" height="1" fill="#ff8234"/>' +
    '<rect x="1" y="3" width="2" height="1" fill="#ffca96"/><rect x="6" y="3" width="1" height="1" fill="#ff8234"/>' +
    '<rect x="10" y="3" width="1" height="1" fill="#ff8234"/><rect x="14" y="3" width="1" height="1" fill="#ff8234"/>' +
    '<rect x="0" y="4" width="3" height="1" fill="#ff8234"/><rect x="6" y="4" width="1" height="1" fill="#ff8234"/>' +
    '<rect x="10" y="4" width="1" height="1" fill="#ff8234"/><rect x="13" y="4" width="1" height="1" fill="#ff8234"/>' +
    '<rect x="15" y="4" width="1" height="1" fill="#ff8234"/><rect x="0" y="5" width="1" height="1" fill="#c24812"/>' +
    '<rect x="6" y="5" width="1" height="1" fill="#ff8234"/><rect x="10" y="5" width="1" height="1" fill="#ff8234"/>' +
    '<rect x="13" y="5" width="1" height="1" fill="#c24812"/><rect x="15" y="5" width="1" height="1" fill="#c24812"/>' +
    '<rect x="0" y="6" width="1" height="1" fill="#c24812"/><rect x="6" y="6" width="5" height="1" fill="#c24812"/>' +
    '<rect x="13" y="6" width="1" height="1" fill="#c24812"/><rect x="15" y="6" width="1" height="1" fill="#c24812"/>' +
    '</svg>';

  const state = {
    installedVersion,
    remoteVersion: null,
    updateAvailable: false,
    checking: false,
    updating: false,
    status: 'idle', // 'idle' | 'checking' | 'up_to_date' | 'available' | 'updating' | 'applied' | 'manual_required' | 'error'
    message: '',
    error: null,
    lastCheckedAt: 0,
    dismissedVersion: null,
    canAutoUpdate: null,
    platform: detectedPlatform,
    asarPath: null,
    manualCommand: logic.buildManualUpdateCommand(detectedPlatform),
    releasesUrl: logic.RELEASES_URL,
    zipUrl: logic.ZIP_DOWNLOAD_URL
  };

  const listeners = new Set();
  let inFlightCheck = null;
  let inFlightApply = null;
  let startupTimer = null;
  let pendingToastAfterGame = false;
  let unsubRuntime = null;

  function getState() {
    return Object.assign({}, state);
  }

  function emit() {
    const snap = getState();
    for (const fn of listeners) {
      try {
        fn(snap);
      } catch (_) {}
    }
    refreshToastIfOpen();
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.add(fn);
    try {
      fn(getState());
    } catch (_) {}
    return function () {
      listeners.delete(fn);
    };
  }

  function resolveToastHost() {
    const doc = root.document;
    if (!doc) return null;
    const nativeHost = doc.getElementById('notifications');
    if (nativeHost) return nativeHost;
    let fallback = doc.getElementById('twfoxtetrio-notif-fallback');
    if (!fallback && doc.body) {
      fallback = doc.createElement('div');
      fallback.id = 'twfoxtetrio-notif-fallback';
      fallback.className = 'twfox-notif-fallback';
      doc.body.appendChild(fallback);
    }
    return fallback;
  }

  function removeUpdateToast() {
    const doc = root.document;
    if (!doc) return;
    const existing = doc.getElementById('twfoxtetrio-update-toast');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  function renderToastContent(toastEl) {
    const doc = root.document;
    if (!doc || !toastEl) return;
    const titleEl = toastEl.querySelector('h1');
    const bodyEl = toastEl.querySelector('p');
    const laterBtn = toastEl.querySelector('.twfox-upd-later-btn');
    const updateBtn = doc.getElementById('twfoxtetrio-toast-update-btn');

    if (titleEl) {
      titleEl.textContent =
        state.status === 'manual_required'
          ? tr('MANUAL UPDATE REQUIRED')
          : tr('FOXMOD UPDATE AVAILABLE');
    }
    if (bodyEl) {
      if (state.status === 'updating') {
        bodyEl.textContent = tr('Downloading and installing update...');
      } else if (state.status === 'applied') {
        bodyEl.textContent = tr('Update installed! Restarting TETR.IO...');
      } else if (state.status === 'manual_required') {
        bodyEl.textContent =
          (getLocale() === 'es' ? 'Permiso bloqueado. Ejecuta: ' : 'Auto-write blocked. Run: ') +
          state.manualCommand;
      } else if (state.status === 'error' && state.error) {
        bodyEl.textContent = state.error;
      } else if (state.remoteVersion) {
        bodyEl.textContent = tr(
          `New version v${state.remoteVersion} is available (installed: v${state.installedVersion}).`
        );
      }
    }
    if (laterBtn) {
      laterBtn.textContent = tr(state.status === 'manual_required' || state.status === 'error' ? 'CLOSE' : 'LATER');
    }
    if (updateBtn) {
      if (state.updating) {
        updateBtn.textContent = tr('UPDATING...');
      } else if (state.status === 'applied') {
        updateBtn.textContent = tr('RESTARTING...');
      } else if (state.status === 'manual_required') {
        updateBtn.textContent = tr('COPY COMMAND');
      } else {
        updateBtn.textContent = tr('UPDATE NOW');
      }
    }
  }

  function refreshToastIfOpen() {
    const doc = root.document;
    if (!doc) return;
    const existing = doc.getElementById('twfoxtetrio-update-toast');
    if (existing) {
      renderToastContent(existing);
    }
  }

  function dismissUpdateToast() {
    if (state.remoteVersion) {
      state.dismissedVersion = state.remoteVersion;
    }
    pendingToastAfterGame = false;
    removeUpdateToast();
  }

  function maybeShowUpdateToast() {
    const doc = root.document;
    if (!doc || !state.updateAvailable || !state.remoteVersion) return false;
    if (state.dismissedVersion === state.remoteVersion) return false;

    const rState = typeof api.getState === 'function' ? api.getState() : null;
    if (rState && rState.inGame) {
      pendingToastAfterGame = true;
      return false;
    }

    const host = resolveToastHost();
    if (!host) return false;

    removeUpdateToast();

    const toastEl = doc.createElement('div');
    toastEl.id = 'twfoxtetrio-update-toast';
    toastEl.className = 'notification ns snotify modalnotify twfox-invite-notif';
    toastEl.setAttribute('style', '--pri:#FF7B1C;--sec:#FF7B1C;border-color:#FF7B1C;');
    toastEl.setAttribute('data-fox-notice', 'FOXMOD UPDATE AVAILABLE');
    toastEl.setAttribute('data-twfox-no-i18n', '1');

    const iconEl = doc.createElement('div');
    iconEl.className = 'notification_icon';
    iconEl.innerHTML = FOX_BADGE_SVG;
    const iconSub = doc.createElement('div');
    iconSub.className = 'notification_icon_sub';
    iconEl.appendChild(iconSub);

    const bodyWrap = doc.createElement('div');
    bodyWrap.className = 'notification_body';
    const h1El = doc.createElement('h1');
    const pEl = doc.createElement('p');
    bodyWrap.appendChild(h1El);
    bodyWrap.appendChild(pEl);

    const barEl = doc.createElement('div');
    barEl.className = 'notification_timeoutbar';
    barEl.setAttribute('style', '--time: 60s; width: 100%; animation: none; background: #FF7B1C;');

    const btnHolder = doc.createElement('div');
    btnHolder.className = 'notification_button_holder flex-row ns';

    const laterBtn = doc.createElement('div');
    laterBtn.id = 'twfoxtetrio-toast-later-btn';
    laterBtn.className = 'notification_button flex-item twfox-upd-later-btn';
    laterBtn.setAttribute('role', 'button');
    laterBtn.setAttribute('tabindex', '0');

    const updateBtn = doc.createElement('div');
    updateBtn.id = 'twfoxtetrio-toast-update-btn';
    updateBtn.className = 'notification_button flex-item pri';
    updateBtn.setAttribute('role', 'button');
    updateBtn.setAttribute('tabindex', '0');

    btnHolder.appendChild(laterBtn);
    btnHolder.appendChild(updateBtn);

    toastEl.appendChild(iconEl);
    toastEl.appendChild(bodyWrap);
    toastEl.appendChild(barEl);
    toastEl.appendChild(btnHolder);

    laterBtn.addEventListener('click', function () {
      dismissUpdateToast();
    });

    updateBtn.addEventListener('click', function () {
      if (state.updating || state.status === 'applied') return;
      if (state.status === 'manual_required') {
        if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === 'function') {
          try {
            root.navigator.clipboard.writeText(state.manualCommand);
          } catch (_) {}
        }
        return;
      }
      applyUpdate();
    });

    renderToastContent(toastEl);
    host.appendChild(toastEl);
    return true;
  }

  async function probeCapability() {
    if (!root.IPC || typeof root.IPC.invoke !== 'function') {
      state.canAutoUpdate = false;
      state.manualCommand = logic.buildManualUpdateCommand(state.platform);
      return getState();
    }
    try {
      const info = await root.IPC.invoke('twfoxtetrio-get-update-info');
      if (info && typeof info === 'object') {
        if (typeof info.platform === 'string' && info.platform) {
          state.platform = info.platform;
        }
        if (typeof info.asarPath === 'string' && info.asarPath) {
          state.asarPath = info.asarPath;
        }
        if (typeof info.writable === 'boolean') {
          state.canAutoUpdate = info.writable;
        } else if (typeof info.canAutoUpdate === 'boolean') {
          state.canAutoUpdate = info.canAutoUpdate;
        }
        state.manualCommand = logic.buildManualUpdateCommand(state.platform);
      }
    } catch (_) {
      // Main process from older install might not have twfoxtetrio-get-update-info yet
      state.canAutoUpdate = false;
      state.manualCommand = logic.buildManualUpdateCommand(state.platform);
    }
    return getState();
  }

  async function checkForUpdates(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const force = Boolean(o.force);
    const notify = Boolean(o.notify);

    if (inFlightCheck) return inFlightCheck;
    if (!force && state.lastCheckedAt && Date.now() - state.lastCheckedAt < 15000) {
      if (notify && state.updateAvailable) {
        maybeShowUpdateToast();
      }
      return getState();
    }

    inFlightCheck = (async function () {
      state.checking = true;
      state.status = 'checking';
      state.error = null;
      state.message = 'Checking for updates...';
      emit();

      try {
        await probeCapability();
        const rawPkg = await fetchRemoteText(logic.REMOTE_PKG_URL);
        const parsedPkg = JSON.parse(String(rawPkg || '{}'));
        const remoteVerRaw = parsedPkg && typeof parsedPkg.version === 'string' ? parsedPkg.version : '';
        if (!logic.parseSemver(remoteVerRaw)) {
          throw new Error('Invalid remote version metadata');
        }
        const remoteVer = remoteVerRaw.trim().replace(/^v/i, '');
        const newer = logic.compareSemver(remoteVer, state.installedVersion) > 0;

        state.remoteVersion = remoteVer;
        state.updateAvailable = newer;
        state.lastCheckedAt = Date.now();
        state.status = newer ? 'available' : 'up_to_date';
        state.message = newer
          ? `New version v${remoteVer} is available (installed: v${state.installedVersion}).`
          : `Up to date (v${state.installedVersion})`;
        emit();

        if (newer && notify) {
          if (force) state.dismissedVersion = null;
          maybeShowUpdateToast();
        }
      } catch (err) {
        state.status = 'error';
        state.error = err && err.message ? err.message : String(err);
        state.message = state.error;
        emit();
      } finally {
        state.checking = false;
        inFlightCheck = null;
        emit();
      }

      return getState();
    })();

    return inFlightCheck;
  }

  async function applyUpdate() {
    if (inFlightApply) return inFlightApply;

    inFlightApply = (async function () {
      state.updating = true;
      state.status = 'updating';
      state.error = null;
      state.message = 'Downloading and installing update...';
      emit();

      try {
        if (!root.IPC || typeof root.IPC.invoke !== 'function') {
          state.status = 'manual_required';
          state.canAutoUpdate = false;
          state.error = 'Electron IPC unavailable in browser mode';
          state.message = 'Run manual update command';
          return getState();
        }

        const res = await root.IPC.invoke('twfoxtetrio-self-update-apply', {
          targetVersion: state.remoteVersion || undefined
        });

        if (res && res.ok) {
          state.status = 'applied';
          state.updateAvailable = false;
          if (res.version) state.remoteVersion = String(res.version).replace(/^v/i, '');
          state.message = res.restarting
            ? 'Update installed! Restarting TETR.IO...'
            : 'Update installed! Please restart TETR.IO.';
          return getState();
        }

        if (res && res.needsManual) {
          state.status = 'manual_required';
          state.canAutoUpdate = false;
          state.manualCommand = res.command || logic.buildManualUpdateCommand(state.platform);
          state.error = res.error || 'Write permission denied on installation folder';
          state.message = state.error;
          maybeShowUpdateToast();
          return getState();
        }

        state.status = 'error';
        state.error = (res && res.error) || 'Failed to apply update';
        state.message = state.error;
        return getState();
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        // Older pre-0.6.0 main process does not register twfoxtetrio-self-update-apply
        if (/no handler registered|invalid channel|not registered/i.test(msg)) {
          state.status = 'manual_required';
          state.canAutoUpdate = false;
          state.error = 'Pre-0.6.0 install requires one manual reinstall to enable 1-click updates.';
          state.message = state.error;
        } else {
          state.status = 'error';
          state.error = msg;
          state.message = msg;
        }
        return getState();
      } finally {
        state.updating = false;
        inFlightApply = null;
        emit();
      }
    })();

    return inFlightApply;
  }

  function initFeature() {
    unsubRuntime = api.subscribe(function (runtimeState) {
      if (pendingToastAfterGame && runtimeState && !runtimeState.inGame) {
        pendingToastAfterGame = false;
        maybeShowUpdateToast();
      } else {
        refreshToastIfOpen();
      }
    });

    const delayMs =
      typeof root.__TWFOX_UPDATE_CHECK_DELAY_MS__ === 'number' && root.__TWFOX_UPDATE_CHECK_DELAY_MS__ >= 0
        ? root.__TWFOX_UPDATE_CHECK_DELAY_MS__
        : 2200;

    if (typeof root.setTimeout === 'function') {
      startupTimer = root.setTimeout(function () {
        startupTimer = null;
        checkForUpdates({ notify: true });
      }, delayMs);
      if (startupTimer && typeof startupTimer.unref === 'function') {
        startupTimer.unref();
      }
    }
  }

  function destroy() {
    if (startupTimer && typeof root.clearTimeout === 'function') {
      root.clearTimeout(startupTimer);
      startupTimer = null;
    }
    if (unsubRuntime) {
      unsubRuntime();
      unsubRuntime = null;
    }
    removeUpdateToast();
    listeners.clear();
  }

  internals.modUpdater = {
    getState,
    subscribe,
    probeCapability,
    checkForUpdates,
    applyUpdate,
    dismissUpdateToast,
    maybeShowUpdateToast,
    getManualCommand: function () {
      return state.manualCommand;
    },
    destroy
  };

  api.registerFeature('mod-updater', initFeature);
})(typeof globalThis !== 'undefined' ? globalThis : window);
