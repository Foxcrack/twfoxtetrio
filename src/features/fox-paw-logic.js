(function (root) {
  'use strict';

  const FOX_PAW_TOPIC_PREFIX = 'twfoxtetrio/v1/foxers/';
  const FOX_PAW_WILDCARD = 'twfoxtetrio/v1/foxers/+';
  const FOX_PAW_STORAGE_KEY = 'twfoxtetrio_foxers_cache_v1';
  const FOX_PAW_ATTR = 'data-twfox-paw';
  const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
  const MAX_CACHE_ENTRIES = 5000;

  // Fox paw SVG icon rendered via ::before content / background so no text/DOM children change.
  const FOX_PAW_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    '<ellipse cx="4.6" cy="9.7" rx="2.25" ry="3.05" transform="rotate(-20 4.6 9.7)" fill="#ff8426" stroke="#240b00" stroke-width="1.4"/>' +
    '<ellipse cx="9.2" cy="5.6" rx="2.25" ry="3.15" transform="rotate(-7 9.2 5.6)" fill="#ff9838" stroke="#240b00" stroke-width="1.4"/>' +
    '<ellipse cx="14.8" cy="5.6" rx="2.25" ry="3.15" transform="rotate(7 14.8 5.6)" fill="#ff9838" stroke="#240b00" stroke-width="1.4"/>' +
    '<ellipse cx="19.4" cy="9.7" rx="2.25" ry="3.05" transform="rotate(20 19.4 9.7)" fill="#ff8426" stroke="#240b00" stroke-width="1.4"/>' +
    '<path d="M12 10.6C8.3 10.6 5.6 13.7 6.1 17.2C6.4 19.6 8.3 20.9 10.1 20.1C11.1 19.7 11.6 19.3 12 19.3C12.4 19.3 12.9 19.7 13.9 20.1C15.7 20.9 17.6 19.6 17.9 17.2C18.4 13.7 15.7 10.6 12 10.6Z" fill="#ff7b1c" stroke="#240b00" stroke-width="1.45" stroke-linejoin="round"/>' +
    '<ellipse cx="12" cy="15.8" rx="2.8" ry="2.15" fill="#ffd9b3"/>' +
    '</svg>';

  const FOX_PAW_DATA_URL =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(FOX_PAW_SVG).replace(/'/g, '%27').replace(/"/g, '%22');

  const NON_PUBLISHABLE_NAMES = new Set([
    'host',
    'player',
    'you',
    'opponent',
    'guest',
    'draw',
    'system',
    'cmd',
    'sys'
  ]);

  const USERNAME_RX = /^[a-z0-9_-]{2,24}$/;

  /**
   * Normalizes a raw display or dataset username into canonical lowercase form.
   * Strips bracket tags (e.g. "[TAG] user"), trailing ": ", "(YOU)", "[KO]".
   *
   * @param {unknown} raw
   * @returns {string} Canonical username or '' when invalid / guest.
   */
  function normalizeUsername(raw) {
    if (typeof raw !== 'string') return '';
    let s = raw.trim();
    if (!s) return '';
    // Strip leading clan tag e.g. "[FOX] TWFOXCRACK"
    s = s.replace(/^\[[^\]]{1,12}\]\s*/g, '');
    // Strip leading rank prefix used in compact leaderboards e.g. "Nº1 TWFOXCRACK" or "#1 TWFOXCRACK"
    s = s.replace(/^(?:N[º°o]?\s*\d+|#\d+)\s+/i, '');
    // Strip chat sender colon or trailing status suffixes
    s = s.replace(/:\s*$/, '');
    s = s.replace(/(?:\s*\(YOU\)|\s*\[KO\])+$/gi, '').trim();
    s = s.toLowerCase();
    if (!USERNAME_RX.test(s)) return '';
    if (s.startsWith('anon-')) return '';
    return s;
  }

  /**
   * Returns true when a username represents a real TETR.IO account suitable for
   * publishing global FOXMOD presence (excludes generic placeholders / anon IDs).
   *
   * @param {unknown} raw
   * @returns {boolean}
   */
  function isPublishableUsername(raw) {
    const norm = normalizeUsername(raw);
    return Boolean(norm && !NON_PUBLISHABLE_NAMES.has(norm));
  }

  function buildPresenceTopic(username) {
    const norm = normalizeUsername(username);
    if (!norm) return '';
    return FOX_PAW_TOPIC_PREFIX + norm;
  }

  function extractUsernameFromTopic(topic) {
    if (typeof topic !== 'string' || !topic.startsWith(FOX_PAW_TOPIC_PREFIX)) {
      return '';
    }
    const rest = topic.slice(FOX_PAW_TOPIC_PREFIX.length);
    if (!rest || rest.includes('/') || rest.includes('+') || rest.includes('#')) {
      return '';
    }
    return normalizeUsername(rest);
  }

  function buildPresencePayload(username, version, nowMs) {
    const norm = normalizeUsername(username);
    if (!norm) return '';
    const ts = Math.floor(Number.isFinite(nowMs) ? nowMs : Date.now());
    return JSON.stringify({
      u: norm,
      v: version ? String(version) : '0.5.0',
      ts
    });
  }

  /**
   * Parses an MQTT PUBLISH payload for twfoxtetrio/v1/foxers/<user>.
   * Empty payloads clear a retained record; expired/malformed payloads return null.
   *
   * @param {string} topic
   * @param {string} text
   * @param {number} [nowMs]
   * @param {number} [ttlMs]
   */
  function parsePresenceMessage(topic, text, nowMs, ttlMs) {
    const username = extractUsernameFromTopic(topic);
    if (!username) return null;

    if (typeof text !== 'string' || text.trim() === '') {
      return { action: 'remove', username };
    }

    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    const effectiveTtl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS;

    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.u !== undefined && normalizeUsername(String(parsed.u)) !== username) {
        return null;
      }
      let ts = Number(parsed.ts);
      if (!Number.isFinite(ts) || ts <= 0) {
        ts = now;
      } else if (ts > now + MAX_FUTURE_SKEW_MS) {
        ts = now;
      }
      if (now - ts > effectiveTtl) {
        return { action: 'remove', username };
      }
      return {
        action: 'upsert',
        username,
        ts: Math.floor(ts),
        version: typeof parsed.v === 'string' ? parsed.v.slice(0, 24) : ''
      };
    } catch (_) {
      return null;
    }
  }

  /**
   * Maintains known FOXMOD usernames with TTL expiry and bounded serialization.
   */
  function createFoxerRegistry(options) {
    const opts = options || {};
    const ttlMs = Number.isFinite(opts.ttlMs) && opts.ttlMs > 0 ? opts.ttlMs : DEFAULT_TTL_MS;
    const maxEntries = Number.isFinite(opts.maxEntries) && opts.maxEntries > 0
      ? opts.maxEntries
      : MAX_CACHE_ENTRIES;
    const entries = new Map();

    function prune(nowMs) {
      const now = Number.isFinite(nowMs) ? nowMs : Date.now();
      let removed = 0;
      for (const [key, rec] of entries.entries()) {
        if (now - rec.ts > ttlMs) {
          entries.delete(key);
          removed++;
        }
      }
      if (entries.size > maxEntries) {
        const sorted = Array.from(entries.values()).sort((a, b) => a.ts - b.ts);
        const dropCount = entries.size - maxEntries;
        for (let i = 0; i < dropCount; i++) {
          entries.delete(sorted[i].username);
          removed++;
        }
      }
      return removed;
    }

    function upsert(username, ts, version, nowMs) {
      const norm = normalizeUsername(username);
      if (!norm) return false;
      const now = Number.isFinite(nowMs) ? nowMs : Date.now();
      let stamp = Number(ts);
      if (!Number.isFinite(stamp) || stamp <= 0) stamp = now;
      if (stamp > now + MAX_FUTURE_SKEW_MS) stamp = now;
      if (now - stamp > ttlMs) return false;

      const prev = entries.get(norm);
      if (prev && prev.ts > stamp) {
        return false;
      }
      const next = {
        username: norm,
        ts: Math.floor(stamp),
        version: version ? String(version).slice(0, 24) : (prev ? prev.version : '')
      };
      const isNew = !prev;
      entries.set(norm, next);
      if (entries.size > maxEntries) prune(now);
      return isNew || (prev && prev.version !== next.version);
    }

    function remove(username) {
      const norm = normalizeUsername(username);
      if (!norm) return false;
      return entries.delete(norm);
    }

    function applyMessage(topic, text, nowMs) {
      const msg = parsePresenceMessage(topic, text, nowMs, ttlMs);
      if (!msg) return { changed: false, action: 'ignore', username: '' };
      if (msg.action === 'remove') {
        const deleted = remove(msg.username);
        return { changed: deleted, action: 'remove', username: msg.username };
      }
      const changed = upsert(msg.username, msg.ts, msg.version, nowMs);
      return { changed, action: 'upsert', username: msg.username };
    }

    function has(username, nowMs) {
      const norm = normalizeUsername(username);
      if (!norm) return false;
      const rec = entries.get(norm);
      if (!rec) return false;
      const now = Number.isFinite(nowMs) ? nowMs : Date.now();
      if (now - rec.ts > ttlMs) {
        entries.delete(norm);
        return false;
      }
      return true;
    }

    function list(nowMs) {
      prune(nowMs);
      return Array.from(entries.values())
        .sort((a, b) => b.ts - a.ts)
        .map((r) => r.username);
    }

    function exportCache(nowMs) {
      prune(nowMs);
      const out = [];
      for (const rec of entries.values()) {
        out.push({ u: rec.username, ts: rec.ts, v: rec.version || '' });
      }
      out.sort((a, b) => b.ts - a.ts);
      return JSON.stringify(out.slice(0, maxEntries));
    }

    function importCache(raw, nowMs) {
      const now = Number.isFinite(nowMs) ? nowMs : Date.now();
      let listData = raw;
      if (typeof raw === 'string') {
        try {
          listData = JSON.parse(raw);
        } catch (_) {
          return 0;
        }
      }
      if (!Array.isArray(listData)) return 0;
      let count = 0;
      for (const item of listData) {
        if (!item || typeof item !== 'object') continue;
        if (upsert(item.u || item.username, item.ts, item.v || item.version, now)) {
          count++;
        }
      }
      return count;
    }

    if (opts.initialCache) {
      importCache(opts.initialCache, opts.nowMs);
    }

    return {
      upsert,
      remove,
      applyMessage,
      has,
      list,
      prune,
      size() {
        return entries.size;
      },
      exportCache,
      importCache
    };
  }

  /**
   * Idempotently toggles data-twfox-paw="1" without modifying child nodes or textContent.
   */
  function applyPawAttribute(el, active) {
    if (!el || typeof el.getAttribute !== 'function' || typeof el.setAttribute !== 'function') {
      return false;
    }
    const curr = el.getAttribute(FOX_PAW_ATTR);
    if (active) {
      if (curr === '1') return false;
      el.setAttribute(FOX_PAW_ATTR, '1');
      return true;
    }
    if (curr === null || curr === undefined) return false;
    if (typeof el.removeAttribute === 'function') {
      el.removeAttribute(FOX_PAW_ATTR);
    } else {
      el.setAttribute(FOX_PAW_ATTR, '');
    }
    return true;
  }

  const exported = {
    FOX_PAW_TOPIC_PREFIX,
    FOX_PAW_WILDCARD,
    FOX_PAW_STORAGE_KEY,
    FOX_PAW_ATTR,
    DEFAULT_TTL_MS,
    FOX_PAW_SVG,
    FOX_PAW_DATA_URL,
    normalizeUsername,
    isPublishableUsername,
    buildPresenceTopic,
    extractUsernameFromTopic,
    buildPresencePayload,
    parsePresenceMessage,
    createFoxerRegistry,
    applyPawAttribute
  };

  root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
  root.__TWFOX_INTERNAL__.foxPawLogic = exported;

  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = exported;
  }
}(typeof globalThis !== 'undefined' ? globalThis : window));
