(function (root) {
  'use strict';

  const api = root.__TWFOX_TETRIO__;
  const logic = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.foxPawLogic;
  const p2pRoom = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.p2pRoom;
  if (!api || !logic) {
    return;
  }

  const STYLE_ID = 'twfoxtetrio-fox-paw-style';
  const CONNECT_TIMEOUT_MS = 4500;
  const KEEPALIVE_MS = 40000;
  const HEARTBEAT_PUBLISH_MS = 20 * 60 * 1000;
  const RECONNECT_MIN_MS = 2000;
  const RECONNECT_MAX_MS = 60000;
  const SCAN_DEBOUNCE_MS = 50;
  const SAVE_DEBOUNCE_MS = 350;

  const utf8Decoder = typeof TextDecoder === 'function' ? new TextDecoder('utf-8') : null;

  function decodeUtf8(bytes) {
    if (!bytes || bytes.length === 0) return '';
    if (utf8Decoder) return utf8Decoder.decode(bytes);
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      out += String.fromCharCode(bytes[i]);
    }
    return out;
  }

  function unrefTimer(t) {
    if (t && typeof t.unref === 'function') {
      t.unref();
    }
    return t;
  }

  const FOX_PAW_CSS = `
[${logic.FOX_PAW_ATTR}="1"]::before {
  content: "";
  display: inline-block;
  width: 0.98em;
  height: 0.98em;
  margin-right: 0.28em;
  vertical-align: -0.14em;
  background-image: url("${logic.FOX_PAW_DATA_URL}");
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  flex: 0 0 auto;
  pointer-events: none;
}
#me_username[${logic.FOX_PAW_ATTR}="1"]::before {
  width: 0.95em;
  height: 0.95em;
  vertical-align: -0.12em;
}
.scroller_player > h1[${logic.FOX_PAW_ATTR}="1"]::before,
h1.chat_tag[${logic.FOX_PAW_ATTR}="1"]::before,
.record_owner[${logic.FOX_PAW_ATTR}="1"]::before,
.social_relationship h1 > span[${logic.FOX_PAW_ATTR}="1"]::before,
.social_notification h1 > span[${logic.FOX_PAW_ATTR}="1"]::before,
#social_dm_username[${logic.FOX_PAW_ATTR}="1"]::before,
.tetra_modal > h2[${logic.FOX_PAW_ATTR}="1"]::before {
  width: 0.92em;
  height: 0.92em;
  vertical-align: -0.12em;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55));
}
.twfox-player-row .twfox-player-name[${logic.FOX_PAW_ATTR}="1"]::before {
  content: "";
  width: 1.65em;
  height: 1.65em;
  margin-right: 0;
  vertical-align: middle;
  background-color: rgba(255, 139, 56, 0.16);
  background-image: url("${logic.FOX_PAW_DATA_URL}");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 78%;
  border-color: rgba(255, 139, 56, 0.65);
}
`;

  function ensureStyle() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = FOX_PAW_CSS;
    const target = document.head || document.documentElement;
    if (target) target.appendChild(style);
  }

  function loadStoredCache() {
    try {
      if (root.localStorage) {
        return root.localStorage.getItem(logic.FOX_PAW_STORAGE_KEY);
      }
    } catch (_) {}
    return null;
  }

  function writeStoredCache(serialized) {
    try {
      if (root.localStorage) {
        root.localStorage.setItem(logic.FOX_PAW_STORAGE_KEY, serialized);
      }
    } catch (_) {}
  }

  api.registerFeature('fox-paw-badge', function () {
    ensureStyle();

    const registry = logic.createFoxerRegistry({
      initialCache: loadStoredCache()
    });
    const activeBadgedEls = new Set();

    let destroyed = false;
    let enabled = isConfigEnabled(api.getConfig());
    let selfNorm = readSelfUsername(api.getState());
    let lastPublishedUser = '';
    let lastPublishedAt = 0;

    // MQTT connection state
    let ws = null;
    let wsConnected = false;
    let brokerIndex = 0;
    let packetId = 1;
    let reconnectDelay = RECONNECT_MIN_MS;
    let connectTimer = null;
    let reconnectTimer = null;
    let keepaliveTimer = null;
    let heartbeatTimer = null;
    let closeAfterFlushTimer = null;
    let scanTimer = null;
    let saveTimer = null;
    let observer = null;

    function nextPacketId() {
      packetId = (packetId % 65535) + 1;
      return packetId;
    }

    function isConfigEnabled(cfg) {
      return !(cfg && cfg.foxPawBadge && cfg.foxPawBadge.enabled === false);
    }

    function readSelfUsername(stateObj) {
      const isAnon = Boolean(
        (stateObj && stateObj.isAnonymous) ||
        (typeof document !== 'undefined' && document.body && document.body.classList && document.body.classList.contains('anon'))
      );
      if (isAnon) return '';
      let raw = '';
      if (typeof document !== 'undefined') {
        const meEl = document.getElementById('me_username');
        if (meEl && typeof meEl.textContent === 'string' && meEl.textContent.trim()) {
          raw = meEl.textContent;
        }
      }
      if (!raw && stateObj && typeof stateObj.selfUsername === 'string') {
        raw = stateObj.selfUsername;
      }
      return logic.isPublishableUsername(raw) ? logic.normalizeUsername(raw) : '';
    }

    function flushCache() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      writeStoredCache(registry.exportCache(Date.now()));
    }

    function scheduleSaveCache() {
      if (destroyed) return;
      if (saveTimer) return;
      saveTimer = unrefTimer(setTimeout(flushCache, SAVE_DEBOUNCE_MS));
    }

    function hasFoxer(username) {
      if (!enabled) return false;
      const norm = logic.normalizeUsername(username);
      if (!norm) return false;
      if (selfNorm && norm === selfNorm) return true;
      return registry.has(norm, Date.now());
    }

    function scanDom() {
      if (scanTimer) {
        clearTimeout(scanTimer);
        scanTimer = null;
      }
      if (destroyed || typeof document === 'undefined') return;

      const latestSelf = readSelfUsername(api.getState());
      if (latestSelf !== selfNorm) {
        selfNorm = latestSelf;
        syncSelfPresence(false);
      }

      const now = Date.now();
      const targetStates = new Map();

      function markTarget(el, rawUsername) {
        if (!el) return;
        if (!enabled) {
          targetStates.set(el, false);
          return;
        }
        const norm = logic.normalizeUsername(rawUsername);
        const match = Boolean(norm && ((selfNorm && norm === selfNorm) || registry.has(norm, now)));
        if (match || !targetStates.has(el)) {
          targetStates.set(el, match);
        }
      }

      // 1. Logged-in header username (#me_username)
      const meEl = document.getElementById('me_username');
      if (meEl) {
        markTarget(meEl, selfNorm || meEl.textContent);
      }

      // 2. Room lobby player cards (.scroller_player > h1)
      const queryRoot = typeof document.querySelectorAll === 'function'
        ? document
        : (document.body || document.documentElement);
      if (queryRoot && typeof queryRoot.querySelectorAll === 'function') {
        const scrollerPlayers = queryRoot.querySelectorAll('.scroller_player');
        for (let i = 0; i < scrollerPlayers.length; i++) {
          const sp = scrollerPlayers[i];
          const heading = typeof sp.querySelector === 'function' ? sp.querySelector('h1') : null;
          const targetEl = heading || sp;
          const rawName = (typeof sp.getAttribute === 'function' && sp.getAttribute('data-username')) ||
            (heading && heading.textContent) ||
            '';
          markTarget(targetEl, rawName);
        }

        // 3. Room / ingame / league chat sender tags (h1.chat_tag)
        const chatTags = queryRoot.querySelectorAll('.chat_tag');
        for (let i = 0; i < chatTags.length; i++) {
          const tagEl = chatTags[i];
          markTarget(tagEl, tagEl.textContent);
        }

        // 4. Inline user links/mentions (.tetra_pop with data-username)
        const tetraPops = queryRoot.querySelectorAll('.tetra_pop');
        for (let i = 0; i < tetraPops.length; i++) {
          const popEl = tetraPops[i];
          const uAttr = typeof popEl.getAttribute === 'function' ? popEl.getAttribute('data-username') : '';
          const tag = String(popEl.tagName || '').toUpperCase();
          if (uAttr && (tag === 'A' || tag === 'H1' || tag === 'H2' || tag === 'SPAN' || tag === 'P')) {
            markTarget(popEl, uAttr);
          }
        }

        // 5. Post-match player results (.playerresult > .record_owner)
        const playerResults = queryRoot.querySelectorAll('.playerresult');
        for (let i = 0; i < playerResults.length; i++) {
          const resEl = playerResults[i];
          const ownerEl = typeof resEl.querySelector === 'function' ? resEl.querySelector('.record_owner') : null;
          if (ownerEl) {
            markTarget(
              ownerEl,
              (typeof resEl.getAttribute === 'function' && resEl.getAttribute('data-username')) || ownerEl.textContent
            );
          }
        }

        // 6. Score slide player rows (.scoreslide_player > p)
        const scoreSlidePlayers = queryRoot.querySelectorAll('.scoreslide_player');
        for (let i = 0; i < scoreSlidePlayers.length; i++) {
          const ssp = scoreSlidePlayers[i];
          const pEl = typeof ssp.querySelector === 'function' ? ssp.querySelector('p') : null;
          if (pEl) {
            markTarget(pEl, pEl.textContent);
          }
        }

        // 7. Quick Play party members (.zenith_party_member_username)
        const zenithMembers = queryRoot.querySelectorAll('.zenith_party_member_username');
        for (let i = 0; i < zenithMembers.length; i++) {
          const zm = zenithMembers[i];
          const parentUser = zm.parentElement && typeof zm.parentElement.getAttribute === 'function'
            ? zm.parentElement.getAttribute('data-username')
            : '';
          markTarget(
            zm,
            (typeof zm.getAttribute === 'function' && zm.getAttribute('data-username')) || parentUser || zm.textContent
          );
        }

        // 8. FOXMOD custom UI elements (.twfox-lb-name & .twfox-paw-target)
        const lbNames = queryRoot.querySelectorAll('.twfox-lb-name');
        for (let i = 0; i < lbNames.length; i++) {
          const el = lbNames[i];
          markTarget(
            el,
            (typeof el.getAttribute === 'function' && el.getAttribute('data-username')) || el.textContent
          );
        }

        const foxTargets = queryRoot.querySelectorAll('.twfox-paw-target');
        for (let i = 0; i < foxTargets.length; i++) {
          const el = foxTargets[i];
          markTarget(
            el,
            (typeof el.getAttribute === 'function' && el.getAttribute('data-username')) || el.textContent
          );
        }

        // 8b. Social panel PEOPLE list (.social_relationship h1 > span)
        const socialRels = queryRoot.querySelectorAll('.social_relationship');
        for (let i = 0; i < socialRels.length; i++) {
          const rel = socialRels[i];
          const h1 = typeof rel.querySelector === 'function' ? rel.querySelector('h1') : null;
          const spanEl = h1 && typeof h1.querySelector === 'function' ? h1.querySelector('span') : null;
          const targetEl = spanEl || h1;
          if (targetEl) {
            markTarget(targetEl, targetEl.textContent);
          }
        }

        // 8c. Social panel NOTIFICATIONS sender (.social_notification h1 > span)
        const socialNotifs = queryRoot.querySelectorAll('.social_notification');
        for (let i = 0; i < socialNotifs.length; i++) {
          const notif = socialNotifs[i];
          const h1 = typeof notif.querySelector === 'function' ? notif.querySelector('h1') : null;
          const spanEl = h1 && typeof h1.querySelector === 'function' ? h1.querySelector('span') : null;
          if (spanEl) {
            markTarget(spanEl, spanEl.textContent);
          }
        }

        // 8d. Quick user profile card modal (.tetra_modal containing .avatar -> h2)
        const tetraModals = queryRoot.querySelectorAll('.tetra_modal');
        for (let i = 0; i < tetraModals.length; i++) {
          const modal = tetraModals[i];
          const hasAvatar = typeof modal.querySelector === 'function' ? modal.querySelector('.avatar') : null;
          const nameH2 = hasAvatar && typeof modal.querySelector === 'function' ? modal.querySelector('h2') : null;
          if (nameH2) {
            markTarget(nameH2, nameH2.textContent);
          }
        }
      }

      const dmUsernameEl = document.getElementById('social_dm_username');
      if (dmUsernameEl) {
        markTarget(dmUsernameEl, dmUsernameEl.textContent);
      }

      // 9. League / multilog player cards & Quick Play self header
      for (const boxId of ['multilog_self', 'multilog_opponent', 'leagueplayer_self', 'leagueplayer_opponent']) {
        const box = document.getElementById(boxId);
        if (!box || typeof box.querySelector !== 'function') continue;
        const nameEl = box.querySelector('.leagueplayer_name');
        if (nameEl) {
          markTarget(
            nameEl,
            (typeof box.getAttribute === 'function' && box.getAttribute('data-username')) || nameEl.textContent
          );
        }
      }

      const zenithSelfName = document.getElementById('zenith_party_self_username');
      if (zenithSelfName) {
        const zenithSelfBox = document.getElementById('zenith_party_self');
        markTarget(
          zenithSelfName,
          (zenithSelfBox && typeof zenithSelfBox.getAttribute === 'function' && zenithSelfBox.getAttribute('data-username')) ||
            zenithSelfName.textContent
        );
      }

      // Reconcile attributes idempotently without re-touching unchanged elements.
      for (const prevEl of Array.from(activeBadgedEls)) {
        if (!enabled || !targetStates.get(prevEl)) {
          logic.applyPawAttribute(prevEl, false);
          activeBadgedEls.delete(prevEl);
        }
      }

      for (const [el, active] of targetStates.entries()) {
        if (enabled && active) {
          logic.applyPawAttribute(el, true);
          activeBadgedEls.add(el);
        } else {
          logic.applyPawAttribute(el, false);
          activeBadgedEls.delete(el);
        }
      }
    }

    function scheduleScan() {
      if (destroyed || scanTimer) return;
      scanTimer = unrefTimer(setTimeout(scanDom, SCAN_DEBOUNCE_MS));
    }

    function sendPacket(bytes) {
      if (!ws || ws.readyState !== 1 || !bytes) return false;
      try {
        ws.send(bytes);
        return true;
      } catch (_) {
        return false;
      }
    }

    function stopSocketTimers() {
      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
      if (keepaliveTimer) {
        clearInterval(keepaliveTimer);
        keepaliveTimer = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }

    function closeSocket() {
      stopSocketTimers();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (closeAfterFlushTimer) {
        clearTimeout(closeAfterFlushTimer);
        closeAfterFlushTimer = null;
      }
      wsConnected = false;
      if (ws) {
        const old = ws;
        ws = null;
        try {
          if (old.readyState === 1 && p2pRoom && p2pRoom.mqttPacketDisconnect) {
            old.send(p2pRoom.mqttPacketDisconnect());
          }
        } catch (_) {}
        try {
          old.onopen = null;
          old.onmessage = null;
          old.onerror = null;
          old.onclose = null;
          old.close();
        } catch (_) {}
      }
    }

    function scheduleReconnect() {
      if (destroyed || !enabled || reconnectTimer) return;
      const brokers = (p2pRoom && Array.isArray(p2pRoom.SIGNAL_BROKERS) && p2pRoom.SIGNAL_BROKERS) || [];
      if (brokers.length === 0) return;
      const delay = reconnectDelay;
      reconnectDelay = Math.min(RECONNECT_MAX_MS, Math.round(reconnectDelay * 1.8));
      reconnectTimer = unrefTimer(setTimeout(() => {
        reconnectTimer = null;
        if (!destroyed && enabled) {
          brokerIndex = (brokerIndex + 1) % brokers.length;
          connectMqtt();
        }
      }, delay));
    }

    function syncSelfPresence(forcePublish) {
      if (!p2pRoom || !p2pRoom.mqttPacketPublish) return;
      const now = Date.now();

      if (enabled && selfNorm) {
        if (registry.upsert(selfNorm, now, api.version, now)) {
          scheduleSaveCache();
        }
        if (wsConnected) {
          const needsPublish =
            forcePublish ||
            lastPublishedUser !== selfNorm ||
            now - lastPublishedAt >= HEARTBEAT_PUBLISH_MS - 1000;
          if (needsPublish) {
            // If account switched while connected, clear old account's retained topic first.
            if (lastPublishedUser && lastPublishedUser !== selfNorm) {
              const oldTopic = logic.buildPresenceTopic(lastPublishedUser);
              if (oldTopic) sendPacket(p2pRoom.mqttPacketPublish(oldTopic, '', true));
            }
            const topic = logic.buildPresenceTopic(selfNorm);
            const payload = logic.buildPresencePayload(selfNorm, api.version, now);
            if (topic && payload && sendPacket(p2pRoom.mqttPacketPublish(topic, payload, true))) {
              lastPublishedUser = selfNorm;
              lastPublishedAt = now;
            }
          }
        }
      } else {
        const userToClear = lastPublishedUser || selfNorm;
        if (userToClear) {
          if (registry.remove(userToClear)) {
            flushCache();
          }
          if (wsConnected && lastPublishedUser) {
            const topic = logic.buildPresenceTopic(lastPublishedUser);
            if (topic) {
              sendPacket(p2pRoom.mqttPacketPublish(topic, '', true));
            }
            lastPublishedUser = '';
            lastPublishedAt = 0;
          }
        }
      }
    }

    function connectMqtt() {
      if (destroyed || !enabled || ws) return;
      if (!p2pRoom || !p2pRoom.mqttPacketConnect || !p2pRoom.createMqttFrameReader) return;
      const WsCtor = root.WebSocket || (typeof WebSocket !== 'undefined' ? WebSocket : null);
      if (typeof WsCtor !== 'function') return;

      const brokers = Array.isArray(p2pRoom.SIGNAL_BROKERS) && p2pRoom.SIGNAL_BROKERS.length > 0
        ? p2pRoom.SIGNAL_BROKERS
        : ['wss://broker.emqx.io:8084/mqtt'];
      const url = brokers[brokerIndex % brokers.length];

      let socket;
      try {
        socket = new WsCtor(url, 'mqtt');
      } catch (_) {
        scheduleReconnect();
        return;
      }

      ws = socket;
      wsConnected = false;
      try {
        socket.binaryType = 'arraybuffer';
      } catch (_) {}

      const frameReader = p2pRoom.createMqttFrameReader((packetType, flags, body) => {
        if (destroyed || socket !== ws) return;
        if (packetType === 0x20) {
          if (body && body.length >= 2 && body[1] !== 0) {
            closeSocket();
            scheduleReconnect();
            return;
          }
          if (connectTimer) {
            clearTimeout(connectTimer);
            connectTimer = null;
          }
          wsConnected = true;
          reconnectDelay = RECONNECT_MIN_MS;
          sendPacket(p2pRoom.mqttPacketSubscribe(nextPacketId(), logic.FOX_PAW_WILDCARD));
          syncSelfPresence(true);
          scanDom();
          if (keepaliveTimer) clearInterval(keepaliveTimer);
          keepaliveTimer = unrefTimer(setInterval(() => {
            if (wsConnected) sendPacket(p2pRoom.mqttPacketPingReq());
          }, KEEPALIVE_MS));
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          heartbeatTimer = unrefTimer(setInterval(() => {
            if (enabled && wsConnected && selfNorm) {
              syncSelfPresence(true);
            }
          }, HEARTBEAT_PUBLISH_MS));
        } else if (packetType === 0x30 && body && body.length >= 2) {
          const topicLen = (body[0] << 8) | body[1];
          let offset = 2 + topicLen;
          if ((flags & 0x06) !== 0) offset += 2;
          if (offset > body.length) return;
          const topic = decodeUtf8(body.slice(2, 2 + topicLen));
          const text = decodeUtf8(body.slice(offset));
          const res = registry.applyMessage(topic, text, Date.now());
          if (res.changed) {
            scheduleSaveCache();
            scheduleScan();
          }
        }
      });

      connectTimer = unrefTimer(setTimeout(() => {
        if (socket === ws && !wsConnected) {
          closeSocket();
          scheduleReconnect();
        }
      }, CONNECT_TIMEOUT_MS));

      socket.onopen = function () {
        if (destroyed || socket !== ws) {
          try { socket.close(); } catch (_) {}
          return;
        }
        const cid = 'twfp_' + Math.random().toString(16).slice(2, 12);
        try {
          socket.send(p2pRoom.mqttPacketConnect(cid));
        } catch (_) {
          closeSocket();
          scheduleReconnect();
        }
      };

      socket.onmessage = function (ev) {
        if (destroyed || socket !== ws) return;
        const data = ev && ev.data;
        if (!data) return;
        let bytes = null;
        if (ArrayBuffer.isView(data)) {
          bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        } else if (
          data instanceof ArrayBuffer ||
          Object.prototype.toString.call(data) === '[object ArrayBuffer]'
        ) {
          bytes = new Uint8Array(data);
        }
        if (!bytes) return;
        if (typeof frameReader === 'function') {
          frameReader(bytes);
        } else if (frameReader && typeof frameReader.push === 'function') {
          frameReader.push(bytes);
        }
      };

      socket.onerror = function () {
        if (socket === ws) {
          closeSocket();
          scheduleReconnect();
        }
      };

      socket.onclose = function () {
        if (socket === ws) {
          closeSocket();
          scheduleReconnect();
        }
      };
    }

    function handleStateOrConfigUpdate(stateObj, cfg) {
      if (destroyed) return;
      const nextEnabled = isConfigEnabled(cfg);
      const nextSelf = readSelfUsername(stateObj);
      const toggledOff = enabled && !nextEnabled;
      const toggledOn = !enabled && nextEnabled;
      const selfChanged = nextSelf !== selfNorm;

      enabled = nextEnabled;
      selfNorm = nextSelf;

      if (toggledOff) {
        syncSelfPresence(true);
        scanDom();
        // Keep socket open briefly so retained empty clear packet flushes cleanly.
        if (closeAfterFlushTimer) clearTimeout(closeAfterFlushTimer);
        closeAfterFlushTimer = unrefTimer(setTimeout(() => {
          closeAfterFlushTimer = null;
          if (!enabled) closeSocket();
        }, 250));
        return;
      }

      if (toggledOn) {
        if (closeAfterFlushTimer) {
          clearTimeout(closeAfterFlushTimer);
          closeAfterFlushTimer = null;
        }
        reconnectDelay = RECONNECT_MIN_MS;
        connectMqtt();
      }

      if (selfChanged || toggledOn) {
        syncSelfPresence(false);
        scanDom();
      }
    }

    const unsubscribe = api.subscribe(handleStateOrConfigUpdate);

    if (typeof document !== 'undefined' && document.body && typeof MutationObserver === 'function') {
      observer = new MutationObserver(() => {
        scheduleScan();
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['data-username']
      });
    }

    if (typeof root.addEventListener === 'function') {
      root.addEventListener('beforeunload', flushCache);
    }

    // Initial activation when enabled
    if (enabled) {
      if (selfNorm) {
        registry.upsert(selfNorm, Date.now(), api.version, Date.now());
      }
      scanDom();
      connectMqtt();
    }

    function destroy() {
      destroyed = true;
      unsubscribe();
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (scanTimer) {
        clearTimeout(scanTimer);
        scanTimer = null;
      }
      if (typeof root.removeEventListener === 'function') {
        root.removeEventListener('beforeunload', flushCache);
      }
      closeSocket();
      flushCache();
      for (const el of Array.from(activeBadgedEls)) {
        logic.applyPawAttribute(el, false);
        activeBadgedEls.delete(el);
      }
    }

    root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
    root.__TWFOX_INTERNAL__.foxPawBadge = {
      isEnabled() {
        return enabled;
      },
      hasFoxer,
      listFoxers() {
        return registry.list(Date.now());
      },
      rescan: scanDom,
      getStatus() {
        return {
          enabled,
          selfUsername: selfNorm,
          connected: wsConnected,
          lastPublishedUser,
          count: registry.size()
        };
      },
      destroy
    };
  });
}(typeof globalThis !== 'undefined' ? globalThis : window));
