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

  // Verify host and clients receive the exact same random seed in match_start (yielding identical bags per round)
  const hostStarts = [];
  const clientStarts = [];
  host.subscribe((_s, ev, detail) => {
    if (ev === 'match_start') hostStarts.push(detail.seed);
  });
  c2.subscribe((_s, ev, detail) => {
    if (ev === 'match_start') clientStarts.push(detail.seed);
  });
  c3.subscribe((_s, ev, detail) => {
    if (ev === 'match_start') clientStarts.push(detail.seed);
  });
  host.updateSettings({ pieceSet: 'pentomino' });
  host.startMatch();
  await new Promise((r) => setTimeout(r, 30));
  host.reportSelfKo({});
  c3.reportSelfKo({});
  await new Promise((r) => setTimeout(r, 30));
  host.startMatch();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(hostStarts.length, 2);
  assert.notEqual(hostStarts[0], hostStarts[1], 'Each round must generate a fresh seed');
  assert.equal(clientStarts[0], hostStarts[0], 'Peers must receive identical seed for identical pentomino bags');
  assert.equal(clientStarts[1], hostStarts[0]);

  c2.close();
  c3.close();
  host.close();
});

test('room supports playing <-> spectating toggle and excludes spectators from match start and standings', async () => {
  const rtcFactory = createLoopbackRtcFactory();
  const host = p2p.createHostServer({ hostName: 'TWFoxcrack', rtcFactory });
  const c2 = p2p.createClientPeer({ playerName: 'PlayerTwo', rtcFactory });
  const c3 = p2p.createClientPeer({ playerName: 'SpecFriend', rtcFactory });

  for (const [peer, name] of [[c2, 'PlayerTwo'], [c3, 'SpecFriend']]) {
    const inv = await host.createInvite(name);
    const ans = await peer.joinFromInvite(inv.code);
    await host.acceptAnswer(inv.peerId, ans);
  }
  await new Promise((r) => setTimeout(r, 35));

  c3.setSpectator(true);
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(host.getSnapshot().players.find((p) => p.name === 'SpecFriend').spectator, true);

  c2.setSpectator(true);
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(host.startMatch(), null);

  c2.setSpectator(false);
  await new Promise((r) => setTimeout(r, 25));
  const started = host.startMatch();
  assert.ok(started);
  await new Promise((r) => setTimeout(r, 25));
  const specInGame = host.getSnapshot().players.find((p) => p.name === 'SpecFriend');
  assert.equal(specInGame.alive, false);

  c2.reportSelfKo({ vs: 22.0, attackSent: 4, lines: 8 });
  await new Promise((r) => setTimeout(r, 25));
  const results = host.getSnapshot().room.lastResults;
  assert.deepEqual(
    results.map((r) => r.name),
    ['TWFoxcrack', 'PlayerTwo']
  );

  c3.close();
  c2.close();
  host.close();
});

test('host evicts peers that crash/time out (heartbeat) or drop connectionState, and awards win if playing', async () => {
  const rtcFactory = createLoopbackRtcFactory();
  const host = p2p.createHostServer({
    hostName: 'TWFoxcrack',
    rtcFactory,
    heartbeatIntervalMs: 30,
    heartbeatTimeoutMs: 95
  });

  // Create a custom client peer whose channel stalls silently (never replies to ping and never fires onclose)
  const silentHostInv = await host.createInvite('SilentCrasher');
  const peerPc = rtcFactory();
  let capturedChannel = null;
  peerPc.ondatachannel = (ev) => {
    capturedChannel = ev.channel;
    capturedChannel.onopen = () => {
      capturedChannel.send(JSON.stringify({ type: 'hello', name: 'SilentCrasher' }));
    };
    // Intentionally swallow ping messages without sending pong to simulate hung/closed Electron process
    capturedChannel.onmessage = () => {};
  };
  const decodedOffer = await p2p.decodeSignal(silentHostInv.code);
  await peerPc.setRemoteDescription(decodedOffer.sdp);
  const ansSdp = await peerPc.createAnswer();
  await peerPc.setLocalDescription(ansSdp);
  const ansCode = await p2p.encodeSignal({
    role: 'answer',
    peerId: decodedOffer.peerId,
    name: 'SilentCrasher',
    sdp: peerPc.localDescription
  });
  await host.acceptAnswer(silentHostInv.peerId, ansCode);
  await new Promise((r) => setTimeout(r, 35));

  assert.equal(host.getSnapshot().players.length, 2);
  host.startMatch();
  await new Promise((r) => setTimeout(r, 20));

  // Wait past heartbeatTimeoutMs (95ms) without pong -> Host auto-evicts SilentCrasher & ends round
  await new Promise((r) => setTimeout(r, 150));
  const afterTimeout = host.getSnapshot();
  assert.equal(afterTimeout.players.length, 1);
  assert.equal(afterTimeout.players[0].name, 'TWFoxcrack');
  assert.equal(afterTimeout.room.status, 'results');
  assert.equal(afterTimeout.room.winner, 'TWFoxcrack');
  assert.ok(afterTimeout.chat.some((c) => /SilentCrasher timed out/i.test(c.text)));

  host.close();
});

