(function (root) {
  'use strict';

  const api = root.__TWFOX_TETRIO__;
  if (!api) return;

  const internals = (root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {});
  const logic = internals.modUpdaterLogic || root.TWFOX_MOD_UPDATER_LOGIC;
  if (!logic) return;

  const REPO_URL =
    'https://github.com/' + (logic.GITHUB_OWNER || 'Foxcrack') + '/' + (logic.GITHUB_REPO || 'twfoxtetrio');

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

  function openExternalUrl(url) {
    try {
      if (typeof root.OPEN_EXTERNAL === 'function') {
        root.OPEN_EXTERNAL(url);
        return true;
      }
      if (typeof root.open === 'function') {
        root.open(url, '_blank', 'noopener');
        return true;
      }
    } catch (_) {}
    return false;
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

  const installedVersion = String(api.version || '0.6.12')
    .trim()
    .replace(/^v/i, '');

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
    status: 'idle', // 'idle' | 'checking' | 'up_to_date' | 'available' | 'error'
    message: '',
    error: null,
    lastCheckedAt: 0,
    dismissedVersion: null,
    repoUrl: REPO_URL
  };

  const listeners = new Set();
  let inFlightCheck = null;
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

  function openDownloadPage() {
    return openExternalUrl(REPO_URL);
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
    const linkEl = doc.getElementById('twfoxtetrio-toast-repo-link');
    const laterBtn = toastEl.querySelector('.twfox-upd-later-btn');
    const downloadBtn = doc.getElementById('twfoxtetrio-toast-update-btn');

    if (titleEl) {
      titleEl.textContent = tr('FOXMOD UPDATE AVAILABLE');
    }
    if (bodyEl) {
      if (state.status === 'error' && state.error) {
        bodyEl.textContent = state.error;
      } else if (state.remoteVersion) {
        bodyEl.textContent = tr(
          `New version v${state.remoteVersion} is available (installed: v${state.installedVersion}).`
        );
      }
    }
    if (linkEl) {
      linkEl.setAttribute('href', REPO_URL);
      linkEl.textContent = REPO_URL;
    }
    if (laterBtn) {
      laterBtn.textContent = tr(state.status === 'error' ? 'CLOSE' : 'LATER');
    }
    if (downloadBtn) {
      downloadBtn.textContent = tr('DOWNLOAD');
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
    const repoLink = doc.createElement('a');
    repoLink.id = 'twfoxtetrio-toast-repo-link';
    repoLink.className = 'twfox-updater-repo-link';
    repoLink.setAttribute('href', REPO_URL);
    repoLink.setAttribute('target', '_blank');
    repoLink.setAttribute('rel', 'noopener noreferrer');
    repoLink.setAttribute('data-twfox-no-i18n', '1');
    repoLink.setAttribute(
      'style',
      'display:inline-block;margin-top:4px;font-family:Consolas,monospace;font-size:0.86em;color:#ffae70;text-decoration:underline;word-break:break-all;cursor:pointer;'
    );
    repoLink.textContent = REPO_URL;
    repoLink.addEventListener('click', function (ev) {
      if (openDownloadPage() && ev && typeof ev.preventDefault === 'function') {
        ev.preventDefault();
      }
    });

    bodyWrap.appendChild(h1El);
    bodyWrap.appendChild(pEl);
    bodyWrap.appendChild(repoLink);

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

    const downloadBtn = doc.createElement('div');
    downloadBtn.id = 'twfoxtetrio-toast-update-btn';
    downloadBtn.className = 'notification_button flex-item pri';
    downloadBtn.setAttribute('role', 'button');
    downloadBtn.setAttribute('tabindex', '0');

    btnHolder.appendChild(laterBtn);
    btnHolder.appendChild(downloadBtn);

    toastEl.appendChild(iconEl);
    toastEl.appendChild(bodyWrap);
    toastEl.appendChild(barEl);
    toastEl.appendChild(btnHolder);

    laterBtn.addEventListener('click', function () {
      dismissUpdateToast();
    });

    downloadBtn.addEventListener('click', function () {
      openDownloadPage();
    });

    renderToastContent(toastEl);
    host.appendChild(toastEl);
    return true;
  }

  async function checkForUpdates(opts) {
    if (inFlightCheck) return inFlightCheck;
    const options = opts && typeof opts === 'object' ? opts : {};
    const notify = options.notify !== false;
    const force = Boolean(options.force);

    inFlightCheck = (async function () {
      state.checking = true;
      state.status = 'checking';
      state.error = null;
      state.message = 'Checking for updates...';
      emit();

      try {
        const rawPkg = await fetchRemoteText(logic.REMOTE_PKG_URL);
        const pkg = JSON.parse(rawPkg);
        const remoteVer = String((pkg && pkg.version) || '').trim().replace(/^v/i, '');
        if (!logic.parseSemver(remoteVer)) {
          throw new Error('Invalid remote version in package.json');
        }

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
    checkForUpdates,
    openDownloadPage,
    dismissUpdateToast,
    maybeShowUpdateToast,
    destroy
  };

  api.registerFeature('mod-updater', initFeature);
})(typeof globalThis !== 'undefined' ? globalThis : window);
