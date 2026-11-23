(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.TWFOX_INVITE_LOGIC = api;
    root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
    root.__TWFOX_INTERNAL__.foxInviteLogic = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const INVITE_TOPIC_PREFIX = 'twfoxtetrio/v1/invites/';
  const INVITE_COOLDOWN_MS = 30000;
  const INVITE_TTL_MS = 25000;
  const CLOCK_SKEW_MS = 60000;
  const FOXMOD_INVITE_ORANGE = '#FF7B1C';
  const MUTUAL_FRIENDS_STORAGE_KEY = 'twfoxtetrio_mutual_friends_v1';
  const USERNAME_RE = /^[a-z0-9_-]{2,24}$/;
  const ROOM_CODE_RE = /^[2-9A-HJ-NP-Z]{4,8}$/;
  const NON_MUTUAL_STATUS_RE = /\b(not a friend|blocked|outgoing request|incoming request)\b/i;

  function normalizeUsername(raw) {
    if (typeof raw !== 'string') return '';
    const cleaned = raw.trim().replace(/^@+/, '').toLowerCase();
    return USERNAME_RE.test(cleaned) ? cleaned : '';
  }

  function normalizeRoomCode(raw) {
    if (typeof raw !== 'string') return '';
    const cleaned = raw.trim().replace(/^[#№]+/, '').toUpperCase();
    return ROOM_CODE_RE.test(cleaned) ? cleaned : '';
  }

  function sanitizeText(raw, maxLen) {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim().replace(/[\r\n\t]+/g, ' ');
    return maxLen && trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
  }

  function buildInviteTopic(targetUser) {
    const norm = normalizeUsername(targetUser);
    return norm ? INVITE_TOPIC_PREFIX + norm : '';
  }

  function parseInviteTopic(topic) {
    if (typeof topic !== 'string' || topic.indexOf(INVITE_TOPIC_PREFIX) !== 0) return '';
    return normalizeUsername(topic.slice(INVITE_TOPIC_PREFIX.length));
  }

  function buildInvitePayload(opts) {
    const src = opts && typeof opts === 'object' ? opts : {};
    const from = normalizeUsername(src.from);
    const roomCode = normalizeRoomCode(src.roomCode);
    const ts = Number.isFinite(Number(src.ts)) ? Math.floor(Number(src.ts)) : Date.now();
    const id = sanitizeText(src.id || '', 80) || `${from || 'host'}:${roomCode || 'room'}:${ts}`;
    const payload = {
      v: 1,
      type: 'room_invite',
      id,
      from,
      roomCode,
      roomName: sanitizeText(src.roomName || '', 48),
      gameMode: sanitizeText(src.gameMode || '', 24),
      pieceSet: sanitizeText(src.pieceSet || '', 24),
      ts
    };
    return JSON.stringify(payload);
  }

  function parseInviteMessage(topic, text, nowMs) {
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    const target = parseInviteTopic(topic);
    if (!target) return null;

    let data = null;
    if (typeof text === 'string') {
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > 2048) return null;
      try {
        data = JSON.parse(trimmed);
      } catch (_) {
        return null;
      }
    } else if (text && typeof text === 'object') {
      data = text;
    }
    if (!data || typeof data !== 'object') return null;
    if (data.type && data.type !== 'room_invite') return null;

    const from = normalizeUsername(data.from);
    if (!from || from === target) return null;

    const roomCode = normalizeRoomCode(data.roomCode);
    if (!roomCode) return null;

    const ts = Number(data.ts);
    if (!Number.isFinite(ts) || ts <= 0) return null;
    if (now - ts > INVITE_TTL_MS) return null;
    if (ts - now > CLOCK_SKEW_MS) return null;

    const id = sanitizeText(data.id || '', 80) || `${from}:${roomCode}:${ts}`;
    return {
      v: 1,
      type: 'room_invite',
      id,
      target,
      from,
      roomCode,
      roomName: sanitizeText(data.roomName || '', 48) || `${from.toUpperCase()}'s FOXROOM`,
      gameMode: sanitizeText(data.gameMode || '', 24),
      pieceSet: sanitizeText(data.pieceSet || '', 24),
      ts,
      expiresAt: ts + INVITE_TTL_MS
    };
  }

  function extractPlayerUsername(player) {
    if (typeof player === 'string') return normalizeUsername(player);
    if (!player || typeof player !== 'object') return '';
    if (player.connected === false) return '';
    return normalizeUsername(player.username || player.name || '');
  }

  function isUserInRoom(username, players) {
    const norm = normalizeUsername(username);
    if (!norm || !Array.isArray(players)) return false;
    for (let i = 0; i < players.length; i++) {
      if (extractPlayerUsername(players[i]) === norm) return true;
    }
    return false;
  }

  function createInviteTracker(cooldownMs) {
    const duration = Number.isFinite(cooldownMs) && cooldownMs >= 0 ? cooldownMs : INVITE_COOLDOWN_MS;
    const sentAtByUser = new Map();

    function getCooldownRemainingMs(username, nowMs) {
      const norm = normalizeUsername(username);
      if (!norm) return 0;
      const sentAt = sentAtByUser.get(norm);
      if (!Number.isFinite(sentAt)) return 0;
      const now = Number.isFinite(nowMs) ? nowMs : Date.now();
      const remaining = duration - Math.max(0, now - sentAt);
      if (remaining <= 0) {
        sentAtByUser.delete(norm);
        return 0;
      }
      return remaining;
    }

    function getCooldownRemainingSec(username, nowMs) {
      const rem = getCooldownRemainingMs(username, nowMs);
      return rem > 0 ? Math.ceil(rem / 1000) : 0;
    }

    function canInvite(username, nowMs, players) {
      const norm = normalizeUsername(username);
      if (!norm) return false;
      if (isUserInRoom(norm, players)) return false;
      return getCooldownRemainingMs(norm, nowMs) <= 0;
    }

    function recordSent(username, nowMs) {
      const norm = normalizeUsername(username);
      if (!norm) return false;
      const now = Number.isFinite(nowMs) ? nowMs : Date.now();
      sentAtByUser.set(norm, now);
      return true;
    }

    function clear(username) {
      if (username === undefined || username === null) {
        sentAtByUser.clear();
        return;
      }
      const norm = normalizeUsername(username);
      if (norm) sentAtByUser.delete(norm);
    }

    return {
      canInvite,
      recordSent,
      getCooldownRemainingMs,
      getCooldownRemainingSec,
      clear
    };
  }

  function resolveStorage(customStorage) {
    if (customStorage && typeof customStorage.getItem === 'function' && typeof customStorage.setItem === 'function') {
      return customStorage;
    }
    try {
      if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
        return localStorage;
      }
    } catch (_) {}
    return null;
  }

  function createMutualFriendStore(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const storageKey = opts.storageKey || MUTUAL_FRIENDS_STORAGE_KEY;
    const storage = resolveStorage(opts.storage);
    let selfUsername = normalizeUsername(opts.selfUsername || '');
    let bySelf = Object.create(null);

    function load() {
      if (!storage) return;
      try {
        const raw = storage.getItem(storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        const clean = Object.create(null);
        const owners = Object.keys(parsed);
        for (let i = 0; i < owners.length; i++) {
          const owner = normalizeUsername(owners[i]);
          if (!owner || !parsed[owners[i]] || typeof parsed[owners[i]] !== 'object') continue;
          clean[owner] = Object.create(null);
          const friends = Object.keys(parsed[owners[i]]);
          for (let j = 0; j < friends.length; j++) {
            const friend = normalizeUsername(friends[j]);
            const entry = parsed[owners[i]][friends[j]];
            if (!friend || friend === owner || !entry || typeof entry !== 'object') continue;
            clean[owner][friend] = {
              username: friend,
              updatedAt: Number.isFinite(Number(entry.updatedAt)) ? Number(entry.updatedAt) : 0,
              statusText: sanitizeText(entry.statusText || '', 64),
              invitable: Boolean(entry.invitable)
            };
          }
        }
        bySelf = clean;
      } catch (_) {}
    }

    function save() {
      if (!storage) return;
      try {
        storage.setItem(storageKey, JSON.stringify(bySelf));
      } catch (_) {}
    }

    function resolveOwner(overrideSelf) {
      return normalizeUsername(overrideSelf || selfUsername) || '_default';
    }

    function ensureBucket(owner) {
      if (!bySelf[owner]) bySelf[owner] = Object.create(null);
      return bySelf[owner];
    }

    function setSelfUsername(username) {
      const next = normalizeUsername(username);
      if (next && next !== selfUsername) {
        if (bySelf._default) {
          const targetBucket = ensureBucket(next);
          const defKeys = Object.keys(bySelf._default);
          for (let i = 0; i < defKeys.length; i++) {
            const k = defKeys[i];
            if (k !== next && (!targetBucket[k] || bySelf._default[k].updatedAt > targetBucket[k].updatedAt)) {
              targetBucket[k] = bySelf._default[k];
            }
          }
          delete bySelf._default;
          save();
        }
        selfUsername = next;
      }
      return selfUsername;
    }

    function getSelfUsername() {
      return selfUsername;
    }

    function markMutual(friendUsername, meta, overrideSelf) {
      const friend = normalizeUsername(friendUsername);
      const owner = resolveOwner(overrideSelf);
      if (!friend || (owner !== '_default' && friend === owner)) return false;
      const bucket = ensureBucket(owner);
      const info = meta && typeof meta === 'object' ? meta : {};
      const prev = bucket[friend];
      const nextStatus = info.statusText !== undefined ? sanitizeText(info.statusText, 64) : (prev ? prev.statusText : '');
      const nextInvitable = info.invitable !== undefined ? Boolean(info.invitable) : (prev ? prev.invitable : true);
      const now = Number.isFinite(Number(info.nowMs)) ? Number(info.nowMs) : Date.now();
      const changed = !prev || prev.statusText !== nextStatus || prev.invitable !== nextInvitable;
      bucket[friend] = {
        username: friend,
        updatedAt: now,
        statusText: nextStatus,
        invitable: nextInvitable
      };
      if (changed) save();
      return true;
    }

    function removeMutual(friendUsername, overrideSelf) {
      const friend = normalizeUsername(friendUsername);
      const owner = resolveOwner(overrideSelf);
      if (!friend || !bySelf[owner] || !bySelf[owner][friend]) return false;
      delete bySelf[owner][friend];
      save();
      return true;
    }

    function isMutual(friendUsername, overrideSelf) {
      const friend = normalizeUsername(friendUsername);
      const owner = resolveOwner(overrideSelf);
      if (!friend || !bySelf[owner]) return false;
      return Boolean(bySelf[owner][friend]);
    }

    function listMutual(overrideSelf, optionsObj) {
      const owner = resolveOwner(overrideSelf);
      const bucket = bySelf[owner];
      if (!bucket) return [];
      const fOpts = optionsObj && typeof optionsObj === 'object' ? optionsObj : {};
      const out = [];
      const keys = Object.keys(bucket);
      for (let i = 0; i < keys.length; i++) {
        const item = bucket[keys[i]];
        if (!item) continue;
        if (fOpts.hasFoxer && !fOpts.hasFoxer(item.username)) continue;
        out.push({
          username: item.username,
          updatedAt: item.updatedAt,
          statusText: item.statusText,
          invitable: item.invitable
        });
      }
      out.sort(function (a, b) {
        if (Boolean(b.invitable) !== Boolean(a.invitable)) return b.invitable ? 1 : -1;
        return a.username.localeCompare(b.username);
      });
      return out;
    }

    function extractFromSocialDom(rootEl, overrideSelf, nowMs) {
      const owner = resolveOwner(overrideSelf);
      const docRoot = rootEl || (typeof document !== 'undefined' ? document : null);
      if (!docRoot || typeof docRoot.querySelectorAll !== 'function') return [];
      const socialPanel =
        (typeof docRoot.getElementById === 'function' ? docRoot.getElementById('social_relationships') : null) ||
        (typeof docRoot.querySelector === 'function' ? docRoot.querySelector('#social_relationships') : null);
      const container = socialPanel || docRoot;
      const rows = container.querySelectorAll('.social_relationship');
      const seen = new Set();
      const onlineMutual = [];
      let dirty = false;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || typeof row.querySelector !== 'function') continue;
        const h1 = row.querySelector('h1');
        const spanEl = h1 && typeof h1.querySelector === 'function' ? h1.querySelector('span') : null;
        const nameEl = spanEl || h1;
        const uname = normalizeUsername(nameEl && nameEl.textContent ? nameEl.textContent : '');
        if (!uname || (owner !== '_default' && uname === owner) || seen.has(uname)) continue;
        seen.add(uname);

        const statusEl = row.querySelector('p');
        const statusText = sanitizeText(statusEl && statusEl.textContent ? statusEl.textContent : '', 64);
        if (NON_MUTUAL_STATUS_RE.test(statusText)) {
          if (removeMutual(uname, owner)) dirty = true;
          continue;
        }

        const isOffline = Boolean(row.classList && row.classList.contains('offline'));
        const inviteBtn = row.querySelector('.social_relationship_button_invite');
        const btnVisible = Boolean(inviteBtn && (!inviteBtn.classList || !inviteBtn.classList.contains('hidden')));

        if (!isOffline && btnVisible) {
          const bucket = ensureBucket(owner);
          const prev = bucket[uname];
          if (!prev || prev.statusText !== statusText || !prev.invitable) dirty = true;
          bucket[uname] = {
            username: uname,
            updatedAt: Number.isFinite(nowMs) ? nowMs : Date.now(),
            statusText,
            invitable: true
          };
          onlineMutual.push(bucket[uname]);
        }
      }

      if (dirty) save();
      return onlineMutual;
    }

    function ingestNotificationText(text, overrideSelf, nowMs) {
      if (typeof text !== 'string') return '';
      const match = text.match(/^\s*@?([a-zA-Z0-9_-]{2,24})\s+has friended you back\b/i);
      if (!match) return '';
      const uname = normalizeUsername(match[1]);
      if (!uname) return '';
      markMutual(uname, { statusText: 'Mutual friend', invitable: true, nowMs }, overrideSelf);
      return uname;
    }

    load();

    return {
      setSelfUsername,
      getSelfUsername,
      markMutual,
      removeMutual,
      isMutual,
      listMutual,
      extractFromSocialDom,
      ingestNotificationText
    };
  }

  return {
    INVITE_TOPIC_PREFIX,
    INVITE_COOLDOWN_MS,
    INVITE_TTL_MS,
    FOXMOD_INVITE_ORANGE,
    MUTUAL_FRIENDS_STORAGE_KEY,
    normalizeUsername,
    normalizeRoomCode,
    buildInviteTopic,
    parseInviteTopic,
    buildInvitePayload,
    parseInviteMessage,
    isUserInRoom,
    createInviteTracker,
    createMutualFriendStore
  };
});
