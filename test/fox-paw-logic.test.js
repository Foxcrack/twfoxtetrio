'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const foxPawLogic = require('../src/features/fox-paw-logic.js');
require('../src/features/p2p-room.js');

const p2pRoom = globalThis.__TWFOX_INTERNAL__.p2pRoom;

test('normalizeUsername handles tags, case, suffixes, and rejects invalid or anon IDs', () => {
  assert.equal(foxPawLogic.normalizeUsername('TWFoxcrack'), 'twfoxcrack');
  assert.equal(foxPawLogic.normalizeUsername('[FOX] TWFoxcrack'), 'twfoxcrack');
  assert.equal(foxPawLogic.normalizeUsername('TWFoxcrack (YOU)'), 'twfoxcrack');
  assert.equal(foxPawLogic.normalizeUsername('TWFoxcrack [KO]'), 'twfoxcrack');
  assert.equal(foxPawLogic.normalizeUsername('Nº1 TWFoxcrack'), 'twfoxcrack');
  assert.equal(foxPawLogic.normalizeUsername('TWFoxcrack:'), 'twfoxcrack');
  assert.equal(foxPawLogic.normalizeUsername('user_name-2'), 'user_name-2');

  assert.equal(foxPawLogic.normalizeUsername('anon-123456'), '');
  assert.equal(foxPawLogic.normalizeUsername('[SYS]'), '');
  assert.equal(foxPawLogic.normalizeUsername('a'), '');
  assert.equal(foxPawLogic.normalizeUsername('bad name with spaces'), '');
  assert.equal(foxPawLogic.normalizeUsername(''), '');
});

test('isPublishableUsername filters placeholder labels', () => {
  assert.equal(foxPawLogic.isPublishableUsername('twfoxcrack'), true);
  assert.equal(foxPawLogic.isPublishableUsername('amigo_fox'), true);
  assert.equal(foxPawLogic.isPublishableUsername('HOST'), false);
  assert.equal(foxPawLogic.isPublishableUsername('PLAYER'), false);
  assert.equal(foxPawLogic.isPublishableUsername('anon-999'), false);
});

test('presence topic and payload helpers validate and handle retained clear', () => {
  const now = 1_750_000_000_000;
  const topic = foxPawLogic.buildPresenceTopic('TWFoxcrack');
  assert.equal(topic, 'twfoxtetrio/v1/foxers/twfoxcrack');
  assert.equal(foxPawLogic.extractUsernameFromTopic(topic), 'twfoxcrack');
  assert.equal(foxPawLogic.extractUsernameFromTopic('twfoxtetrio/v1/foxers/twfoxcrack/extra'), '');
  assert.equal(foxPawLogic.extractUsernameFromTopic('other/prefix/twfoxcrack'), '');

  const payload = foxPawLogic.buildPresencePayload('TWFoxcrack', '0.5.0', now);
  const parsed = foxPawLogic.parsePresenceMessage(topic, payload, now + 5000);
  assert.deepEqual(parsed, {
    action: 'upsert',
    username: 'twfoxcrack',
    ts: now,
    version: '0.5.0'
  });

  // Spoofed username mismatch inside payload is rejected
  const spoofed = foxPawLogic.parsePresenceMessage(
    'twfoxtetrio/v1/foxers/victim',
    JSON.stringify({ u: 'attacker', ts: now }),
    now
  );
  assert.equal(spoofed, null);

  // Empty retained payload clears the foxer
  const cleared = foxPawLogic.parsePresenceMessage(topic, '', now);
  assert.deepEqual(cleared, { action: 'remove', username: 'twfoxcrack' });

  // Stale payload older than TTL returns remove
  const stale = foxPawLogic.parsePresenceMessage(
    topic,
    JSON.stringify({ u: 'twfoxcrack', ts: now - foxPawLogic.DEFAULT_TTL_MS - 1000 }),
    now
  );
  assert.deepEqual(stale, { action: 'remove', username: 'twfoxcrack' });
});

test('createFoxerRegistry supports upsert, remove, TTL expiry, and cache roundtrip', () => {
  const now = 1_750_000_000_000;
  const reg = foxPawLogic.createFoxerRegistry({ ttlMs: 10_000, maxEntries: 3 });

  assert.equal(reg.upsert('Alpha_1', now - 1000, '0.5.0', now), true);
  assert.equal(reg.upsert('Beta_2', now, '0.5.0', now), true);
  assert.equal(reg.has('alpha_1', now), true);
  assert.equal(reg.has('UNKNOWN', now), false);

  // TTL expiry evicts Alpha_1 after +10_500ms from its stamp (now + 9500)
  assert.equal(reg.has('alpha_1', now + 9500), false);
  assert.equal(reg.has('beta_2', now + 9500), true);

  // Export & import preserves active entries
  const reg2 = foxPawLogic.createFoxerRegistry({ ttlMs: 10_000 });
  reg2.upsert('UserOne', now, '0.5.0', now);
  reg2.upsert('UserTwo', now, '0.5.0', now);
  const exported = reg2.exportCache(now);

  const restored = foxPawLogic.createFoxerRegistry({ ttlMs: 10_000, initialCache: exported, nowMs: now });
  assert.equal(restored.has('userone', now + 500), true);
  assert.equal(restored.has('usertwo', now + 500), true);

  // Empty MQTT message removes entry
  const removed = restored.applyMessage('twfoxtetrio/v1/foxers/userone', '', now + 500);
  assert.deepEqual(removed, { changed: true, action: 'remove', username: 'userone' });
  assert.equal(restored.has('userone', now + 500), false);
});

test('mqttPacketPublish encodes retain bit 0x31 only when retain=true', () => {
  const normal = p2pRoom.mqttPacketPublish('twfoxtetrio/v1/test', 'hello');
  assert.equal(normal[0], 0x30);

  const retained = p2pRoom.mqttPacketPublish('twfoxtetrio/v1/foxers/twfoxcrack', '{"u":"twfoxcrack"}', true);
  assert.equal(retained[0], 0x31);
});

test('applyPawAttribute toggles data-twfox-paw idempotently', () => {
  const attrs = new Map();
  const fakeEl = {
    getAttribute(k) {
      return attrs.has(k) ? attrs.get(k) : null;
    },
    setAttribute(k, v) {
      attrs.set(k, String(v));
    },
    removeAttribute(k) {
      attrs.delete(k);
    }
  };

  assert.equal(foxPawLogic.applyPawAttribute(fakeEl, false), false);
  assert.equal(foxPawLogic.applyPawAttribute(fakeEl, true), true);
  assert.equal(attrs.get('data-twfox-paw'), '1');
  // Second activation is a no-op (prevents MutationObserver feedback)
  assert.equal(foxPawLogic.applyPawAttribute(fakeEl, true), false);
  assert.equal(foxPawLogic.applyPawAttribute(fakeEl, false), true);
  assert.equal(attrs.has('data-twfox-paw'), false);
});
