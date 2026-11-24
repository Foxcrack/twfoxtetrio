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

test('client seamlessly joins via WS relay fallback when WebRTC UDP is blocked or brokers connect out-of-order', async () => {
  // Stalled WebRTC factory: completes SDP exchange, never opens DataChannel (simulates strict Symmetric NAT/firewall).
  function blockedRtcFactory() {
    return {
      iceGatheringState: 'complete',
      localDescription: null,
      remoteDescription: null,
      connectionState: 'connecting',
      iceConnectionState: 'checking',
      ondatachannel: null,
      onicecandidate: null,
      oniceconnectionstatechange: null,
      onconnectionstatechange: null,
      createDataChannel(label) {
        return { label, readyState: 'connecting', onopen: null, onmessage: null, onclose: null, send() {}, close() {} };
      },
      async createOffer() {
        return { type: 'offer', sdp: 'v=0\r\nstalled-offer' };
      },
      async createAnswer() {
        return { type: 'answer', sdp: 'v=0\r\nstalled-answer' };
      },
      async setLocalDescription(d) {
        this.localDescription = d;
      },
      async setRemoteDescription(d) {
        this.remoteDescription = d;
      },
      close() {}
    };
  }

  const subscriptions = new Map();
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

  // Broker 1 is fast (5ms); Broker 2 connects slower (60ms) so staggered multi-broker delivery is also exercised.
  function staggeredWsFactory(url) {
    if (!subscriptions.has(url)) subscriptions.set(url, new Set());
    const peers = subscriptions.get(url);
    let entry = null;
    const delay = url.includes('broker2') ? 60 : 5;

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
          queueMicrotask(() => ws.onmessage && ws.onmessage({ data: Uint8Array.from([0x20, 0x02, 0x00, 0x00]).buffer }));
        } else if (type === 0x80) {
          let idx = 4;
          const tLen = (u[idx] << 8) | u[idx + 1];
          idx += 2;
          const topic = Buffer.from(u.slice(idx, idx + tLen)).toString('utf8');
          entry = { topic, ws };
          peers.add(entry);
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

    setTimeout(() => {
      if (ws.readyState !== 0) return;
      ws.readyState = 1;
      if (ws.onopen) ws.onopen();
    }, delay);
    return ws;
  }

  // Host connected ONLY on slow broker2; Client connects on fast broker1 + slow broker2
  const host = p2p.createHostServer({
    hostName: 'TWFoxcrack',
    rtcFactory: blockedRtcFactory,
    wsFactory: staggeredWsFactory,
    brokers: ['wss://broker2/mqtt']
  });
  const roomCode = host.getSnapshot().room.roomCode;

  const clientEvents = [];
  const client = p2p.createClientPeer({
    playerName: 'StrictNatFriend',
    rtcFactory: blockedRtcFactory,
    wsFactory: staggeredWsFactory,
    brokers: ['wss://broker1/mqtt', 'wss://broker2/mqtt'],
    relayFallbackDelayMs: 220,
    joinTimeoutMs: 5000
  });
  client.subscribe((_s, ev) => clientEvents.push(ev));

  const res = await client.joinByCode(roomCode);
  assert.equal(res.roomCode, roomCode);

  const deadline = Date.now() + 2500;
  while (Date.now() < deadline && !client.getSnapshot().connected) {
    await new Promise((r) => setTimeout(r, 25));
  }

  assert.equal(client.getSnapshot().connected, true, 'Client should seamlessly connect over WS relay fallback');
  assert.ok(clientEvents.includes('relay_fallback'));
  await new Promise((r) => setTimeout(r, 35));
  assert.deepEqual(
    host.getSnapshot().players.map((p) => p.name),
    ['TWFoxcrack', 'StrictNatFriend']
  );

  // Chat, match start, garbage routing, and KO work identically over WS relay with zero duplicate delivery across brokers
  client.sendChat('hola desde nat');
  await new Promise((r) => setTimeout(r, 35));
  const chats = host.getSnapshot().chat.filter((c) => !c.system && c.text === 'hola desde nat');
  assert.equal(chats.length, 1);

  host.startMatch();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(client.getSnapshot().room.status, 'playing');

  client.reportSelfKo({ vs: 18, attackSent: 2, lines: 5 });
  await new Promise((r) => setTimeout(r, 35));
  assert.equal(host.getSnapshot().room.status, 'results');
  assert.equal(host.getSnapshot().room.winner, 'TWFoxcrack');

  client.close();
  host.close();
});

