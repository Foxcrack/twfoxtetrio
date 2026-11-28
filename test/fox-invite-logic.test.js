'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const inviteLogic = require('../src/features/fox-invite-logic.js');

test('invite topic and payload builders validate room codes, sender spoofing, and 25s TTL', () => {
  const now = 1_750_000_000_000;
  assert.equal(inviteLogic.buildInviteTopic('@TWFoxcrack'), 'twfoxtetrio/v1/invites/twfoxcrack');
  assert.equal(inviteLogic.buildInviteTopic('a'), '');
  assert.equal(inviteLogic.parseInviteTopic('twfoxtetrio/v1/invites/Amigo_Fox'), 'amigo_fox');
  assert.equal(inviteLogic.parseInviteTopic('twfoxtetrio/v1/foxers/amigo_fox'), '');

  const raw = inviteLogic.buildInvitePayload({
    id: 'inv-1',
    from: 'TWFoxcrack',
    roomCode: '#k7m4',
    roomName: "TWFOXCRACK's FOXROOM",
    gameMode: 'vs',
    pieceSet: 'pentomino',
    ts: now
  });

  const parsed = inviteLogic.parseInviteMessage('twfoxtetrio/v1/invites/amigo_fox', raw, now + 5_000);
  assert.deepEqual(parsed, {
    v: 1,
    type: 'room_invite',
    id: 'inv-1',
    target: 'amigo_fox',
    from: 'twfoxcrack',
    roomCode: 'K7M4',
    roomName: "TWFOXCRACK's FOXROOM",
    gameMode: 'vs',
    pieceSet: 'pentomino',
    ts: now,
    expiresAt: now + inviteLogic.INVITE_TTL_MS
  });

  // Self-invite rejected
  assert.equal(inviteLogic.parseInviteMessage('twfoxtetrio/v1/invites/twfoxcrack', raw, now), null);

  // Invalid room codes rejected (I/O/0/1 are excluded in [2-9A-HJ-NP-Z])
  const badCodePayload = inviteLogic.buildInvitePayload({
    from: 'twfoxcrack',
    roomCode: 'AB10',
    ts: now
  });
  assert.equal(inviteLogic.parseInviteMessage('twfoxtetrio/v1/invites/amigo_fox', badCodePayload, now), null);

  // Expired payload rejected (> INVITE_TTL_MS)
  assert.equal(
    inviteLogic.parseInviteMessage('twfoxtetrio/v1/invites/amigo_fox', raw, now + inviteLogic.INVITE_TTL_MS + 1),
    null
  );
});

test('invite tracker enforces 30s countdown per friend and blocks players already inside the room', () => {
  const tracker = inviteLogic.createInviteTracker(30_000);
  const t0 = 1_750_000_000_000;
  const playersInRoom = [
    { id: 'host', name: 'TWFoxcrack', isHost: true },
    { id: 'p2', name: 'AlejandroAlzate', isHost: false }
  ];

  // Already in room -> blocked immediately
  assert.equal(inviteLogic.isUserInRoom('AlejandroAlzate', playersInRoom), true);
  assert.equal(inviteLogic.isUserInRoom('otro_fox', playersInRoom), false);
  assert.equal(tracker.canInvite('alejandroalzate', t0, playersInRoom), false);

  // Eligible friend -> can invite once, then 30s countdown ticks down and expires
  assert.equal(tracker.canInvite('amigo_fox', t0, playersInRoom), true);
  assert.equal(tracker.getCooldownRemainingSec('amigo_fox', t0), 0);

  tracker.recordSent('AMIGO_FOX', t0);
  assert.equal(tracker.canInvite('amigo_fox', t0, playersInRoom), false);
  assert.equal(tracker.getCooldownRemainingSec('amigo_fox', t0), 30);
  assert.equal(tracker.getCooldownRemainingSec('amigo_fox', t0 + 10_500), 20);
  assert.equal(tracker.getCooldownRemainingSec('amigo_fox', t0 + 29_100), 1);

  // Separate user is unaffected by amigo_fox cooldown
  assert.equal(tracker.canInvite('tercero_fox', t0 + 5_000, playersInRoom), true);

  // After 30s expires -> amigo_fox can be invited again
  assert.equal(tracker.getCooldownRemainingSec('amigo_fox', t0 + 30_000), 0);
  assert.equal(tracker.canInvite('amigo_fox', t0 + 30_000, playersInRoom), true);
});