test('host_closed fires on manual P2P host exit and auto-signaling rooms elect next host deterministically', async () => {
  // 1. Manual fallback (no signaling relay) -> host.close() emits host_closed on remaining client
  const rtcManual = createLoopbackRtcFactory();
  const manualHost = p2p.createHostServer({ hostName: 'HostOne', rtcFactory: rtcManual, autoSignaling: false });
  const manualClient = p2p.createClientPeer({ playerName: 'GuestOne', rtcFactory: rtcManual });
  const manualEvents = [];
  manualClient.subscribe((_s, ev, detail) => manualEvents.push({ ev, detail }));

  const manInv = await manualHost.createInvite();
  const manAns = await manualClient.joinFromInvite(manInv.code);
  await manualHost.acceptAnswer(manInv.peerId, manAns);
  await new Promise((r) => setTimeout(r, 30));

  manualHost.close();
  await new Promise((r) => setTimeout(r, 30));
  const closedEv = manualEvents.find((e) => e.ev === 'host_closed');
  assert.ok(closedEv, 'Manual P2P client should receive host_closed when Host leaves');
  assert.equal(closedEv.detail.hostName, 'HostOne');
  assert.equal(manualClient.getSnapshot().room.status, 'disconnected');
  manualClient.close();

  // 2. Online MQTT room with 3 players -> when Host leaves, Client 2 rotates to HOST and Client 3 reconnects to Client 2!
  const rtcAuto = createLoopbackRtcFactory();
  const brokerPeers = new Set();
  function wsFactory() {
    let subTopic = null;
    const ws = {
      readyState: 0,
      binaryType: 'arraybuffer',
      onopen: null,
      onmessage: null,
      onclose: null,
      send(data) {
        const u = new Uint8Array(data);
        const type = u[0] & 0xf0;
        if (type === 0x10) {
          queueMicrotask(() => ws.onmessage && ws.onmessage({ data: Uint8Array.from([0x20, 0x02, 0x00, 0x00]).buffer }));
        } else if (type === 0x80) {
          let idx = 4;
          const tLen = (u[idx] << 8) | u[idx + 1];
          idx += 2;
          subTopic = Buffer.from(u.slice(idx, idx + tLen)).toString('utf8');
          brokerPeers.add(ws);
          ws._topic = subTopic;
          queueMicrotask(() => ws.onmessage && ws.onmessage({ data: Uint8Array.from([0x90, 0x03, 0x00, 0x01, 0x00]).buffer }));
        } else if (type === 0x30) {
          let idx = 1;
          while ((u[idx] & 0x80) !== 0) idx++;
          idx++;
          const tLen = (u[idx] << 8) | u[idx + 1];
          const topic = Buffer.from(u.slice(idx + 2, idx + 2 + tLen)).toString('utf8');
          const payloadBytes = u.slice(idx + 2 + tLen);
          const tb = Buffer.from(topic, 'utf8');
          const body = Buffer.concat([Buffer.from([(tb.length >> 8) & 255, tb.length & 255]), tb, payloadBytes]);
          const lenBytes = [];
          let v = body.length;
          do {
            let b = v % 128;
            v = Math.floor(v / 128);
            if (v > 0) b |= 128;
            lenBytes.push(b);
          } while (v > 0);
          const frame = Buffer.concat([Buffer.from([0x30]), Buffer.from(lenBytes), body]);
          for (const sub of brokerPeers) {
            if (sub._topic === topic && sub.onmessage && sub.readyState === 1) {
              queueMicrotask(() => sub.onmessage({ data: Uint8Array.from(frame).buffer }));
            }
          }
        }
      },
      close() {
        ws.readyState = 3;
        brokerPeers.delete(ws);
        if (ws.onclose) ws.onclose();
      }
    };
    queueMicrotask(() => {
      ws.readyState = 1;
      if (ws.onopen) ws.onopen();
    });
    return ws;
  }

  const hostA = p2p.createHostServer({ hostName: 'HostA', rtcFactory: rtcAuto, wsFactory, brokers: ['wss://mock/mqtt'] });
  const code = hostA.getSnapshot().room.roomCode;
  await new Promise((r) => setTimeout(r, 25));
  hostA.updateSettings({ pieceSet: 'pentomino', gameMode: 'blitz' });

  const c2 = p2p.createClientPeer({ playerName: 'NewHostB', rtcFactory: rtcAuto, wsFactory, brokers: ['wss://mock/mqtt'] });
  const c3 = p2p.createClientPeer({ playerName: 'ClientC', rtcFactory: rtcAuto, wsFactory, brokers: ['wss://mock/mqtt'] });
  const c2Events = [];
  const c3Events = [];
  c2.subscribe((_s, ev, detail) => c2Events.push({ ev, detail }));
  c3.subscribe((_s, ev, detail) => c3Events.push({ ev, detail }));

  await c2.joinByCode(code);
  await new Promise((r) => setTimeout(r, 35));
  await c3.joinByCode(code);
  await new Promise((r) => setTimeout(r, 35));
  assert.equal(hostA.getSnapshot().players.length, 3);

  // HostA closes -> Client 2 gets host_migrate_self with preserved settings; Client 3 gets host_migrating naming NewHostB
  hostA.close();
  await new Promise((r) => setTimeout(r, 35));

  const promoEv = c2Events.find((e) => e.ev === 'host_migrate_self');
  const migEv = c3Events.find((e) => e.ev === 'host_migrating');
  assert.ok(promoEv, 'First non-host player should be elected new HOST');
  assert.equal(promoEv.detail.roomCode, code);
  assert.equal(promoEv.detail.pieceSet, 'pentomino');
  assert.equal(promoEv.detail.gameMode, 'blitz');
  assert.ok(migEv, 'Remaining client should receive host_migrating pointing to NewHostB');
  assert.equal(migEv.detail.successorName, 'NewHostB');

  // NewHostB promotes cleanly preserving #CODE & settings, and ClientC joins NewHostB's room automatically
  c2.close();
  c3.close();
  const hostB = p2p.createHostServer({
    hostName: 'NewHostB',
    roomCode: promoEv.detail.roomCode,
    pieceSet: promoEv.detail.pieceSet,
    gameMode: promoEv.detail.gameMode,
    rtcFactory: rtcAuto,
    wsFactory,
    brokers: ['wss://mock/mqtt']
  });
  await new Promise((r) => setTimeout(r, 25));
  const c3Rejoined = p2p.createClientPeer({ playerName: 'ClientC', rtcFactory: rtcAuto, wsFactory, brokers: ['wss://mock/mqtt'] });
  await c3Rejoined.joinByCode(code);
  await new Promise((r) => setTimeout(r, 40));

  const newSnap = hostB.getSnapshot();
  assert.equal(newSnap.room.roomCode, code);
  assert.equal(newSnap.room.pieceSet, 'pentomino');
  assert.deepEqual(
    newSnap.players.map((p) => p.name),
    ['NewHostB', 'ClientC']
  );

  c3Rejoined.close();
  hostB.close();
});
