'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/features/p2p-room.js');
const p2p = globalThis.__TWFOX_INTERNAL__.p2pRoom;

function createLoopbackRtcFactory() {
  const endpoints = new Map();
  let seq = 1;

  function createPairChannel(localPc, remotePc, label) {
    const a = { label, readyState: 'connecting', onopen: null, onmessage: null, onclose: null };
    const b = { label, readyState: 'connecting', onopen: null, onmessage: null, onclose: null };

    a.send = (data) => {
      if (b.onmessage) queueMicrotask(() => b.onmessage({ data }));
    };
    b.send = (data) => {
      if (a.onmessage) queueMicrotask(() => a.onmessage({ data }));
    };
    a.close = () => {
      a.readyState = 'closed';
      b.readyState = 'closed';
      if (a.onclose) a.onclose();
      if (b.onclose) b.onclose();
    };
    b.close = a.close;

    localPc._pendingOpen = () => {
      a.readyState = 'open';
      b.readyState = 'open';
      if (remotePc.ondatachannel) remotePc.ondatachannel({ channel: b });
      if (a.onopen) a.onopen();
      if (b.onopen) b.onopen();
    };

    return a;
  }

  return function rtcFactory() {
    const id = 'rtc-' + seq++;
    const pc = {
      id,
      iceGatheringState: 'complete',
      localDescription: null,
      remoteDescription: null,
      ondatachannel: null,
      _channels: [],
      _pendingOpen: null,
      createDataChannel(label) {
        const ch = {
          label,
          _placeholder: true,
          readyState: 'connecting',
          onopen: null,
          onmessage: null,
          onclose: null
        };
        pc._pendingChannel = ch;
        return ch;
      },
      async createOffer() {
        return { type: 'offer', sdp: 'v=0\r\nfrom=' + id };
      },
      async createAnswer() {
        return { type: 'answer', sdp: 'v=0\r\nfrom=' + id };
      },
      async setLocalDescription(desc) {
        pc.localDescription = desc;
      },
      async setRemoteDescription(desc) {
        pc.remoteDescription = desc;
        if (desc.type === 'answer') {
          const remoteId = desc.sdp.split('from=')[1];
          const remotePc = endpoints.get(remoteId);
          const pairCh = createPairChannel(pc, remotePc, 'foxmod-room');
          // Transfer host listener callbacks bound to _pendingChannel
          if (pc._pendingChannel) {
            pairCh.onopen = pc._pendingChannel.onopen;
            pairCh.onmessage = pc._pendingChannel.onmessage;
            pairCh.onclose = pc._pendingChannel.onclose;
            pc._pendingChannel.send = pairCh.send;
            pc._pendingChannel.close = pairCh.close;
            Object.defineProperty(pc._pendingChannel, 'readyState', {
              get: () => pairCh.readyState
            });
          }
          pc._pendingOpen();
        }
      },
      close() {}
    };
    endpoints.set(id, pc);
    return pc;
  };
}

test('signal encode/decode round-trips offer and answer descriptors cleanly', async () => {
  const payload = { role: 'offer', peerId: 'p2', sdp: { type: 'offer', sdp: 'abc123' } };
  const encoded = await p2p.encodeSignal(payload);
  assert.ok(encoded.startsWith('FOX1:') || encoded.startsWith('FOX0:'));
  const decoded = await p2p.decodeSignal(encoded);
  assert.deepEqual(decoded, payload);
});