test('mutual friend store extracts server-verified mutual friends and persists per user', () => {
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v))
  };

  function makeRow(username, statusText, { offline = false, invitable = false } = {}) {
    return {
      classList: { contains: (cls) => cls === 'offline' && offline },
      querySelector(sel) {
        if (sel === 'h1') {
          return {
            textContent: username,
            querySelector(inner) {
              return inner === 'span' ? { textContent: username } : null;
            }
          };
        }
        if (sel === 'p') return { textContent: statusText };
        if (sel === '.social_relationship_button_invite') {
          return { classList: { contains: (cls) => cls === 'hidden' && !invitable } };
        }
        return null;
      }
    };
  }

  const fakeSocialRoot = {
    getElementById(id) {
      return id === 'social_relationships' ? this : null;
    },
    querySelectorAll(sel) {
      if (sel !== '.social_relationship') return [];
      return [
        makeRow('Amigo_Fox', 'In Menus', { offline: false, invitable: true }),
        makeRow('Stranger_Req', 'Not a friend', { offline: false, invitable: true }),
        makeRow('Offline_Pal', 'Last seen 1h', { offline: true, invitable: false }),
        makeRow('Blocked_User', 'Blocked', { offline: false, invitable: false })
      ];
    }
  };

  const store = inviteLogic.createMutualFriendStore({ storage, selfUsername: 'twfoxcrack' });
  const extracted = store.extractFromSocialDom(fakeSocialRoot, 'twfoxcrack', 1000);
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].username, 'amigo_fox');

  // "has friended you back" notification also marks mutual friend
  assert.equal(store.ingestNotificationText('321MRHAATZ has friended you back', 'twfoxcrack', 2000), '321mrhaatz');
  assert.equal(store.ingestNotificationText('KOSMO_Z has added you to their friends list', 'twfoxcrack', 2000), '');

  const foxersOnly = store.listMutual('twfoxcrack', {
    hasFoxer: (u) => u === 'amigo_fox'
  });
  assert.deepEqual(
    foxersOnly.map((x) => x.username),
    ['amigo_fox']
  );

  // Reloading from storage restores cached mutual friends for twfoxcrack
  const reloaded = inviteLogic.createMutualFriendStore({ storage, selfUsername: 'twfoxcrack' });
  assert.equal(reloaded.isMutual('amigo_fox'), true);
  assert.equal(reloaded.isMutual('321mrhaatz'), true);
  assert.equal(reloaded.isMutual('stranger_req'), false);
  assert.equal(reloaded.isMutual('blocked_user'), false);
});

test('classifyInviteAvailability and extractFromSocialDom block Busy and In-TL friends while capturing avatarUrl', () => {
  const busyRes = inviteLogic.classifyInviteAvailability({
    statusText: 'Busy',
    statusHtml: '<img src="/res/status/busy.png"> Busy'
  });
  assert.deepEqual(busyRes, { invitable: false, reason: 'busy', badge: 'BUSY' });

  const tlRes = inviteLogic.classifyInviteAvailability({
    statusText: 'Playing TETRA LEAGUE',
    statusHtml: 'In a TETRA LEAGUE game'
  });
  assert.deepEqual(tlRes, { invitable: false, reason: 'league', badge: 'IN TL' });

  const queueRes = inviteLogic.classifyInviteAvailability({
    statusText: 'In TETRA LEAGUE queue'
  });
  assert.deepEqual(queueRes, { invitable: false, reason: 'league', badge: 'IN TL' });

  const readyRes = inviteLogic.classifyInviteAvailability({
    statusText: 'Online',
    statusHtml: '<img src="/res/status/online.png"> Online'
  });
  assert.deepEqual(readyRes, { invitable: true, reason: '', badge: '' });

  function makeFriendRow(name, statusText, statusHtml, avatarSrc, opts) {
    const o = opts || {};
    const h1 = { querySelector: () => ({ textContent: name }) };
    const p = { textContent: statusText, innerHTML: statusHtml || '' };
    const btn = { classList: { contains: () => Boolean(o.btnHidden) } };
    const img = avatarSrc ? { src: avatarSrc, getAttribute: (k) => (k === 'src' ? avatarSrc : null) } : null;
    return {
      classList: { contains: (cls) => Boolean(o[cls]) },
      getAttribute: (k) => (k === 'title' ? (o.title || '') : ''),
      querySelector: (sel) => {
        if (sel === 'h1') return h1;
        if (sel === 'p') return p;
        if (sel === '.social_relationship_button_invite') return btn;
        if (sel === '.social_relationship_img') return img;
        return null;
      }
    };
  }

  const fakeDoc = {
    getElementById: (id) => (id === 'social_relationships' ? {
      querySelectorAll: (sel) => (sel === '.social_relationship' ? [
        makeFriendRow('maekrix', 'Online', '', 'https://tetr.io/user-content/avatars/m1.jpg?rv=2'),
        makeFriendRow('busyfox', 'Busy', '<img src="/res/status/busy.png">', 'https://tetr.io/user-content/avatars/b1.jpg?rv=1', { busy: true }),
        makeFriendRow('tlchamp', 'In TETRA LEAGUE queue', '', 'https://tetr.io/user-content/avatars/t1.jpg?rv=3')
      ] : [])
    } : null),
    querySelectorAll: () => []
  };

  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); }
  };
  const store = inviteLogic.createMutualFriendStore({ storage, selfUsername: 'twfoxcrack' });
  const list = store.extractFromSocialDom(fakeDoc, 'twfoxcrack', 5000);
  assert.equal(list.length, 3);

  const byName = Object.fromEntries(list.map((entry) => [entry.username, entry]));
  assert.equal(byName.maekrix.invitable, true);
  assert.equal(byName.maekrix.avatarUrl, 'https://tetr.io/user-content/avatars/m1.jpg?rv=2');

  assert.equal(byName.busyfox.invitable, false);
  assert.equal(byName.busyfox.busyReason, 'busy');
  assert.equal(byName.busyfox.avatarUrl, 'https://tetr.io/user-content/avatars/b1.jpg?rv=1');

  assert.equal(byName.tlchamp.invitable, false);
  assert.equal(byName.tlchamp.busyReason, 'league');
  assert.equal(byName.tlchamp.avatarUrl, 'https://tetr.io/user-content/avatars/t1.jpg?rv=3');
});

