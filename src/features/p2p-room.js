(function (root) {
  'use strict';

  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const SIGNAL_BASE_URL = 'https://ntfy.sh';
  const SIGNAL_TOPIC_PREFIX = 'twfoxtetrio-v1-';

  function generateRoomCode(length) {
    const size = Math.max(4, Math.min(8, Number(length) || 4));
    let out = '';
    for (let i = 0; i < size; i++) {
      const idx = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
      out += ROOM_CODE_ALPHABET[idx];
    }
    return out;
  }

  function normalizeRoomCode(raw) {
    const cleaned = String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/^#+/, '')
      .replace(/[^0-9A-Z]/g, '');
    return /^[2-9A-HJ-NP-Z]{4,8}$/.test(cleaned) ? cleaned : '';
  }

  function isManualSignalCode(raw) {
    return /^FOX[01]:/i.test(String(raw || '').trim());
  }

  function resolveFetch(opts) {
    if (opts && typeof opts.fetchFn === 'function') return opts.fetchFn;
    if (typeof root.fetch === 'function') return root.fetch.bind(root);
    return null;
  }

  function buildTopicUrl(roomCode) {
    return `${SIGNAL_BASE_URL}/${SIGNAL_TOPIC_PREFIX}${normalizeRoomCode(roomCode)}`;
  }

  async function postTopicSignal(fetchFn, roomCode, payload) {
    const resp = await fetchFn(buildTopicUrl(roomCode), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload)
    });
    if (!resp || !resp.ok) {
      throw new Error(`Signaling server error (${resp ? resp.status : 'network'})`);
    }
  }

  async function pollTopicSignals(fetchFn, roomCode, since) {
    const url = `${buildTopicUrl(roomCode)}/json?poll=1&since=${encodeURIComponent(since || '2m')}`;
    const resp = await fetchFn(url, { method: 'GET' });
    if (!resp || !resp.ok) return [];
    const text = await resp.text();
    if (!text) return [];
    const out = [];
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      try {
        const envelope = JSON.parse(line);
        if (envelope && envelope.event === 'message' && typeof envelope.message === 'string') {
          const payload = JSON.parse(envelope.message);
          out.push({ id: envelope.id || '', payload });
        }
      } catch (_) {}
    }
    return out;
  }

  function delayMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

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
    const fetchFn = resolveFetch(opts);
    const shouldAutoSignal = Boolean(fetchFn) && (
      opts.autoSignaling === true ||
      (opts.autoSignaling !== false && (Boolean(opts.fetchFn) || !opts.rtcFactory))
    );
    const pollIntervalMs = Math.max(20, Number(opts.pollIntervalMs) || 950);
    const hostName = String(opts.hostName || 'HOST').trim().slice(0, 20) || 'HOST';
    const roomCode = normalizeRoomCode(opts.roomCode) || generateRoomCode(4);

    const room = {
      roomCode,
      roomName: String(opts.roomName || (hostName + "'S FOXROOM")).slice(0, 32),
      pieceSet: 'tetromino',
      gameMode: 'vs',
      blitzDurationMs: Math.max(5000, Number(opts.blitzDurationMs) || 120000),
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
      finished: false,
      score: 0,
      lines: 0,
      attack: 0,
      vs: 0,
      wins: 0,
      board: null
    });

    const connections = new Map();
    const pendingOffers = new Map();
    const announcedPeers = new Set();
    const seenEventIds = new Set();
    const seenClientReqs = new Set();
    const seenAnswerPeerIds = new Set();
    const chat = [];
    const listeners = new Set();
    let nextPeerSeq = 2;
    let attackNonce = 1;
    let signalingStatus = shouldAutoSignal ? 'connecting' : 'manual';
    let pollTimer = null;
    let blitzTimer = null;
    let closed = false;

    function getSnapshot() {
      return {
        role: 'host',
        signalingStatus,
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

    function clearBlitzTimer() {
      if (blitzTimer) {
        clearTimeout(blitzTimer);
        blitzTimer = null;
      }
    }

    function finalizeRound(winnerPlayer, chatMessage) {
      if (room.status !== 'playing') return;
      clearBlitzTimer();
      if (winnerPlayer) {
        winnerPlayer.wins += 1;
        room.winner = winnerPlayer.name;
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
      pushChat('SYS', chatMessage || `${room.winner} wins round #${room.round}!`, true);
      broadcastRoomState();
      notify('round_end', endPacket);
    }

    function pickBlitzWinner() {
      const ranked = Array.from(players.values()).sort(
        (a, b) => (b.score - a.score) || (b.lines - a.lines) || (Number(b.alive) - Number(a.alive))
      );
      return ranked[0] || null;
    }

    function evaluateRoundEnd() {
      if (room.status !== 'playing') return;
      if (room.gameMode === 'blitz') {
        const everyoneDone = Array.from(players.values()).every((p) => !p.alive || p.finished);
        if (everyoneDone) {
          const top = pickBlitzWinner();
          const pts = top ? Math.round(top.score || 0).toLocaleString('en-US') : '0';
          finalizeRound(top, `BLITZ COMPLETE! ${top ? top.name : 'DRAW'} wins (${pts} PTS)!`);
        }
        return;
      }

      const alivePlayers = Array.from(players.values()).filter((p) => p.alive);
      if (players.size >= 2 && alivePlayers.length <= 1) {
        finalizeRound(alivePlayers[0] || null);
      } else if (players.size === 1 && alivePlayers.length === 0) {
        finalizeRound(players.get('host') || null);
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
          if (!announcedPeers.has(peerId)) {
            announcedPeers.add(peerId);
            pushChat('SYS', `${player.name} joined the room.`, true);
          } else {
            broadcastRoomState();
          }
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
          player.score = Number(msg.score) || 0;
          player.lines = Number(msg.lines) || 0;
          player.attack = Number(msg.attack) || 0;
          player.vs = Number(msg.vs) || 0;
          broadcast({
            type: 'peer_board',
            id: peerId,
            board: player.board,
            score: player.score,
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
        case 'finish_match':
          player.finished = true;
          if (msg.score !== undefined) player.score = Number(msg.score) || 0;
          broadcastRoomState();
          evaluateRoundEnd();
          break;
        case 'ko':
          if (player.alive) {
            player.alive = false;
            player.finished = true;
            broadcastRoomState();
            evaluateRoundEnd();
          }
          break;
      }
    }

    function attachPeerChannel(peerId, pc, channel, initialName) {
      const cleanedInitial = initialName ? String(initialName).trim().slice(0, 20) : '';
      const slotName = cleanedInitial || ('PLAYER ' + peerId.slice(1));
      connections.set(peerId, { pc, channel });
      channel.onopen = () => {
        if (!players.has(peerId)) {
          players.set(peerId, {
            id: peerId,
            name: slotName,
            isHost: false,
            ready: true,
            alive: room.status !== 'playing',
            finished: false,
            score: 0,
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
        announcedPeers.delete(peerId);
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
          roomCode: room.roomCode,
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
      const initialName = decoded.name || (entry.label !== targetPeerId ? entry.label : '');
      attachPeerChannel(targetPeerId, entry.pc, entry.channel, initialName);
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
      if (patch.gameMode === 'vs' || patch.gameMode === 'blitz') {
        room.gameMode = patch.gameMode;
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
      if (players.size < 2) {
        notify('start_blocked', { reason: 'need_2_players' });
        return null;
      }
      clearBlitzTimer();
      room.round += 1;
      room.status = 'playing';
      room.winner = null;
      const seed = (Date.now() ^ (room.round * 2654435761)) >>> 0;
      for (const p of players.values()) {
        p.alive = true;
        p.finished = false;
        p.score = 0;
        p.lines = 0;
        p.attack = 0;
        p.vs = 0;
        p.board = null;
      }
      if (room.gameMode === 'blitz') {
        blitzTimer = setTimeout(() => {
          const top = pickBlitzWinner();
          const pts = top ? Math.round(top.score || 0).toLocaleString('en-US') : '0';
          finalizeRound(top, `BLITZ TIME UP! ${top ? top.name : 'DRAW'} wins (${pts} PTS)!`);
        }, room.blitzDurationMs);
      }
      const startPacket = {
        type: 'match_start',
        round: room.round,
        seed,
        config: {
          pieceSet: room.pieceSet,
          gameMode: room.gameMode,
          blitzDurationMs: room.blitzDurationMs,
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
      self.score = Number(snapshot.score) || 0;
      self.lines = snapshot.lines || 0;
      self.attack = snapshot.attackSent || 0;
      self.vs = Number(snapshot.vs) || 0;
      broadcast({
        type: 'peer_board',
        id: 'host',
        board: self.board,
        score: self.score,
        lines: self.lines,
        attack: self.attack,
        vs: self.vs,
        alive: self.alive
      });
      notify('self_board', { id: 'host' });
    }

    function sendSelfAttack(amount, callout) {
      routeAttack('host', amount, callout);
    }

    function reportSelfFinish(snapshot) {
      const self = players.get('host');
      if (!self) return;
      self.finished = true;
      if (snapshot && snapshot.score !== undefined) self.score = Number(snapshot.score) || 0;
      broadcastRoomState();
      if (room.gameMode === 'blitz') {
        evaluateRoundEnd();
      }
    }

    function reportSelfKo() {
      const self = players.get('host');
      if (!self || !self.alive) return;
      self.alive = false;
      self.finished = true;
      broadcastRoomState();
      evaluateRoundEnd();
    }

    async function pollAutoSignalingOnce() {
      if (closed || !shouldAutoSignal) return;
      try {
        const items = await pollTopicSignals(fetchFn, room.roomCode, '2m');
        if (signalingStatus !== 'online') {
          signalingStatus = 'online';
          notify('signaling_ready');
        }
        for (const item of items) {
          if (closed) break;
          if (item.id) {
            if (seenEventIds.has(item.id)) continue;
            seenEventIds.add(item.id);
          }
          const msg = item.payload;
          if (!msg || typeof msg !== 'object') continue;
          if (msg.roomCode && normalizeRoomCode(msg.roomCode) !== room.roomCode) continue;

          if (msg.kind === 'join_req' && msg.clientId && !seenClientReqs.has(msg.clientId)) {
            seenClientReqs.add(msg.clientId);
            const invite = await createInvite(msg.name || 'PLAYER');
            await postTopicSignal(fetchFn, room.roomCode, {
              kind: 'offer',
              roomCode: room.roomCode,
              to: msg.clientId,
              peerId: invite.peerId,
              roomName: room.roomName,
              hostName,
              offer: invite.code
            });
          } else if (msg.kind === 'answer' && msg.peerId && msg.answer && !seenAnswerPeerIds.has(msg.peerId)) {
            if (!pendingOffers.has(msg.peerId)) continue;
            seenAnswerPeerIds.add(msg.peerId);
            await acceptAnswer(msg.peerId, msg.answer);
          }
        }
      } catch (_) {
        if (signalingStatus !== 'offline') {
          signalingStatus = 'offline';
          notify('signaling_offline');
        }
      }
    }

    function scheduleAutoPoll(delay) {
      if (closed || !shouldAutoSignal) return;
      pollTimer = setTimeout(async () => {
        await pollAutoSignalingOnce();
        scheduleAutoPoll(pollIntervalMs);
      }, delay);
    }

    if (shouldAutoSignal) {
      scheduleAutoPoll(25);
    }

    function close() {
      closed = true;
      clearBlitzTimer();
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
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
      reportSelfFinish,
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
    const fetchFn = resolveFetch(opts);
    const pollIntervalMs = Math.max(20, Number(opts.pollIntervalMs) || 650);
    const joinTimeoutMs = Math.max(500, Number(opts.joinTimeoutMs) || 25000);
    const playerName = String(opts.playerName || 'PLAYER').trim().slice(0, 20) || 'PLAYER';

    let pc = null;
    let channel = null;
    let selfId = null;
    let connected = false;
    let ready = true;
    let closed = false;
    let room = {
      roomCode: '',
      roomName: 'FOXMOD P2P ROOM',
      pieceSet: 'tetromino',
      gameMode: 'vs',
      blitzDurationMs: 120000,
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
            if (msg.score !== undefined) target.score = Number(msg.score) || 0;
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
      if (decoded.roomCode) {
        room.roomCode = decoded.roomCode;
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

    /**
     * Joins via either a 4-char #CODE (automatic WebRTC handshake) or manual FOX1/FOX0 fallback.
     */
    async function joinByCode(rawInput) {
      const text = String(rawInput || '').trim();
      if (!text) {
        throw new Error('Enter a #CODE (e.g. K7M4) or FOX1 invite code.');
      }
      if (isManualSignalCode(text)) {
        const answerCode = await joinFromInvite(text);
        return { mode: 'manual', answerCode };
      }

      const code = normalizeRoomCode(text);
      if (!code) {
        throw new Error('Invalid room code. Use a 4-char code (e.g. #K7M4) or FOX1:... invite.');
      }
      if (!fetchFn) {
        throw new Error('Auto-join network unavailable. Use MANUAL P2P FALLBACK with a FOX1:... invite.');
      }

      const clientId = 'c_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      room.roomCode = code;
      room.status = 'connecting';
      notify('connecting', { roomCode: code });

      await postTopicSignal(fetchFn, code, {
        kind: 'join_req',
        roomCode: code,
        clientId,
        name: playerName
      });

      const deadline = Date.now() + joinTimeoutMs;
      let firstWait = Math.min(80, pollIntervalMs);
      while (!closed && Date.now() < deadline) {
        await delayMs(firstWait);
        firstWait = pollIntervalMs;
        if (closed) break;

        let items = [];
        try {
          items = await pollTopicSignals(fetchFn, code, '2m');
        } catch (_) {
          continue;
        }
        const offerMsg = items
          .map((item) => item && item.payload)
          .find((msg) => msg && msg.kind === 'offer' && msg.to === clientId && msg.offer);
        if (offerMsg) {
          if (offerMsg.roomName) room.roomName = offerMsg.roomName;
          const answerCode = await joinFromInvite(offerMsg.offer);
          await postTopicSignal(fetchFn, code, {
            kind: 'answer',
            roomCode: code,
            peerId: offerMsg.peerId,
            clientId,
            name: playerName,
            answer: answerCode
          });
          return {
            mode: 'auto',
            roomCode: code,
            roomName: room.roomName,
            peerId: offerMsg.peerId
          };
        }
      }

      if (closed) {
        throw new Error('Room join cancelled.');
      }
      throw new Error(`Room #${code} did not respond. Verify the Host room is open or use MANUAL P2P FALLBACK.`);
    }

    function close() {
      closed = true;
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
      joinByCode,
      setReady(val) {
        ready = Boolean(val);
        send({ type: 'ready', ready });
      },
      sendChat(text) {
        send({ type: 'chat', text });
      },
      updateSelfBoard(snapshot) {
        if (!snapshot) return;
        const selfPlayer = selfId ? players.find((p) => p.id === selfId) : null;
        if (selfPlayer) {
          selfPlayer.score = Number(snapshot.score) || 0;
          selfPlayer.lines = snapshot.lines || 0;
          selfPlayer.attack = snapshot.attackSent || 0;
          selfPlayer.vs = Number(snapshot.vs) || 0;
        }
        send({
          type: 'board_state',
          board: snapshot.compactBoard,
          score: Number(snapshot.score) || 0,
          lines: snapshot.lines || 0,
          attack: snapshot.attackSent || 0,
          vs: Number(snapshot.vs) || 0
        });
        if (selfPlayer) notify('self_board', { id: selfId });
      },
      sendSelfAttack(amount, callout) {
        send({ type: 'attack', amount, callout });
      },
      reportSelfFinish(snapshot) {
        send({
          type: 'finish_match',
          score: Number(snapshot && snapshot.score) || 0
        });
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
    ROOM_CODE_ALPHABET,
    generateRoomCode,
    normalizeRoomCode,
    encodeSignal,
    decodeSignal,
    pickAttackTarget,
    createHostServer,
    createClientPeer
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));