test('HostServer runs custom P2P room lifecycle, relays settings/boards/attacks, and crowns winner', async () => {
  const rtcFactory = createLoopbackRtcFactory();
  const host = p2p.createHostServer({ hostName: 'TWFoxcrack', rtcFactory });
  const client = p2p.createClientPeer({ playerName: 'Maekrix', rtcFactory });

  const hostEvents = [];
  const clientEvents = [];
  host.subscribe((snap, ev, detail) => hostEvents.push({ snap, ev, detail }));
  client.subscribe((snap, ev, detail) => clientEvents.push({ snap, ev, detail }));

  const invite = await host.createInvite();
  const answer = await client.joinFromInvite(invite.code);
  await host.acceptAnswer(invite.peerId, answer);

  await new Promise((r) => setTimeout(r, 30));

  let hostSnap = host.getSnapshot();
  let clientSnap = client.getSnapshot();
  assert.equal(hostSnap.players.length, 2);
  assert.equal(clientSnap.connected, true);
  assert.equal(clientSnap.players.some((p) => p.name === 'Maekrix'), true);

  host.updateSettings({ pieceSet: 'chaos', garbageMultiplier: 2, gravityLevel: 3 });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(client.getSnapshot().room.pieceSet, 'chaos');
  assert.equal(client.getSnapshot().room.garbageMultiplier, 2);

  host.startMatch();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(client.getSnapshot().room.status, 'playing');

  // Client sends 4 garbage -> routed to Host server
  client.sendSelfAttack(4, 'QUAD');
  await new Promise((r) => setTimeout(r, 20));
  const garbageEv = hostEvents.find((e) => e.ev === 'garbage');
  assert.ok(garbageEv);
  assert.equal(garbageEv.detail.amount, 4);

  // Client tops out -> Host awards win to TWFoxcrack and broadcasts round_end
  client.reportSelfKo();
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(host.getSnapshot().room.status, 'results');
  assert.equal(host.getSnapshot().room.winner, 'TWFoxcrack');
  assert.equal(client.getSnapshot().room.winner, 'TWFoxcrack');

  client.close();
  host.close();
});