test('extractFromSocialDom tracks Quick Play friends with hidden official invite btn and offline transitions', () => {
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); }
  };
  let qpRowOffline = true;
  let qpStatusText = 'Offline';
  let qpStatusHtml = '<img src="/res/status/offline.png"> Offline';

  const row = {
    classList: { contains: (cls) => cls === 'offline' && qpRowOffline },
    getAttribute: () => '',
    querySelector(sel) {
      if (sel === 'h1') return { querySelector: () => ({ textContent: 'qp_buddy' }) };
      if (sel === 'p') return { textContent: qpStatusText, innerHTML: qpStatusHtml };
      if (sel === '.social_relationship_button_invite') {
        // Official TETR.IO button stays hidden inside Quick Play!
        return { classList: { contains: (cls) => cls === 'hidden' } };
      }
      return null;
    }
  };
  const fakeDoc = {
    getElementById: (id) => (id === 'social_relationships' ? { querySelectorAll: () => [row] } : null),
    querySelectorAll: () => []
  };

  const store = inviteLogic.createMutualFriendStore({ storage, selfUsername: 'twfoxcrack' });
  store.markMutual('qp_buddy', { statusText: 'Offline', invitable: false, busyReason: 'offline', nowMs: 1000 });
  const revBefore = store.getRevision();

  // Friend enters Quick Play -> row loses .offline and shows Playing Quick Play even with hidden official button
  qpRowOffline = false;
  qpStatusText = 'Playing Quick Play';
  qpStatusHtml = '<img src="/res/status/online.png"> Playing Quick Play';
  const onlineList = store.extractFromSocialDom(fakeDoc, 'twfoxcrack', 2000);
  assert.equal(onlineList.length, 1);
  assert.equal(onlineList[0].username, 'qp_buddy');
  assert.equal(onlineList[0].invitable, true);
  assert.equal(onlineList[0].busyReason, '');
  assert.equal(onlineList[0].statusText, 'Playing Quick Play');
  assert.equal(store.getRevision() > revBefore, true);

  // Friend disconnects later -> marked cleanly offline once (subsequent scans stay idempotent)
  qpRowOffline = true;
  qpStatusText = 'Offline';
  qpStatusHtml = '<img src="/res/status/offline.png"> Offline';
  const revOnline = store.getRevision();
  const afterOff = store.extractFromSocialDom(fakeDoc, 'twfoxcrack', 3000);
  assert.equal(afterOff.length, 0);
  assert.equal(store.getRevision(), revOnline + 1);
  const stored = store.listMutual('twfoxcrack').find((x) => x.username === 'qp_buddy');
  assert.equal(stored.busyReason, 'offline');
  assert.equal(stored.invitable, false);

  store.extractFromSocialDom(fakeDoc, 'twfoxcrack', 4000);
  assert.equal(store.getRevision(), revOnline + 1);
});
