(function (root) {
  'use strict';

  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  function toBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    if (typeof root.btoa === 'function') {
      return root.btoa(bin);
    }
    return Buffer.from(bytes).toString('base64');
  }

  function fromBase64(b64) {
    if (typeof root.atob === 'function') {
      const bin = root.atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
      }
      return out;
    }
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }

  function encodeUtf8(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str);
    }
    return new Uint8Array(Buffer.from(str, 'utf8'));
  }

  function decodeUtf8(bytes) {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder().decode(bytes);
    }
    return Buffer.from(bytes).toString('utf8');
  }

  async function transformStream(bytes, StreamCtor, format) {
    const stream = new StreamCtor(format);
    const writer = stream.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const reader = stream.readable.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }

  /**
   * Encodes a WebRTC SDP payload into a compact shareable FOX1/FOX0 code.
   */
  async function encodeSignal(payload) {
    const jsonBytes = encodeUtf8(JSON.stringify(payload));
    if (typeof root.CompressionStream === 'function') {
      try {
        const compressed = await transformStream(jsonBytes, root.CompressionStream, 'deflate-raw');
        return 'FOX1:' + toBase64(compressed);
      } catch (_) {}
    }
    return 'FOX0:' + toBase64(jsonBytes);
  }

  /**
   * Decodes a FOX1 or FOX0 signal code back into an SDP descriptor object.
   */
  async function decodeSignal(code) {
    const clean = String(code || '').trim().replace(/\s+/g, '');
    if (clean.startsWith('FOX1:')) {
      if (typeof root.DecompressionStream !== 'function') {
        throw new Error('This environment cannot decode FOX1 compressed invites.');
      }
      const raw = fromBase64(clean.slice(5));
      const jsonBytes = await transformStream(raw, root.DecompressionStream, 'deflate-raw');
      return JSON.parse(decodeUtf8(jsonBytes));
    }
    if (clean.startsWith('FOX0:')) {
      const jsonBytes = fromBase64(clean.slice(5));
      return JSON.parse(decodeUtf8(jsonBytes));
    }
    throw new Error('Invalid room code. Expected FOX1:... or FOX0:...');
  }

  function createDefaultPeerConnection(rtcFactory) {
    if (typeof rtcFactory === 'function') {
      return rtcFactory({ iceServers: ICE_SERVERS });
    }
    if (typeof root.RTCPeerConnection !== 'function') {
      throw new Error('WebRTC RTCPeerConnection is unavailable in this browser.');
    }
    return new root.RTCPeerConnection({ iceServers: ICE_SERVERS });
  }

  function waitForIceGathering(pc, timeoutMs) {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pc.onicegatheringstatechange = null;
        pc.onicecandidate = null;
        resolve();
      };
      const timer = setTimeout(done, timeoutMs || 2200);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') done();
      };
      pc.onicecandidate = (ev) => {
        if (!ev || !ev.candidate) done();
      };
    });
  }

  function pickAttackTarget(players, senderId, rngSeed) {
    const candidates = players.filter((p) => p.alive && p.id !== senderId);
    if (candidates.length === 0) return null;
    const idx = Math.abs(Math.floor(rngSeed)) % candidates.length;
    return candidates[idx];
  }

  /**
   * Creates a P2P Room Host where the creator's browser acts as the authoritative
   * room server for connected WebRTC peers.
   */
  function createHostServer(options) {
    const opts = options || {};
    const rtcFactory = opts.rtcFactory || null;
    const hostName = String(opts.hostName || 'HOST').trim().slice(0, 20) || 'HOST';

    const room = {
      roomName: String(opts.roomName || (hostName + "'S FOXROOM")).slice(0, 32),
      pieceSet: 'pentomino',
      garbageMultiplier: 1,
      gravityLevel: 1,
      status: 'lobby',
      round: 0,
      winner: null
    };

    const players = new Map();
    players.set('host', {
      id: 'host',
      name: hostName,
      isHost: true,
      ready: true,
      alive: true,
      lines: 0,
      attack: 0,
      vs: 0,
      wins: 0,
      board: null
    });

    const connections = new Map();
    const pendingOffers = new Map();
    const chat = [];
    const listeners = new Set();
    let nextPeerSeq = 2;
    let attackNonce = 1;

    function getSnapshot() {
      return {
        role: 'host',
        room: { ...room },
        players: Array.from(players.values()).map((p) => ({ ...p })),
        chat: chat.slice(),
        pendingInvites: pendingOffers.size
      };
    }

    function notify(eventType, detail) {
      const snapshot = getSnapshot();
      for (const fn of listeners) {
        try {
          fn(snapshot, eventType, detail || null);
        } catch (_) {}
      }
    }

    function pushChat(author, text, system) {
      const clean = String(text || '').trim().slice(0, 160);
      if (!clean) return;
      chat.push({ author, text: clean, system: Boolean(system) });
      if (chat.length > 40) chat.shift();
      broadcast({ type: 'room_state', room, players: getSnapshot().players, chat });
      notify('chat');
    }

    function sendToPeer(peerId, payload) {
      const conn = connections.get(peerId);
      if (!conn || !conn.channel || conn.channel.readyState !== 'open') return;
      try {
        conn.channel.send(JSON.stringify(payload));
      } catch (_) {}
    }

    function broadcast(payload) {
      const raw = JSON.stringify(payload);
      for (const conn of connections.values()) {
        if (conn.channel && conn.channel.readyState === 'open') {
          try {
            conn.channel.send(raw);
          } catch (_) {}
        }
      }
    }

    function broadcastRoomState() {
      broadcast({
        type: 'room_state',
        room,
        players: getSnapshot().players,
        chat
      });
      notify('room_state');
    }

    function evaluateRoundEnd() {
      if (room.status !== 'playing') return;
      const alivePlayers = Array.from(players.values()).filter((p) => p.alive);
      if (players.size >= 2 && alivePlayers.length <= 1) {
        const winner = alivePlayers[0] || null;
        if (winner) {
          winner.wins += 1;
          room.winner = winner.name;
        } else {
          room.winner = 'DRAW';
        }
        room.status = 'results';
        const endPacket = {
          type: 'round_end',
          winner: room.winner,
          players: getSnapshot().players
        };
        broadcast(endPacket);
        pushChat('SYS', `${room.winner} wins round #${room.round}!`, true);
        broadcastRoomState();
        notify('round_end', endPacket);
      } else if (players.size === 1 && alivePlayers.length === 0) {
        room.status = 'results';
        room.winner = hostName;
        const soloEndPacket = {
          type: 'round_end',
          winner: room.winner,
          players: getSnapshot().players
        };
        broadcastRoomState();
        notify('round_end', soloEndPacket);
      }
    }

    function routeAttack(senderId, amount, callout) {
      if (room.status !== 'playing' || !amount || amount <= 0) return;
      const list = Array.from(players.values());
      const target = pickAttackTarget(list, senderId, attackNonce++);
      if (!target) return;
      const sender = players.get(senderId);
      const packet = {
        type: 'garbage',
        fromId: senderId,
        fromName: sender ? sender.name : 'OPPONENT',
        amount,
        callout: callout || ''
      };
      if (target.id === 'host') {
        notify('garbage', packet);
      } else {
        sendToPeer(target.id, packet);
      }
    }

    function handlePeerMessage(peerId, raw) {
      let msg;
      try {
        msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (_) {
        return;
      }
      if (!msg || typeof msg.type !== 'string') return;
      const player = players.get(peerId);
      if (!player) return;

      switch (msg.type) {
        case 'hello':
          player.name = String(msg.name || player.name).trim().slice(0, 20) || player.name;
          pushChat('SYS', `${player.name} joined the room.`, true);
          break;
        case 'ready':
          player.ready = Boolean(msg.ready);
          broadcastRoomState();
          break;
        case 'chat':
          pushChat(player.name, msg.text, false);
          break;
        case 'board_state':
          player.board = Array.isArray(msg.board) ? msg.board : null;
          player.lines = Number(msg.lines) || 0;
          player.attack = Number(msg.attack) || 0;
          player.vs = Number(msg.vs) || 0;
          broadcast({
            type: 'peer_board',
            id: peerId,
            board: player.board,
            lines: player.lines,
            attack: player.attack,
            vs: player.vs,
            alive: player.alive
          });
          notify('peer_board', { id: peerId });
          break;
        case 'attack':
          routeAttack(peerId, Number(msg.amount) || 0, msg.callout || '');
          break;
        case 'ko':
          if (player.alive) {
            player.alive = false;
            broadcastRoomState();
            evaluateRoundEnd();
          }
          break;
      }
    }

    function attachPeerChannel(peerId, pc, channel) {
      const slotName = 'PLAYER ' + peerId.slice(1);
      connections.set(peerId, { pc, channel });
      channel.onopen = () => {
        if (!players.has(peerId)) {
          players.set(peerId, {
            id: peerId,
            name: slotName,
            isHost: false,
            ready: true,
            alive: room.status !== 'playing',
            lines: 0,
            attack: 0,
            vs: 0,
            wins: 0,
            board: null
          });
        }
        sendToPeer(peerId, { type: 'welcome', id: peerId });
        broadcastRoomState();
      };
      channel.onmessage = (ev) => handlePeerMessage(peerId, ev && ev.data);
      channel.onclose = () => {
        const left = players.get(peerId);
        connections.delete(peerId);
        players.delete(peerId);
        if (left) {
          pushChat('SYS', `${left.name} disconnected.`, true);
        } else {
          broadcastRoomState();
        }
        evaluateRoundEnd();
      };
    }

    async function createInvite(label) {
      const peerId = 'p' + nextPeerSeq++;
      const pc = createDefaultPeerConnection(rtcFactory);
      const channel = pc.createDataChannel('foxmod-room', { ordered: true });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc, 2200);
      pendingOffers.set(peerId, { pc, channel, label: label || peerId });
      notify('invite_created', { peerId });
      return {
        peerId,
        code: await encodeSignal({
          role: 'offer',
          peerId,
          roomName: room.roomName,
          hostName,
          sdp: pc.localDescription
        })
      };
    }

    async function acceptAnswer(peerId, answerCode) {
      let explicitPeerId = peerId;
      let rawCode = answerCode;
      if (rawCode === undefined) {
        rawCode = peerId;
        explicitPeerId = null;
      }
      const decoded = await decodeSignal(rawCode);
      if (!decoded || !decoded.sdp || decoded.sdp.type !== 'answer') {
        throw new Error('Invalid answer code from player.');
      }
      let targetPeerId = decoded.peerId && pendingOffers.has(decoded.peerId) ? decoded.peerId : explicitPeerId;
      if (!targetPeerId || !pendingOffers.has(targetPeerId)) {
        targetPeerId = pendingOffers.keys().next().value;
      }
      const entry = pendingOffers.get(targetPeerId);
      if (!entry) {
        throw new Error('No pending invite slot found. Generate an invite code first.');
      }
      pendingOffers.delete(targetPeerId);
      attachPeerChannel(targetPeerId, entry.pc, entry.channel);
      await entry.pc.setRemoteDescription(decoded.sdp);
      notify('peer_accepted', { peerId: targetPeerId });
      return targetPeerId;
    }

    function updateSettings(patch) {
      if (!patch || typeof patch !== 'object') return;
      if (typeof patch.roomName === 'string' && patch.roomName.trim()) {
        room.roomName = patch.roomName.trim().slice(0, 32);
      }
      if (patch.pieceSet === 'pentomino' || patch.pieceSet === 'tetromino' || patch.pieceSet === 'chaos') {
        room.pieceSet = patch.pieceSet;
      }
      if (patch.garbageMultiplier !== undefined) {
        const mult = Number(patch.garbageMultiplier);
        if (Number.isFinite(mult) && mult >= 0 && mult <= 4) room.garbageMultiplier = mult;
      }
      if (patch.gravityLevel !== undefined) {
        const grav = Math.floor(Number(patch.gravityLevel));
        if (Number.isFinite(grav) && grav >= 1 && grav <= 10) room.gravityLevel = grav;
      }
      broadcastRoomState();
    }

    function startMatch() {
      room.round += 1;
      room.status = 'playing';
      room.winner = null;
      const seed = (Date.now() ^ (room.round * 2654435761)) >>> 0;
      for (const p of players.values()) {
        p.alive = true;
        p.lines = 0;
        p.attack = 0;
        p.vs = 0;
        p.board = null;
      }
      const startPacket = {
        type: 'match_start',
        round: room.round,
        seed,
        config: {
          pieceSet: room.pieceSet,
          garbageMultiplier: room.garbageMultiplier,
          gravityLevel: room.gravityLevel
        }
      };
      broadcastRoomState();
      broadcast(startPacket);
      notify('match_start', startPacket);
      return startPacket;
    }

    function updateSelfBoard(snapshot) {
      const self = players.get('host');
      if (!self || !snapshot) return;
      self.board = snapshot.compactBoard;
      self.lines = snapshot.lines || 0;
      self.attack = snapshot.attackSent || 0;
      self.vs = Number(snapshot.vs) || 0;
      broadcast({
        type: 'peer_board',
        id: 'host',
        board: self.board,
        lines: self.lines,
        attack: self.attack,
        vs: self.vs,
        alive: self.alive
      });
    }

    function sendSelfAttack(amount, callout) {
      routeAttack('host', amount, callout);
    }

    function reportSelfKo() {
      const self = players.get('host');
      if (!self || !self.alive) return;
      self.alive = false;
      broadcastRoomState();
      evaluateRoundEnd();
    }

    function close() {
      for (const entry of pendingOffers.values()) {
        try {
          entry.pc.close();
        } catch (_) {}
      }
      pendingOffers.clear();
      for (const conn of connections.values()) {
        try {
          conn.channel.close();
          conn.pc.close();
        } catch (_) {}
      }
      connections.clear();
      listeners.clear();
    }

    return {
      subscribe(fn) {
        listeners.add(fn);
        fn(getSnapshot(), 'init', null);
        return () => listeners.delete(fn);
      },
      getSnapshot,
      createInvite,
      acceptAnswer,
      updateSettings,
      startMatch,
      sendChat(text) {
        pushChat(hostName, text, false);
      },
      updateSelfBoard,
      sendSelfAttack,
      reportSelfKo,
      close
    };
  }

  /**
   * Connects as a client peer to a Host Server's WebRTC room.
   */
  function createClientPeer(options) {
    const opts = options || {};
    const rtcFactory = opts.rtcFactory || null;
    const playerName = String(opts.playerName || 'PLAYER').trim().slice(0, 20) || 'PLAYER';

    let pc = null;
    let channel = null;
    let selfId = null;
    let connected = false;
    let ready = true;
    let room = {
      roomName: 'FOXMOD P2P ROOM',
      pieceSet: 'pentomino',
      garbageMultiplier: 1,
      gravityLevel: 1,
      status: 'connecting',
      round: 0,
      winner: null
    };
    let players = [];
    let chat = [];
    const listeners = new Set();

    function getSnapshot() {
      return {
        role: 'client',
        selfId,
        connected,
        ready,
        room: { ...room },
        players: players.map((p) => ({ ...p })),
        chat: chat.slice()
      };
    }

    function notify(eventType, detail) {
      const snapshot = getSnapshot();
      for (const fn of listeners) {
        try {
          fn(snapshot, eventType, detail || null);
        } catch (_) {}
      }
    }

    function send(payload) {
      if (!channel || channel.readyState !== 'open') return;
      try {
        channel.send(JSON.stringify(payload));
      } catch (_) {}
    }

    function handleServerMessage(raw) {
      let msg;
      try {
        msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (_) {
        return;
      }
      if (!msg || typeof msg.type !== 'string') return;

      switch (msg.type) {
        case 'welcome':
          selfId = msg.id;
          notify('welcome', { id: selfId });
          break;
        case 'room_state':
          if (msg.room) room = msg.room;
          if (Array.isArray(msg.players)) players = msg.players;
          if (Array.isArray(msg.chat)) chat = msg.chat;
          notify('room_state');
          break;
        case 'peer_board': {
          const target = players.find((p) => p.id === msg.id);
          if (target) {
            target.board = msg.board;
            target.lines = msg.lines;
            target.attack = msg.attack;
            target.vs = msg.vs;
            target.alive = msg.alive;
            notify('peer_board', { id: msg.id });
          }
          break;
        }
        case 'match_start':
          room.status = 'playing';
          room.round = msg.round;
          room.winner = null;
          notify('match_start', msg);
          break;
        case 'garbage':
          notify('garbage', msg);
          break;
        case 'round_end':
          room.status = 'results';
          room.winner = msg.winner;
          if (Array.isArray(msg.players)) players = msg.players;
          notify('round_end', msg);
          break;
      }
    }

    async function joinFromInvite(inviteCode) {
      const decoded = await decodeSignal(inviteCode);
      if (!decoded || !decoded.sdp || decoded.sdp.type !== 'offer') {
        throw new Error('Invalid invite code. Expected a host FOX1/FOX0 offer.');
      }
      if (decoded.roomName) {
        room.roomName = decoded.roomName;
      }
      pc = createDefaultPeerConnection(rtcFactory);
      pc.ondatachannel = (ev) => {
        channel = ev.channel;
        channel.onopen = () => {
          connected = true;
          send({ type: 'hello', name: playerName });
          notify('connected');
        };
        channel.onmessage = (mEv) => handleServerMessage(mEv && mEv.data);
        channel.onclose = () => {
          connected = false;
          room.status = 'disconnected';
          notify('disconnected');
        };
      };
      await pc.setRemoteDescription(decoded.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGathering(pc, 2200);
      return await encodeSignal({
        role: 'answer',
        peerId: decoded.peerId || null,
        name: playerName,
        sdp: pc.localDescription
      });
    }

    function close() {
      if (channel) {
        try {
          channel.close();
        } catch (_) {}
      }
      if (pc) {
        try {
          pc.close();
        } catch (_) {}
      }
      connected = false;
      listeners.clear();
    }

    return {
      subscribe(fn) {
        listeners.add(fn);
        fn(getSnapshot(), 'init', null);
        return () => listeners.delete(fn);
      },
      getSnapshot,
      joinFromInvite,
      setReady(val) {
        ready = Boolean(val);
        send({ type: 'ready', ready });
      },
      sendChat(text) {
        send({ type: 'chat', text });
      },
      updateSelfBoard(snapshot) {
        if (!snapshot) return;
        send({
          type: 'board_state',
          board: snapshot.compactBoard,
          lines: snapshot.lines || 0,
          attack: snapshot.attackSent || 0,
          vs: Number(snapshot.vs) || 0
        });
      },
      sendSelfAttack(amount, callout) {
        send({ type: 'attack', amount, callout });
      },
      reportSelfKo() {
        send({ type: 'ko' });
      },
      close
    };
  }

  root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
  root.__TWFOX_INTERNAL__.p2pRoom = {
    ICE_SERVERS,
    encodeSignal,
    decodeSignal,
    pickAttackTarget,
    createHostServer,
    createClientPeer
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));