test('host and client connect automatically via 4-char #CODE topic signaling and sync player names', async () => {
  const rtcFactory = createLoopbackRtcFactory();
  const topics = new Map();
  let seq = 1;

  async function mockFetch(url, init) {
    const method = (init && init.method) || 'GET';
    const topicMatch = String(url).match(/\/(twfoxtetrio-v1-[A-Z0-9]+)/);
    const topic = topicMatch ? topicMatch[1] : 'unknown';
    if (!topics.has(topic)) topics.set(topic, []);
    const list = topics.get(topic);

    if (method === 'POST') {
      list.push(
        JSON.stringify({
          id: 'm' + seq++,
          event: 'message',
          topic,
          message: String(init.body || '')
        })
      );
      return { ok: true, status: 200, text: async () => '' };
    }

    const bodyText = list.join('\n') + (list.length ? '\n' : '');
    return {
      ok: true,
      status: 200,
      text: async () => bodyText
    };
  }

  const host = p2p.createHostServer({
    hostName: 'TWFoxcrack',
    rtcFactory,
    fetchFn: mockFetch,
    pollIntervalMs: 25
  });
  const roomCode = host.getSnapshot().room.roomCode;
  assert.match(roomCode, /^[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(host.getSnapshot().room.roomName, "TWFoxcrack'S FOXROOM");
  assert.equal(p2p.normalizeRoomCode(roomCode), roomCode);
  assert.equal(p2p.normalizeRoomCode('#' + roomCode.toLowerCase()), roomCode);
  assert.equal(p2p.normalizeRoomCode('Nº' + roomCode.toLowerCase()), roomCode);

  const client = p2p.createClientPeer({
    playerName: 'Maekrix',
    rtcFactory,
    fetchFn: mockFetch,
    pollIntervalMs: 25,
    joinTimeoutMs: 3000
  });

  // Works identically when entered WITHOUT '#'
  const joinRes = await client.joinByCode(roomCode.toLowerCase());
  assert.equal(joinRes.mode, 'auto');
  assert.equal(joinRes.roomCode, roomCode);

  await new Promise((r) => setTimeout(r, 80));

  const clientSnap = client.getSnapshot();
  const hostSnap = host.getSnapshot();
  assert.equal(clientSnap.connected, true);
  assert.equal(clientSnap.room.roomCode, roomCode);
  assert.equal(hostSnap.players.length, 2);
  assert.deepEqual(
    hostSnap.players.map((p) => p.name),
    ['TWFoxcrack', 'Maekrix']
  );
  assert.deepEqual(
    clientSnap.players.map((p) => p.name),
    ['TWFoxcrack', 'Maekrix']
  );

  host.sendChat('bienvenido');
  client.sendChat('hola');
  await new Promise((r) => setTimeout(r, 30));
  const messages = client.getSnapshot().chat.map((c) => `${c.author}:${c.text}`);
  assert.ok(messages.includes('TWFoxcrack:bienvenido'));
  assert.ok(messages.includes('Maekrix:hola'));

  client.close();
  host.close();
});

test('room defaults to normal tetrominoes, blocks <2 players from starting, and crowns Blitz score winner', async () => {
  const rtcFactory = createLoopbackRtcFactory();
  const host = p2p.createHostServer({ hostName: 'TWFoxcrack', rtcFactory });
  const events = [];
  host.subscribe((snap, ev, detail) => events.push({ ev, detail }));

  // Default piece set is normal tetrominoes (7) and VS mode
  assert.equal(host.getSnapshot().room.pieceSet, 'tetromino');
  assert.equal(host.getSnapshot().room.gameMode, 'vs');

  // Cannot start alone (< 2 players)
  const blocked = host.startMatch();
  assert.equal(blocked, null);
  assert.equal(host.getSnapshot().room.status, 'lobby');
  assert.ok(events.some((e) => e.ev === 'start_blocked' && e.detail && e.detail.reason === 'need_2_players'));

  // Connect 2nd player, switch to BLITZ mode, sync scores, and verify highest score wins
  const client = p2p.createClientPeer({ playerName: 'Maekrix', rtcFactory });
  const invite = await host.createInvite();
  const answer = await client.joinFromInvite(invite.code);
  await host.acceptAnswer(invite.peerId, answer);
  await new Promise((r) => setTimeout(r, 30));

  host.updateSettings({ gameMode: 'blitz' });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(client.getSnapshot().room.gameMode, 'blitz');

  const started = host.startMatch();
  assert.ok(started);
  assert.equal(started.config.gameMode, 'blitz');
  await new Promise((r) => setTimeout(r, 20));

  host.updateSelfBoard({ compactBoard: null, score: 2400, lines: 4, attackSent: 0, vs: 0 });
  client.updateSelfBoard({ compactBoard: null, score: 5800, lines: 9, attackSent: 0, vs: 0 });
  await new Promise((r) => setTimeout(r, 25));

  const ranked = host
    .getSnapshot()
    .players.slice()
    .sort((a, b) => b.score - a.score);
  assert.deepEqual(
    ranked.map((p) => `${p.name}:${p.score}`),
    ['Maekrix:5800', 'TWFoxcrack:2400']
  );

  host.reportSelfFinish({ score: 2400 });
  client.reportSelfFinish({ score: 5800 });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(host.getSnapshot().room.status, 'results');
  assert.equal(host.getSnapshot().room.winner, 'Maekrix');
  assert.equal(client.getSnapshot().room.winner, 'Maekrix');

  client.close();
  host.close();
});

test('host and client exchange WebRTC handshake via MQTT-over-WebSocket relay', async () => {
  const rtcFactory = createLoopbackRtcFactory();
  const subscriptions = new Map(); // brokerUrl -> Set<{ topic, sendPublish }>

  function createMockMqttWsFactory() {
    return function wsFactory(url) {
      if (!subscriptions.has(url)) subscriptions.set(url, new Set());
      const peers = subscriptions.get(url);
      let entry = null;

      function encodeVarLen(len) {
        const out = [];
        let v = len;
        do {
          let b = v % 128;
          v = Math.floor(v / 128);
          if (v > 0) b |= 128;
          out.push(b);
        } while (v > 0);
        return Uint8Array.from(out);
      }

      const ws = {
        readyState: 0,
        binaryType: 'arraybuffer',
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        send(data) {
          const u = new Uint8Array(data);
          const type = u[0] & 0xf0;
          if (type === 0x10) {
            queueMicrotask(() => {
              if (ws.onmessage) ws.onmessage({ data: Uint8Array.from([0x20, 0x02, 0x00, 0x00]).buffer });
            });
          } else if (type === 0x80) {
            let idx = 4;
            const tLen = (u[idx] << 8) | u[idx + 1];
            idx += 2;
            const topic = Buffer.from(u.slice(idx, idx + tLen)).toString('utf8');
            entry = { topic, ws };
            peers.add(entry);
            queueMicrotask(() => {
              if (ws.onmessage) ws.onmessage({ data: Uint8Array.from([0x90, 0x03, 0x00, 0x01, 0x00]).buffer });
            });
          } else if (type === 0x30) {
            let idx = 1;
            while ((u[idx] & 0x80) !== 0) idx++;
            idx++;
            const tLen = (u[idx] << 8) | u[idx + 1];
            const topic = Buffer.from(u.slice(idx + 2, idx + 2 + tLen)).toString('utf8');
            const payloadBytes = u.slice(idx + 2 + tLen);
            const tb = Buffer.from(topic, 'utf8');
            const body = Buffer.concat([Buffer.from([(tb.length >> 8) & 255, tb.length & 255]), tb, payloadBytes]);
            const frame = Buffer.concat([Buffer.from([0x30]), Buffer.from(encodeVarLen(body.length)), body]);
            for (const sub of peers) {
              if (sub.topic === topic && sub.ws.onmessage && sub.ws.readyState === 1) {
                queueMicrotask(() => sub.ws.onmessage({ data: Uint8Array.from(frame).buffer }));
              }
            }
          }
        },
        close() {
          ws.readyState = 3;
          if (entry) peers.delete(entry);
          if (ws.onclose) ws.onclose();
        }
      };

      queueMicrotask(() => {
        ws.readyState = 1;
        if (ws.onopen) ws.onopen();
      });
      return ws;
    };
  }

  const wsFactory = createMockMqttWsFactory();
  const host = p2p.createHostServer({
    hostName: 'TWFoxcrack',
    rtcFactory,
    wsFactory,
    brokers: ['wss://mock-emqx/mqtt', 'wss://mock-hivemq/mqtt']
  });

  await new Promise((r) => setTimeout(r, 30));
  assert.equal(host.getSnapshot().signalingStatus, 'online');
  const roomCode = host.getSnapshot().room.roomCode;

  const client = p2p.createClientPeer({
    playerName: 'Maekrix',
    rtcFactory,
    wsFactory,
    brokers: ['wss://mock-emqx/mqtt', 'wss://mock-hivemq/mqtt'],
    joinTimeoutMs: 3000
  });

  const joinRes = await client.joinByCode(roomCode);
  assert.equal(joinRes.mode, 'auto');
  assert.equal(joinRes.roomCode, roomCode);
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(client.getSnapshot().connected, true);
  assert.deepEqual(
    host.getSnapshot().players.map((p) => p.name),
    ['TWFoxcrack', 'Maekrix']
  );

  client.close();
  host.close();
});

test('3-player Versus KO ranks Nº1 survivor down to first eliminated player in standings', async () => {
  const rtcFactory = createLoopbackRtcFactory();
  const host = p2p.createHostServer({ hostName: 'TWFoxcrack', rtcFactory });
  const c2 = p2p.createClientPeer({ playerName: 'SegundoKO', rtcFactory });
  const c3 = p2p.createClientPeer({ playerName: 'PrimeroKO', rtcFactory });

  for (const [peer, name] of [[c2, 'SegundoKO'], [c3, 'PrimeroKO']]) {
    const inv = await host.createInvite(name);
    const ans = await peer.joinFromInvite(inv.code);
    await host.acceptAnswer(inv.peerId, ans);
  }
  await new Promise((r) => setTimeout(r, 35));

  assert.equal(host.getSnapshot().players.length, 3);
  host.startMatch();
  await new Promise((r) => setTimeout(r, 25));

  // PrimeroKO dies first -> provisionally Nº3 (2 alive left)
  c3.reportSelfKo({ vs: 12.5, attackSent: 2, lines: 4 });
  await new Promise((r) => setTimeout(r, 25));
  const afterFirstKo = host.getSnapshot().players.find((p) => p.name === 'PrimeroKO');
  assert.equal(afterFirstKo.alive, false);
  assert.equal(afterFirstKo.placement, 3);

  // SegundoKO dies second -> match ends: TWFoxcrack Nº1 (survivor), SegundoKO Nº2, PrimeroKO Nº3
  c2.reportSelfKo({ vs: 35.0, attackSent: 7, lines: 11 });
  await new Promise((r) => setTimeout(r, 30));

  const hostSnap = host.getSnapshot();
  const clientSnap = c2.getSnapshot();
  assert.equal(hostSnap.room.status, 'results');
  assert.equal(hostSnap.room.winner, 'TWFoxcrack');
  assert.deepEqual(
    hostSnap.room.lastResults.map((r) => `${r.placement}:${r.name}:${r.alive}`),
    ['1:TWFoxcrack:true', '2:SegundoKO:false', '3:PrimeroKO:false']
  );
  assert.deepEqual(
    clientSnap.room.lastResults.map((r) => `${r.placement}:${r.name}`),
    ['1:TWFoxcrack', '2:SegundoKO', '3:PrimeroKO']
  );

  c2.close();
  c3.close();
  host.close();
});