function createInMemoryMqttWsFactory() {
  const peers = new Set();

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
  function encodeUtf(text) {
    return new Uint8Array(Buffer.from(text, 'utf8'));
  }
  function buildPub(topic, text) {
    const t = encodeUtf(topic);
    const p = encodeUtf(text);
    const bodyLen = 2 + t.length + p.length;
    const vh = encodeVarLen(bodyLen);
    const frame = new Uint8Array(1 + vh.length + bodyLen);
    frame[0] = 0x30;
    frame.set(vh, 1);
    frame[1 + vh.length] = (t.length >> 8) & 0xff;
    frame[2 + vh.length] = t.length & 0xff;
    frame.set(t, 3 + vh.length);
    frame.set(p, 3 + vh.length + t.length);
    return frame;
  }
  function parsePacket(bytes) {
    const type = bytes[0] & 0xf0;
    let idx = 1;
    let mul = 1;
    let len = 0;
    let b;
    do {
      b = bytes[idx++];
      len += (b & 127) * mul;
      mul *= 128;
    } while ((b & 128) !== 0);
    if (type === 0x10) return { type: 'CONNECT' };
    if (type === 0x80) {
      const sl = (bytes[idx + 2] << 8) | bytes[idx + 3];
      return { type: 'SUBSCRIBE', topic: Buffer.from(bytes.slice(idx + 4, idx + 4 + sl)).toString('utf8') };
    }
    if (type === 0x30) {
      const tl = (bytes[idx] << 8) | bytes[idx + 1];
      return {
        type: 'PUBLISH',
        topic: Buffer.from(bytes.slice(idx + 2, idx + 2 + tl)).toString('utf8'),
        text: Buffer.from(bytes.slice(idx + 2 + tl, idx + len)).toString('utf8')
      };
    }
    return { type: 'OTHER' };
  }

  return function wsFactory() {
    const ws = {
      readyState: 0,
      binaryType: 'arraybuffer',
      topics: new Set(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      send(bytes) {
        const pkt = parsePacket(bytes);
        if (pkt.type === 'CONNECT') {
          queueMicrotask(() => {
            if (ws.onmessage) ws.onmessage({ data: Uint8Array.from([0x20, 0x02, 0x00, 0x00]).buffer });
          });
        } else if (pkt.type === 'SUBSCRIBE') {
          ws.topics.add(pkt.topic);
          peers.add(ws);
          queueMicrotask(() => {
            if (ws.onmessage) ws.onmessage({ data: Uint8Array.from([0x90, 0x03, 0x00, 0x01, 0x00]).buffer });
          });
        } else if (pkt.type === 'PUBLISH') {
          const frame = buildPub(pkt.topic, pkt.text);
          for (const sub of peers) {
            if (sub.topics.has(pkt.topic) && sub.readyState === 1 && sub.onmessage) {
              queueMicrotask(() => sub.onmessage({ data: frame.buffer }));
            }
          }
        }
      },
      close() {
        ws.readyState = 3;
        peers.delete(ws);
      }
    };
    queueMicrotask(() => {
      ws.readyState = 1;
      if (ws.onopen) ws.onopen();
    });
    return ws;
  };
}

test('race mode enforces max 4 players, waits for all ready countdown, and finalizes only when last runner dies', async () => {
  const rtcAuto = createLoopbackRtcFactory();
  const wsFactory = createInMemoryMqttWsFactory();

  const host = p2p.createHostServer({
    hostName: 'Fox1',
    gameMode: 'race',
    maxPlayers: 4,
    countdownMs: 60,
    rtcFactory: rtcAuto,
    wsFactory,
    brokers: ['wss://mock/mqtt']
  });
  const code = host.getSnapshot().room.roomCode;
  await new Promise((r) => setTimeout(r, 25));

  const c2 = p2p.createClientPeer({ playerName: 'Fox2', rtcFactory: rtcAuto, wsFactory, brokers: ['wss://mock/mqtt'] });
  const c3 = p2p.createClientPeer({ playerName: 'Fox3', rtcFactory: rtcAuto, wsFactory, brokers: ['wss://mock/mqtt'] });
  const c4 = p2p.createClientPeer({ playerName: 'Fox4', rtcFactory: rtcAuto, wsFactory, brokers: ['wss://mock/mqtt'] });
  await c2.joinByCode(code);
  await c3.joinByCode(code);
  await c4.joinByCode(code);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(host.getSnapshot().players.length, 4);

  // 5th player must be rejected because maxPlayers = 4
  const c5 = p2p.createClientPeer({
    playerName: 'Fox5Extra',
    rtcFactory: rtcAuto,
    wsFactory,
    brokers: ['wss://mock/mqtt'],
    joinTimeoutMs: 400
  });
  await assert.rejects(() => c5.joinByCode(code), /full/i);
  c5.close();

  // In race mode, players start unready -> all 4 click ready -> countdown -> playing
  assert.equal(host.getSnapshot().room.status, 'lobby');
  host.setReady(true);
  c2.setReady(true);
  c3.setReady(true);
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(host.getSnapshot().room.status, 'lobby', 'Should not launch until 4th player clicks ready');

  c4.setReady(true);
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline && host.getSnapshot().room.status !== 'playing') {
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(host.getSnapshot().room.status, 'playing', 'All 4 ready should trigger synchronized launch');

  // 3 players top out -> Race MUST stay active until the 4th (last) runner finishes
  host.reportSelfKo({ altitude: 215.4, floor: 3, score: 12000 });
  c2.reportSelfKo({ altitude: 492.8, floor: 5, score: 38000 });
  c3.reportSelfKo({ altitude: 112.0, floor: 2, score: 5000 });
  await new Promise((r) => setTimeout(r, 35));
  assert.equal(host.getSnapshot().room.status, 'playing', 'Race must continue while Fox4 is still alive');

  // Last runner dies -> Final standings rank by highest Altitude M
  c4.reportSelfKo({ altitude: 310.2, floor: 4, score: 25000 });
  await new Promise((r) => setTimeout(r, 35));
  const endSnap = host.getSnapshot();
  assert.equal(endSnap.room.status, 'results');
  assert.equal(endSnap.room.winner, 'Fox2');
  assert.deepEqual(
    endSnap.room.lastResults.map((r) => `${r.placement}:${r.name}:${r.altitude}`),
    ['1:Fox2:492.8', '2:Fox4:310.2', '3:Fox1:215.4', '4:Fox3:112']
  );

  // resetLobby clears readiness for another race while keeping all 4 connected
  host.resetLobby();
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(host.getSnapshot().room.status, 'lobby');
  assert.equal(host.getSnapshot().players.every((p) => p.ready === false), true);

  c2.close();
  c3.close();
  c4.close();
  host.close();
});


test('p2p room shares sanitized host and peer avatars and removes disconnected clients immediately on bye/close', async () => {
  const rtcAuto = createLoopbackRtcFactory();
  const wsFactory = createInMemoryMqttWsFactory();

  const host = p2p.createHostServer({
    hostName: 'TWFoxcrack',
    hostAvatar: 'https://tetr.io/user-content/avatars/host88.jpg?rv=2',
    gameMode: 'race',
    maxPlayers: 4,
    rtcFactory: rtcAuto,
    wsFactory,
    brokers: ['wss://mock/mqtt']
  });
  const code = host.getSnapshot().room.roomCode;
  await new Promise((r) => setTimeout(r, 25));

  const client = p2p.createClientPeer({
    playerName: 'MAEKRIX',
    avatar: 'https://tetr.io/user-content/avatars/maek99.jpg?rv=4',
    rtcFactory: rtcAuto,
    wsFactory,
    brokers: ['wss://mock/mqtt']
  });
  await client.joinByCode(code);
  await new Promise((r) => setTimeout(r, 35));

  const hostPlayers = host.getSnapshot().players;
  const clientPlayers = client.getSnapshot().players;
  assert.equal(hostPlayers.length, 2);
  assert.equal(hostPlayers[0].avatar, 'https://tetr.io/user-content/avatars/host88.jpg?rv=2');
  assert.equal(hostPlayers[1].avatar, 'https://tetr.io/user-content/avatars/maek99.jpg?rv=4');
  assert.equal(clientPlayers[0].avatar, 'https://tetr.io/user-content/avatars/host88.jpg?rv=2');
  assert.equal(clientPlayers[1].avatar, 'https://tetr.io/user-content/avatars/maek99.jpg?rv=4');

  // Closing client removes peer from host lobby without lingering disconnected slots
  client.close();
  await new Promise((r) => setTimeout(r, 35));
  assert.deepEqual(
    host.getSnapshot().players.map((p) => p.name),
    ['TWFoxcrack']
  );

  host.close();
});

test('p2p room relays hold, canHold, and next queue pieces between host and peers', async () => {
  const rtcAuto = createLoopbackRtcFactory();
  const wsFactory = createInMemoryMqttWsFactory();

  const host = p2p.createHostServer({
    hostName: 'HostOne',
    gameMode: 'race',
    maxPlayers: 4,
    rtcFactory: rtcAuto,
    wsFactory,
    brokers: ['wss://mock/mqtt']
  });
  const code = host.getSnapshot().room.roomCode;
  await new Promise((r) => setTimeout(r, 25));

  const peer = p2p.createClientPeer({
    playerName: 'RunnerTwo',
    rtcFactory: rtcAuto,
    wsFactory,
    brokers: ['wss://mock/mqtt']
  });
  await peer.joinByCode(code);
  await new Promise((r) => setTimeout(r, 30));

  host.setReady(true);
  peer.setReady(true);
  await new Promise((r) => setTimeout(r, 30));

  host.updateSelfBoard({
    compactBoard: Array.from({ length: 20 }, () => new Array(10).fill(null)),
    hold: 'T',
    canHold: false,
    next: ['i', 'o', 's', 'z', 'l', 'j'],
    altitude: 145.5,
    floor: 2
  });
  peer.updateSelfBoard({
    compactBoard: Array.from({ length: 20 }, () => new Array(10).fill(null)),
    hold: { type: 'I' },
    canHold: true,
    next: ['j', 'l', 't', 's', 'o'],
    altitude: 210.4,
    floor: 3
  });
  await new Promise((r) => setTimeout(r, 35));

  const peerSawHost = peer.getSnapshot().players.find((p) => p.id === 'host');
  const hostSawPeer = host.getSnapshot().players.find((p) => p.id !== 'host');
  assert.equal(peerSawHost.hold, 't');
  assert.equal(peerSawHost.canHold, false);
  assert.deepEqual(peerSawHost.next, ['i', 'o', 's', 'z', 'l']);
  assert.equal(hostSawPeer.hold, 'i');
  assert.equal(hostSawPeer.canHold, true);
  assert.deepEqual(hostSawPeer.next, ['j', 'l', 't', 's', 'o']);

  peer.close();
  host.close();
});
