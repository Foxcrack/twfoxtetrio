(function (root) {
  'use strict';

  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ];

  const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const SIGNAL_BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt'
  ];
  const SIGNAL_MQTT_PREFIX = 'twfoxtetrio/v1/';
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
      .replace(/^(?:[#№]|N[º°O])+/i, '')
      .replace(/[^0-9A-Z]/g, '');
    return /^[2-9A-HJ-NP-Z]{4,8}$/.test(cleaned) ? cleaned : '';
  }

  function sanitizeAvatarUrl(raw) {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > 4096) return '';
    if (/^(?:https?:\/\/|\/user-content\/|\/res\/|data:image\/)/i.test(trimmed)) {
      return trimmed;
    }
    return '';
  }

  function isManualSignalCode(raw) {
    return /^FOX[01]:/i.test(String(raw || '').trim());
  }

  function resolveFetch(opts) {
    if (opts && typeof opts.fetchFn === 'function') return opts.fetchFn;
    return null;
  }

  function resolveWsFactory(opts) {
    if (opts && opts.autoSignaling === false) return null;
    if (opts && typeof opts.wsFactory === 'function') return opts.wsFactory;
    if (!opts || !opts.fetchFn) {
      if (typeof root.WebSocket === 'function') {
        return function defaultWsFactory(url, protocol) {
          return protocol ? new root.WebSocket(url, protocol) : new root.WebSocket(url);
        };
      }
    }
    return null;
  }

  /**
   * Builds final ordered standings for a completed round.
   * - Versus KO: survivor (#1) first, then descending koOrder (#2 was last KO'd down to #N first KO'd).
   * - Blitz: highest score first, breaking ties by lines, survival, and koOrder.
   */
  function buildRoundStandings(playerList, disconnectedList, gameMode, roundStartAt, endedAt) {
    const startTs = Number(roundStartAt) || 0;
    const endTs = Number(endedAt) || startTs;
    const combined = []
      .concat(Array.isArray(playerList) ? playerList : [])
      .concat(Array.isArray(disconnectedList) ? disconnectedList : []);

    const sorted = combined.slice().sort((a, b) => {
      if (gameMode === 'race') {
        const altA = Math.max(Number(a.peakAltitude) || 0, Number(a.altitude) || 0);
        const altB = Math.max(Number(b.peakAltitude) || 0, Number(b.altitude) || 0);
        if (altB !== altA) return altB - altA;
        if ((Number(b.floor) || 1) !== (Number(a.floor) || 1)) {
          return (Number(b.floor) || 1) - (Number(a.floor) || 1);
        }
        if ((Number(b.score) || 0) !== (Number(a.score) || 0)) {
          return (Number(b.score) || 0) - (Number(a.score) || 0);
        }
        if (Boolean(a.disconnected) !== Boolean(b.disconnected)) {
          return a.disconnected ? 1 : -1;
        }
        return String(a.name || '').localeCompare(String(b.name || ''));
      }
      if (gameMode === 'blitz') {
        return (
          ((Number(b.score) || 0) - (Number(a.score) || 0)) ||
          ((b.lines || 0) - (a.lines || 0)) ||
          (Number(Boolean(b.alive)) - Number(Boolean(a.alive))) ||
          ((b.koOrder || 0) - (a.koOrder || 0))
        );
      }
      return (
        (Number(Boolean(b.alive)) - Number(Boolean(a.alive))) ||
        ((b.koOrder || 0) - (a.koOrder || 0)) ||
        ((Number(b.vs) || 0) - (Number(a.vs) || 0)) ||
        ((Number(b.attack) || 0) - (Number(a.attack) || 0)) ||
        ((b.lines || 0) - (a.lines || 0)) ||
        ((Number(b.score) || 0) - (Number(a.score) || 0))
      );
    });

    return sorted.map((p, idx) => {
      const stopTs = p.eliminatedAt && p.eliminatedAt > startTs ? p.eliminatedAt : endTs;
      const explicitDuration = Number(p.durationMs);
      const peakAlt = Math.max(Number(p.peakAltitude) || 0, Number(p.altitude) || 0);
      return {
        id: p.id,
        name: p.name,
        isHost: Boolean(p.isHost),
        placement: idx + 1,
        alive: Boolean(p.alive),
        disconnected: Boolean(p.disconnected),
        koOrder: p.koOrder || null,
        altitude: Math.round(peakAlt * 10) / 10,
        floor: Math.max(1, Math.floor(Number(p.floor) || 1)),
        score: Number(p.score) || 0,
        lines: Number(p.lines) || 0,
        attack: Number(p.attack) || 0,
        vs: Number(p.vs) || 0,
        pps: Number(p.pps) || 0,
        apm: Number(p.apm) || 0,
        wins: Number(p.wins) || 0,
        durationMs: Number.isFinite(explicitDuration) && explicitDuration > 0
          ? explicitDuration
          : (startTs > 0 ? Math.max(0, stopTs - startTs) : 0)
      };
    });
  }

  function concatUint8(parts) {
    let total = 0;
    for (const p of parts) total += p.length;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      out.set(p, offset);
      offset += p.length;
    }
    return out;
  }

  function mqttEncodeVarLen(len) {
    const bytes = [];
    let val = len;
    do {
      let b = val % 128;
      val = Math.floor(val / 128);
      if (val > 0) b |= 128;
      bytes.push(b);
    } while (val > 0);
    return new Uint8Array(bytes);
  }

  function mqttUtfString(str) {
    const bytes = encodeUtf8(str);
    const hdr = new Uint8Array([(bytes.length >> 8) & 0xff, bytes.length & 0xff]);
    return concatUint8([hdr, bytes]);
  }

  function mqttPacketConnect(clientId) {
    const varHdr = new Uint8Array([0, 4, 77, 81, 84, 84, 4, 2, 0, 50]);
    const body = concatUint8([varHdr, mqttUtfString(clientId)]);
    return concatUint8([new Uint8Array([0x10]), mqttEncodeVarLen(body.length), body]);
  }

  function mqttPacketSubscribe(packetId, topic) {
    const idBytes = new Uint8Array([(packetId >> 8) & 0xff, packetId & 0xff]);
    const body = concatUint8([idBytes, mqttUtfString(topic), new Uint8Array([0])]);
    return concatUint8([new Uint8Array([0x82]), mqttEncodeVarLen(body.length), body]);
  }

  function mqttPacketPublish(topic, text, retain) {
    const body = concatUint8([mqttUtfString(topic), encodeUtf8(text)]);
    const headerByte = retain ? 0x31 : 0x30;
    return concatUint8([new Uint8Array([headerByte]), mqttEncodeVarLen(body.length), body]);
  }

  function mqttPacketPingReq() {
    return new Uint8Array([0xc0, 0x00]);
  }

  function mqttPacketDisconnect() {
    return new Uint8Array([0xe0, 0x00]);
  }

  function createMqttFrameReader(onPacket) {
    let pending = new Uint8Array(0);
    return function feedChunk(rawData) {
      let chunk;
      if (rawData instanceof Uint8Array) {
        chunk = rawData;
      } else if (ArrayBuffer.isView(rawData)) {
        chunk = new Uint8Array(rawData.buffer, rawData.byteOffset, rawData.byteLength);
      } else if (
        rawData instanceof ArrayBuffer ||
        Object.prototype.toString.call(rawData) === '[object ArrayBuffer]'
      ) {
        chunk = new Uint8Array(rawData);
      } else if (rawData && rawData.buffer) {
        chunk = new Uint8Array(rawData.buffer, rawData.byteOffset || 0, rawData.byteLength || rawData.length);
      } else {
        return;
      }
      pending = concatUint8([pending, chunk]);
      while (pending.length >= 2) {
        let mul = 1;
        let remLen = 0;
        let idx = 1;
        let incomplete = false;
        while (true) {
          if (idx >= pending.length) {
            incomplete = true;
            break;
          }
          const b = pending[idx++];
          remLen += (b & 0x7f) * mul;
          if ((b & 0x80) === 0) break;
          mul *= 128;
          if (idx > 5) return;
        }
        if (incomplete || pending.length < idx + remLen) break;
        const firstByte = pending[0];
        const body = pending.slice(idx, idx + remLen);
        pending = pending.slice(idx + remLen);
        onPacket(firstByte & 0xf0, firstByte & 0x0f, body);
      }
    };
  }

  /**
   * Opens one persistent MQTT-over-WebSocket relay socket for a room topic.
   */
  function createMqttBrokerClient(opts) {
    const clientId = 'twfx_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
    let subscribed = false;
    let closed = false;
    let pingTimer = null;
    let ws = null;

    function sendBytes(bytes) {
      if (!closed && ws && ws.readyState === 1) {
        try {
          ws.send(bytes);
        } catch (_) {}
      }
    }

    const reader = createMqttFrameReader((packetType, flags, body) => {
      if (closed) return;
      if (packetType === 0x20 && body.length >= 2) {
        if (body[1] === 0) {
          sendBytes(mqttPacketSubscribe(1, opts.topic));
          pingTimer = setInterval(() => sendBytes(mqttPacketPingReq()), 25000);
          if (pingTimer && typeof pingTimer.unref === 'function') pingTimer.unref();
        } else if (opts.onClose) {
          opts.onClose();
        }
      } else if (packetType === 0x90) {
        if (!subscribed) {
          subscribed = true;
          if (opts.onReady) opts.onReady();
        }
      } else if (packetType === 0x30 && body.length >= 2) {
        const topicLen = (body[0] << 8) | body[1];
        let offset = 2 + topicLen;
        if ((flags & 0x06) !== 0) offset += 2;
        if (offset > body.length) return;
        try {
          const text = decodeUtf8(body.slice(offset));
          const payload = JSON.parse(text);
          if (opts.onMessage) opts.onMessage(payload);
        } catch (_) {}
      }
    });

    try {
      ws = opts.wsFactory(opts.url, 'mqtt');
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        if (!closed) sendBytes(mqttPacketConnect(clientId));
      };
      ws.onmessage = (ev) => {
        if (ev && ev.data !== undefined) reader(ev.data);
      };
      ws.onerror = () => {
        if (!closed && opts.onClose) opts.onClose();
      };
      ws.onclose = () => {
        clearInterval(pingTimer);
        pingTimer = null;
        subscribed = false;
        if (!closed && opts.onClose) opts.onClose();
      };
    } catch (_) {
      if (opts.onClose) opts.onClose();
    }

    return {
      isSubscribed() {
        return subscribed && !closed && ws && ws.readyState === 1;
      },
      publish(payloadObj) {
        if (!this.isSubscribed()) return false;
        sendBytes(mqttPacketPublish(opts.topic, JSON.stringify(payloadObj)));
        return true;
      },
      close() {
        if (closed) return;
        closed = true;
        clearInterval(pingTimer);
        pingTimer = null;
        if (ws) {
          try {
            if (ws.readyState === 1) ws.send(mqttPacketDisconnect());
            ws.close();
          } catch (_) {}
        }
        subscribed = false;
      }
    };
  }

  function createMultiBrokerSignalBus(opts) {
    const topic = SIGNAL_MQTT_PREFIX + normalizeRoomCode(opts.roomCode);
    const urls = Array.isArray(opts.brokers) && opts.brokers.length > 0 ? opts.brokers : SIGNAL_BROKERS;
    const clients = [];
    const waitResolvers = [];
    let closed = false;
    let readyFired = false;
    let deadCount = 0;

    function resolveWaiters(ok) {
      while (waitResolvers.length > 0) {
        const fn = waitResolvers.shift();
        fn(ok);
      }
    }

    for (const url of urls) {
      let failedOnce = false;
      const cli = createMqttBrokerClient({
        url,
        topic,
        wsFactory: opts.wsFactory,
        onReady() {
          if (closed) return;
          if (!readyFired) {
            readyFired = true;
            if (opts.onReady) opts.onReady();
          }
          if (opts.onBrokerReady) opts.onBrokerReady(cli);
          resolveWaiters(true);
        },
        onMessage(payload) {
          if (!closed && opts.onMessage) opts.onMessage(payload);
        },
        onClose() {
          if (failedOnce || closed) return;
          failedOnce = true;
          deadCount += 1;
          if (deadCount >= urls.length) {
            resolveWaiters(false);
            if (!clients.some((c) => c.isSubscribed()) && opts.onOffline) {
              opts.onOffline();
            }
          }
        }
      });
      clients.push(cli);
    }

    return {
      hasReady() {
        return clients.some((c) => c.isSubscribed());
      },
      waitUntilReady(timeoutMs) {
        if (this.hasReady()) return Promise.resolve(true);
        if (deadCount >= urls.length) return Promise.resolve(false);
        return new Promise((resolve) => {
          const done = (ok) => {
            clearTimeout(timer);
            resolve(ok);
          };
          const timer = setTimeout(() => done(this.hasReady()), timeoutMs || 5000);
          waitResolvers.push(done);
        });
      },
      publish(payloadObj) {
        let sent = 0;
        for (const c of clients) {
          if (c.publish(payloadObj)) sent += 1;
        }
        return sent;
      },
      close() {
        closed = true;
        resolveWaiters(false);
        for (const c of clients) c.close();
      }
    };
  }

  function buildLegacyTopicUrl(roomCode) {
    return `https://ntfy.sh/${SIGNAL_TOPIC_PREFIX}${normalizeRoomCode(roomCode)}`;
  }

  async function postLegacyTopicSignal(fetchFn, roomCode, payload) {
    const resp = await fetchFn(buildLegacyTopicUrl(roomCode), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload)
    });
    if (!resp || !resp.ok) {
      throw new Error(`Signaling server error (${resp ? resp.status : 'network'})`);
    }
  }

  async function pollLegacyTopicSignals(fetchFn, roomCode, since) {
    const url = `${buildLegacyTopicUrl(roomCode)}/json?poll=1&since=${encodeURIComponent(since || '2m')}`;
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
      return rtcFactory({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 2 });
    }
    if (typeof root.RTCPeerConnection !== 'function') {
      throw new Error('WebRTC RTCPeerConnection is unavailable in this browser.');
    }
    return new root.RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 2 });
  }

  function isReflexiveOrRelayCandidate(candidate) {
    if (!candidate) return false;
    if (candidate.type === 'srflx' || candidate.type === 'relay') return true;
    return /\btyp\s+(srflx|relay)\b/i.test(String(candidate.candidate || ''));
  }

  function waitForIceGathering(pc, timeoutMs, onTrickleCandidate) {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      let settled = false;
      let srflxSettleTimer = null;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (srflxSettleTimer) clearTimeout(srflxSettleTimer);
        if (!onTrickleCandidate) {
          pc.onicegatheringstatechange = null;
          pc.onicecandidate = null;
        }
        resolve();
      };
      const timer = unrefIfPossible(setTimeout(done, timeoutMs || 3000));
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') done();
      };
      pc.onicecandidate = (ev) => {
        if (!ev || !ev.candidate) {
          done();
          return;
        }
        if (settled) {
          if (onTrickleCandidate) onTrickleCandidate(ev.candidate);
          return;
        }
        if (isReflexiveOrRelayCandidate(ev.candidate) && !srflxSettleTimer) {
          // Once a public srflx/relay candidate arrives, wait briefly for peers/adapters then send SDP.
          srflxSettleTimer = unrefIfPossible(setTimeout(done, 550));
        }
      };
    });
  }

  function createRelayPacketDeduper(maxEntries) {
    const limit = maxEntries || 400;
    const seen = new Set();
    return function isDuplicate(key) {
      if (!key) return false;
      if (seen.has(key)) return true;
      seen.add(key);
      if (seen.size > limit) {
        let trim = Math.floor(limit / 2);
        for (const oldKey of seen) {
          seen.delete(oldKey);
          if (--trim <= 0) break;
        }
      }
      return false;
    };
  }

  function safeSerializeCandidate(candidate) {
    if (!candidate) return null;
    if (typeof candidate.toJSON === 'function') return candidate.toJSON();
    return {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex
    };
  }

  function createVirtualRelayChannel(opts) {
    let closed = false;
    let txSeq = 0;
    let lastBoardSentAt = 0;
    const minBoardGapMs = opts.boardThrottleMs || 85;
    const ch = {
      label: 'foxmod-relay',
      readyState: 'open',
      onopen: null,
      onmessage: null,
      onclose: null,
      send(rawStr) {
        if (closed || ch.readyState !== 'open') return;
        const text = typeof rawStr === 'string' ? rawStr : JSON.stringify(rawStr);
        if (text.indexOf('"type":"peer_board"') !== -1 || text.indexOf('"type":"board_state"') !== -1) {
          const now = Date.now();
          if (now - lastBoardSentAt < minBoardGapMs) return;
          lastBoardSentAt = now;
        }
        txSeq += 1;
        opts.publishPacket({
          kind: 'dc',
          roomCode: opts.roomCode,
          peerId: opts.peerId,
          from: opts.from,
          to: opts.to,
          seq: txSeq,
          data: text
        });
      },
      close() {
        if (closed) return;
        closed = true;
        ch.readyState = 'closed';
        if (typeof opts.onLocalClose === 'function') opts.onLocalClose();
        if (typeof ch.onclose === 'function') ch.onclose();
      }
    };
    return ch;
  }

  function pickAttackTarget(players, senderId, rngSeed) {
    const candidates = players.filter((p) => p.alive && p.id !== senderId);
    if (candidates.length === 0) return null;
    const idx = Math.abs(Math.floor(rngSeed)) % candidates.length;
    return candidates[idx];
  }

  function selectNextHostCandidate(playerList) {
    if (!Array.isArray(playerList)) return null;
    let fallbackSpec = null;
    for (let i = 0; i < playerList.length; i++) {
      const p = playerList[i];
      if (!p || p.isHost || p.disconnected) continue;
      if (!p.spectator) return p;
      if (!fallbackSpec) fallbackSpec = p;
    }
    return fallbackSpec;
  }

  function unrefIfPossible(timer) {
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
    return timer;
  }

  /**
   * Creates a P2P Room Host where the creator's browser acts as the authoritative
   * room server for connected WebRTC peers.
   */
  function createHostServer(options) {
    const opts = options || {};
    const rtcFactory = opts.rtcFactory || null;
    const wsFactory = resolveWsFactory(opts);
    const fetchFn = resolveFetch(opts);
    const shouldAutoSignalWs = Boolean(wsFactory) && (
      opts.autoSignaling === true ||
      (opts.autoSignaling !== false && (Boolean(opts.wsFactory) || !opts.rtcFactory))
    );
    const shouldAutoSignalFetch = !shouldAutoSignalWs && Boolean(fetchFn) && (
      opts.autoSignaling === true ||
      (opts.autoSignaling !== false && Boolean(opts.fetchFn))
    );
    const shouldAutoSignal = shouldAutoSignalWs || shouldAutoSignalFetch;
    const pollIntervalMs = Math.max(20, Number(opts.pollIntervalMs) || 950);
    const heartbeatIntervalMs = Math.max(25, Number(opts.heartbeatIntervalMs) || 2500);
    const heartbeatTimeoutMs = Math.max(60, Number(opts.heartbeatTimeoutMs) || 7000);
    const hostName = String(opts.hostName || 'HOST').trim().slice(0, 20) || 'HOST';
    const hostAvatar = sanitizeAvatarUrl(opts.hostAvatar || opts.avatar || '');
    const roomCode = normalizeRoomCode(opts.roomCode) || generateRoomCode(4);
    const initSet =
      opts.pieceSet === 'pentomino' || opts.pieceSet === 'tetromino' || opts.pieceSet === 'chaos'
        ? opts.pieceSet
        : 'tetromino';
    const initMode = opts.gameMode === 'blitz' ? 'blitz' : opts.gameMode === 'race' ? 'race' : 'vs';
    const maxPlayers = opts.maxPlayers !== undefined && opts.maxPlayers !== null
      ? Math.max(2, Math.floor(Number(opts.maxPlayers) || 4))
      : (initMode === 'race' ? 4 : Infinity);
    const countdownMs = Math.max(0, Number.isFinite(Number(opts.countdownMs)) ? Number(opts.countdownMs) : 2800);
    const defaultReadyState = initMode !== 'race';
    const initMult = Number.isFinite(Number(opts.garbageMultiplier))
      ? Math.max(0, Math.min(4, Number(opts.garbageMultiplier)))
      : 1;
    const initGrav = Number.isFinite(Number(opts.gravityLevel))
      ? Math.max(1, Math.min(10, Math.floor(Number(opts.gravityLevel))))
      : 1;
    const initRound = Number.isFinite(Number(opts.round)) && Number(opts.round) >= 0 ? Math.floor(Number(opts.round)) : 0;

    const room = {
      roomCode,
      roomName: String(opts.roomName || (hostName + "'S FOXROOM")).slice(0, 32),
      pieceSet: initSet,
      gameMode: initMode,
      maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : null,
      countdownMs,
      blitzDurationMs: Math.max(5000, Number(opts.blitzDurationMs) || 120000),
      garbageMultiplier: initMult,
      gravityLevel: initGrav,
      status: 'lobby',
      round: initRound,
      winner: null,
      lastResults: null
    };

    const players = new Map();
    players.set('host', {
      id: 'host',
      name: hostName,
      avatar: hostAvatar,
      isHost: true,
      ready: defaultReadyState,
      spectator: false,
      alive: true,
      finished: false,
      koOrder: null,
      placement: null,
      eliminatedAt: null,
      altitude: 0,
      peakAltitude: 0,
      floor: 1,
      durationMs: 0,
      score: 0,
      lines: 0,
      attack: 0,
      vs: 0,
      pps: 0,
      apm: 0,
      wins: 0,
      board: null
    });

    const connections = new Map();
    const pendingOffers = new Map();
    const cachedOffersByClient = new Map();
    const pendingIceByPeer = new Map();
    const relayChannels = new Map();
    const isDupRelay = createRelayPacketDeduper(500);
    const announcedPeers = new Set();
    const seenEventIds = new Set();
    const seenClientReqs = new Set();
    const seenAnswerPeerIds = new Set();
    const chat = Array.isArray(opts.chat)
      ? opts.chat.slice(-40).map((c) => ({
          author: String((c && c.author) || 'SYS'),
          text: String((c && c.text) || ''),
          system: Boolean(c && c.system)
        }))
      : [];
    const listeners = new Set();
    let nextPeerSeq = 2;
    let attackNonce = 1;
    let eliminationSeq = 0;
    let roundStartAt = 0;
    let roundDisconnected = [];
    let signalingStatus = shouldAutoSignal ? 'connecting' : 'manual';
    let signalBus = null;
    let pollTimer = null;
    let blitzTimer = null;
    let raceCountdownTimer = null;
    let heartbeatTimer = null;
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

    function clearRaceCountdown() {
      if (raceCountdownTimer) {
        clearTimeout(raceCountdownTimer);
        raceCountdownTimer = null;
      }
    }

    function checkRaceReadyLaunch() {
      if (room.gameMode !== 'race') return;
      if (room.status !== 'lobby' && room.status !== 'countdown') return;
      const activePlayers = Array.from(players.values()).filter((p) => !p.spectator && !p.disconnected);
      const canRun =
        activePlayers.length >= 2 &&
        activePlayers.length <= maxPlayers &&
        activePlayers.every((p) => Boolean(p.ready));

      if (room.status === 'lobby' && canRun) {
        room.status = 'countdown';
        const packet = {
          type: 'race_countdown',
          round: room.round + 1,
          countdownMs
        };
        broadcastRoomState();
        broadcast(packet);
        notify('race_countdown', packet);
        if (countdownMs <= 0) {
          startMatch();
        } else {
          raceCountdownTimer = unrefIfPossible(setTimeout(() => {
            raceCountdownTimer = null;
            if (!closed && room.status === 'countdown') {
              startMatch();
            }
          }, countdownMs));
        }
      } else if (room.status === 'countdown' && !canRun) {
        clearRaceCountdown();
        room.status = 'lobby';
        broadcast({ type: 'race_countdown_cancel' });
        broadcastRoomState();
        notify('race_countdown_cancel');
      }
    }

    function finalizeRound(winnerPlayer, chatMessage) {
      if (room.status !== 'playing') return;
      clearBlitzTimer();
      clearRaceCountdown();
      const endTs = Date.now();
      const activeRoster = Array.from(players.values()).filter((p) => !p.spectator);
      const standings = buildRoundStandings(
        activeRoster,
        roundDisconnected,
        room.gameMode,
        roundStartAt,
        endTs
      );
      const effectiveWinner = winnerPlayer || (room.gameMode === 'race' && standings[0] ? players.get(standings[0].id) || null : null);
      if (effectiveWinner) {
        effectiveWinner.wins += 1;
        room.winner = effectiveWinner.name;
      } else if (room.gameMode === 'race' && standings[0]) {
        room.winner = standings[0].name;
      } else {
        room.winner = 'DRAW';
      }
      for (const item of standings) {
        const p = players.get(item.id);
        if (p) p.placement = item.placement;
      }
      room.lastResults = standings;
      room.status = 'results';
      const endPacket = {
        type: 'round_end',
        round: room.round,
        gameMode: room.gameMode,
        winner: room.winner,
        players: getSnapshot().players,
        standings
      };
      broadcast(endPacket);
      pushChat('SYS', chatMessage || `${room.winner} wins round #${room.round}!`, true);
      broadcastRoomState();
      notify('round_end', endPacket);
    }

    function pickBlitzWinner() {
      const ranked = Array.from(players.values())
        .filter((p) => !p.spectator)
        .sort(
          (a, b) => (b.score - a.score) || (b.lines - a.lines) || (Number(b.alive) - Number(a.alive))
        );
      return ranked[0] || null;
    }

    function pickRaceWinner() {
      const pool = Array.from(players.values())
        .filter((p) => !p.spectator)
        .concat(roundDisconnected.filter((p) => p && !p.spectator));
      pool.sort((a, b) => {
        const altA = Math.max(Number(a.peakAltitude) || 0, Number(a.altitude) || 0);
        const altB = Math.max(Number(b.peakAltitude) || 0, Number(b.altitude) || 0);
        if (altB !== altA) return altB - altA;
        if ((Number(b.floor) || 1) !== (Number(a.floor) || 1)) return (Number(b.floor) || 1) - (Number(a.floor) || 1);
        return (Number(b.score) || 0) - (Number(a.score) || 0);
      });
      const top = pool[0];
      return top && players.has(top.id) ? players.get(top.id) : (top || null);
    }

    function markPlayerEliminated(player, extraStats) {
      if (!player || player.spectator || !player.alive || room.status !== 'playing') return false;
      if (extraStats && typeof extraStats === 'object') {
        if (extraStats.altitude !== undefined) {
          const nextAlt = Math.max(0, Number(extraStats.altitude) || 0);
          player.altitude = nextAlt;
          player.peakAltitude = Math.max(Number(player.peakAltitude) || 0, nextAlt);
        }
        if (extraStats.peakAltitude !== undefined) {
          player.peakAltitude = Math.max(Number(player.peakAltitude) || 0, Number(extraStats.peakAltitude) || 0);
        }
        if (extraStats.floor !== undefined) player.floor = Math.max(1, Math.floor(Number(extraStats.floor) || 1));
        if (extraStats.durationMs !== undefined) player.durationMs = Math.max(0, Number(extraStats.durationMs) || 0);
        if (extraStats.score !== undefined) player.score = Number(extraStats.score) || 0;
        if (extraStats.lines !== undefined) player.lines = Number(extraStats.lines) || 0;
        if (extraStats.attack !== undefined) player.attack = Number(extraStats.attack) || 0;
        if (extraStats.vs !== undefined) player.vs = Number(extraStats.vs) || 0;
        if (extraStats.pps !== undefined) player.pps = Number(extraStats.pps) || 0;
        if (extraStats.apm !== undefined) player.apm = Number(extraStats.apm) || 0;
      }
      player.alive = false;
      player.finished = true;
      eliminationSeq += 1;
      player.koOrder = eliminationSeq;
      player.eliminatedAt = Date.now();
      const aliveRemaining = Array.from(players.values()).filter((p) => !p.spectator && p.alive).length;
      player.placement = aliveRemaining + 1;
      return true;
    }

    function evaluateRoundEnd() {
      if (room.status !== 'playing') return;
      const activePlayers = Array.from(players.values()).filter((p) => !p.spectator);
      if (room.gameMode === 'race') {
        const everyoneDone = activePlayers.every((p) => !p.alive || p.finished);
        if (everyoneDone) {
          const top = pickRaceWinner();
          const altStr = top
            ? (Math.max(Number(top.peakAltitude) || 0, Number(top.altitude) || 0)).toFixed(1)
            : '0.0';
          finalizeRound(top, `RACE COMPLETE! ${top ? top.name : 'DRAW'} wins (${altStr} M)!`);
        }
        return;
      }
      if (room.gameMode === 'blitz') {
        const everyoneDone = activePlayers.every((p) => !p.alive || p.finished);
        if (everyoneDone) {
          const top = pickBlitzWinner();
          const pts = top ? Math.round(top.score || 0).toLocaleString('en-US') : '0';
          finalizeRound(top, `BLITZ COMPLETE! ${top ? top.name : 'DRAW'} wins (${pts} PTS)!`);
        }
        return;
      }

      const alivePlayers = activePlayers.filter((p) => p.alive);
      const totalParticipants = activePlayers.length + roundDisconnected.length;
      if (totalParticipants >= 2 && alivePlayers.length <= 1) {
        finalizeRound(alivePlayers[0] || null);
      } else if (activePlayers.length === 1 && alivePlayers.length === 0) {
        finalizeRound(activePlayers[0] || players.get('host') || null);
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
      const conn = connections.get(peerId);
      if (conn) conn.lastSeenAt = Date.now();
      const player = players.get(peerId);
      if (!player) return;

      switch (msg.type) {
        case 'pong':
          break;
        case 'leave':
          handlePeerDisconnect(peerId, 'left the room');
          break;
        case 'hello':
          player.name = String(msg.name || player.name).trim().slice(0, 20) || player.name;
          if (msg.avatar !== undefined) {
            player.avatar = sanitizeAvatarUrl(msg.avatar);
          }
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
          checkRaceReadyLaunch();
          break;
        case 'spectator':
          player.spectator = Boolean(msg.spectator);
          if (player.spectator && room.status === 'playing' && player.alive) {
            player.alive = false;
            player.finished = true;
          }
          broadcastRoomState();
          if (room.status === 'playing') evaluateRoundEnd();
          else checkRaceReadyLaunch();
          break;
        case 'chat':
          pushChat(player.name, msg.text, false);
          break;
        case 'board_state':
          player.board = Array.isArray(msg.board) ? msg.board : null;
          if (msg.altitude !== undefined) {
            const nextAlt = Math.max(0, Number(msg.altitude) || 0);
            player.altitude = nextAlt;
            player.peakAltitude = Math.max(Number(player.peakAltitude) || 0, nextAlt);
          }
          if (msg.peakAltitude !== undefined) {
            player.peakAltitude = Math.max(Number(player.peakAltitude) || 0, Number(msg.peakAltitude) || 0);
          }
          if (msg.floor !== undefined) player.floor = Math.max(1, Math.floor(Number(msg.floor) || 1));
          if (msg.durationMs !== undefined) player.durationMs = Math.max(0, Number(msg.durationMs) || 0);
          player.score = Number(msg.score) || 0;
          player.lines = Number(msg.lines) || 0;
          player.attack = Number(msg.attack) || 0;
          player.vs = Number(msg.vs) || 0;
          player.pps = Number(msg.pps) || 0;
          player.apm = Number(msg.apm) || 0;
          broadcast({
            type: 'peer_board',
            id: peerId,
            board: player.board,
            altitude: player.altitude,
            peakAltitude: player.peakAltitude,
            floor: player.floor,
            durationMs: player.durationMs,
            score: player.score,
            lines: player.lines,
            attack: player.attack,
            vs: player.vs,
            pps: player.pps,
            apm: player.apm,
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
          if (msg.lines !== undefined) player.lines = Number(msg.lines) || 0;
          if (msg.attack !== undefined) player.attack = Number(msg.attack) || 0;
          if (msg.vs !== undefined) player.vs = Number(msg.vs) || 0;
          if (msg.pps !== undefined) player.pps = Number(msg.pps) || 0;
          if (msg.apm !== undefined) player.apm = Number(msg.apm) || 0;
          broadcastRoomState();
          evaluateRoundEnd();
          break;
        case 'ko':
          if (markPlayerEliminated(player, msg)) {
            broadcastRoomState();
            evaluateRoundEnd();
          }
          break;
      }
    }

    function stopHostHeartbeat() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }

    function ensureHostHeartbeat() {
      if (closed || heartbeatTimer || connections.size === 0) return;
      heartbeatTimer = unrefIfPossible(setInterval(() => {
        if (closed || connections.size === 0) {
          stopHostHeartbeat();
          return;
        }
        const now = Date.now();
        for (const [pid, conn] of Array.from(connections.entries())) {
          if (!conn.channel || conn.channel.readyState === 'closed') {
            handlePeerDisconnect(pid, 'disconnected');
            continue;
          }
          if (conn.openedAt && now - conn.lastSeenAt > heartbeatTimeoutMs) {
            handlePeerDisconnect(pid, 'timed out');
            continue;
          }
          const cState = conn.pc && conn.pc.connectionState;
          const iState = conn.pc && conn.pc.iceConnectionState;
          if (cState === 'failed' || cState === 'closed' || iState === 'failed' || iState === 'closed') {
            handlePeerDisconnect(pid, 'disconnected');
            continue;
          }
          if (conn.channel.readyState === 'open') {
            sendToPeer(pid, { type: 'ping', ts: now });
          }
        }
      }, heartbeatIntervalMs));
    }

    function handlePeerDisconnect(peerId, reasonText) {
      if (closed) return;
      const conn = connections.get(peerId);
      const left = players.get(peerId);
      if (!conn && !left) return;

      connections.delete(peerId);
      players.delete(peerId);
      announcedPeers.delete(peerId);
      if (connections.size === 0) {
        stopHostHeartbeat();
      }
      if (conn) {
        try {
          if (conn.channel) conn.channel.onclose = null;
          if (conn.pc) {
            conn.pc.onconnectionstatechange = null;
            conn.pc.oniceconnectionstatechange = null;
          }
          if (conn.channel && conn.channel.readyState !== 'closed') conn.channel.close();
          if (conn.pc && typeof conn.pc.close === 'function') conn.pc.close();
        } catch (_) {}
      }

      if (left && !left.spectator && room.status === 'playing') {
        const snapshotLeft = { ...left, disconnected: true };
        if (snapshotLeft.alive) {
          snapshotLeft.alive = false;
          snapshotLeft.finished = true;
          eliminationSeq += 1;
          snapshotLeft.koOrder = eliminationSeq;
          snapshotLeft.eliminatedAt = Date.now();
        }
        roundDisconnected.push(snapshotLeft);
      }

      if (left) {
        pushChat('SYS', `${left.name} ${reasonText || 'disconnected'}.`, true);
      } else {
        broadcastRoomState();
      }
      evaluateRoundEnd();
      checkRaceReadyLaunch();
    }

    function attachPeerChannel(peerId, pc, channel, initialName, initialAvatar) {
      const cleanedInitial = initialName ? String(initialName).trim().slice(0, 20) : '';
      const slotName = cleanedInitial || ('PLAYER ' + peerId.slice(1));
      const slotAvatar = sanitizeAvatarUrl(initialAvatar);
      const connEntry = { pc, channel, openedAt: 0, lastSeenAt: Date.now() };
      connections.set(peerId, connEntry);

      const handleStateCheck = () => {
        if (closed || !connections.has(peerId)) return;
        const cState = pc && pc.connectionState;
        const iState = pc && pc.iceConnectionState;
        if (cState === 'failed' || cState === 'closed' || iState === 'failed' || iState === 'closed') {
          handlePeerDisconnect(peerId, 'disconnected');
        } else if ((cState === 'disconnected' || iState === 'disconnected') && connEntry.openedAt) {
          sendToPeer(peerId, { type: 'ping', ts: Date.now() });
        }
      };
      if (pc) {
        pc.onconnectionstatechange = handleStateCheck;
        pc.oniceconnectionstatechange = handleStateCheck;
      }

      channel.onopen = () => {
        connEntry.openedAt = Date.now();
        connEntry.lastSeenAt = connEntry.openedAt;
        if (!players.has(peerId)) {
          players.set(peerId, {
            id: peerId,
            name: slotName,
            avatar: slotAvatar,
            isHost: false,
            ready: defaultReadyState,
            spectator: false,
            alive: room.status !== 'playing',
            finished: false,
            koOrder: null,
            placement: null,
            eliminatedAt: null,
            altitude: 0,
            peakAltitude: 0,
            floor: 1,
            durationMs: 0,
            score: 0,
            lines: 0,
            attack: 0,
            vs: 0,
            pps: 0,
            apm: 0,
            wins: 0,
            board: null
          });
        }
        sendToPeer(peerId, { type: 'welcome', id: peerId, autoSignaling: shouldAutoSignal });
        broadcastRoomState();
        ensureHostHeartbeat();
        if (room.status === 'countdown') {
          checkRaceReadyLaunch();
        }
      };
      channel.onmessage = (ev) => handlePeerMessage(peerId, ev && ev.data);
      channel.onclose = () => {
        handlePeerDisconnect(peerId, 'disconnected');
      };
    }

    async function createInvite(label, trickleOpts) {
      const peerId = 'p' + nextPeerSeq++;
      const pc = createDefaultPeerConnection(rtcFactory);
      const channel = pc.createDataChannel('foxmod-room', { ordered: true });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const onTrickle = trickleOpts && typeof trickleOpts.onTrickleCandidate === 'function'
        ? (cand) => trickleOpts.onTrickleCandidate(peerId, cand)
        : null;
      await waitForIceGathering(pc, 3000, onTrickle);
      pendingOffers.set(peerId, {
        pc,
        channel,
        label: label || peerId,
        clientId: trickleOpts && trickleOpts.clientId,
        avatar: trickleOpts && sanitizeAvatarUrl(trickleOpts.avatar)
      });
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
      if (players.size >= maxPlayers) {
        throw new Error('Room is full (max ' + maxPlayers + ' players).');
      }
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
      const initialAvatar = decoded.avatar || entry.avatar || '';
      attachPeerChannel(targetPeerId, entry.pc, entry.channel, initialName, initialAvatar);
      await entry.pc.setRemoteDescription(decoded.sdp);
      const queuedIce = pendingIceByPeer.get(targetPeerId);
      if (queuedIce && queuedIce.length > 0 && typeof entry.pc.addIceCandidate === 'function') {
        pendingIceByPeer.delete(targetPeerId);
        for (const cand of queuedIce) {
          try {
            await entry.pc.addIceCandidate(cand);
          } catch (_) {}
        }
      }
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
      if (patch.gameMode === 'vs' || patch.gameMode === 'blitz' || patch.gameMode === 'race') {
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
      const activePlayers = Array.from(players.values()).filter((p) => !p.spectator);
      if (activePlayers.length < 2) {
        notify('start_blocked', { reason: 'need_2_players' });
        return null;
      }
      clearBlitzTimer();
      clearRaceCountdown();
      room.round += 1;
      room.status = 'playing';
      room.winner = null;
      room.lastResults = null;
      eliminationSeq = 0;
      roundStartAt = Date.now();
      roundDisconnected = [];
      const randBits =
        root.crypto && typeof root.crypto.getRandomValues === 'function'
          ? root.crypto.getRandomValues(new Uint32Array(1))[0] >>> 0
          : (Math.floor(Math.random() * 0x100000000) >>> 0);
      const seed = ((Date.now() ^ randBits ^ Math.imul(room.round, 0x9e3779b1)) >>> 0) || 1;
      for (const p of players.values()) {
        p.alive = !p.spectator;
        p.finished = Boolean(p.spectator);
        p.koOrder = null;
        p.placement = null;
        p.eliminatedAt = null;
        p.altitude = 0;
        p.peakAltitude = 0;
        p.floor = 1;
        p.durationMs = 0;
        p.score = 0;
        p.lines = 0;
        p.attack = 0;
        p.vs = 0;
        p.pps = 0;
        p.apm = 0;
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
          maxPlayers: room.maxPlayers,
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
      self.board = snapshot.compactBoard !== undefined ? snapshot.compactBoard : self.board;
      if (snapshot.altitude !== undefined) {
        const nextAlt = Math.max(0, Number(snapshot.altitude) || 0);
        self.altitude = nextAlt;
        self.peakAltitude = Math.max(Number(self.peakAltitude) || 0, nextAlt);
      }
      if (snapshot.peakAltitude !== undefined) {
        self.peakAltitude = Math.max(Number(self.peakAltitude) || 0, Number(snapshot.peakAltitude) || 0);
      }
      if (snapshot.floor !== undefined) {
        self.floor = Math.max(1, Math.floor(Number(snapshot.floor) || 1));
      }
      if (snapshot.durationMs !== undefined) {
        self.durationMs = Math.max(0, Number(snapshot.durationMs) || 0);
      }
      self.score = Number(snapshot.score) || 0;
      self.lines = snapshot.lines || 0;
      self.attack = snapshot.attackSent || 0;
      self.vs = Number(snapshot.vs) || 0;
      self.pps = Number(snapshot.pps) || 0;
      self.apm = Number(snapshot.apm) || 0;
      broadcast({
        type: 'peer_board',
        id: 'host',
        board: self.board,
        altitude: self.altitude,
        peakAltitude: self.peakAltitude,
        floor: self.floor,
        durationMs: self.durationMs,
        score: self.score,
        lines: self.lines,
        attack: self.attack,
        vs: self.vs,
        pps: self.pps,
        apm: self.apm,
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
      if (snapshot && snapshot.altitude !== undefined) {
        const nextAlt = Math.max(0, Number(snapshot.altitude) || 0);
        self.altitude = nextAlt;
        self.peakAltitude = Math.max(Number(self.peakAltitude) || 0, nextAlt);
      }
      if (snapshot && snapshot.floor !== undefined) self.floor = Math.max(1, Math.floor(Number(snapshot.floor) || 1));
      if (snapshot && snapshot.durationMs !== undefined) self.durationMs = Math.max(0, Number(snapshot.durationMs) || 0);
      if (snapshot && snapshot.score !== undefined) self.score = Number(snapshot.score) || 0;
      if (snapshot && snapshot.lines !== undefined) self.lines = Number(snapshot.lines) || 0;
      if (snapshot && snapshot.attackSent !== undefined) self.attack = Number(snapshot.attackSent) || 0;
      if (snapshot && snapshot.vs !== undefined) self.vs = Number(snapshot.vs) || 0;
      if (snapshot && snapshot.pps !== undefined) self.pps = Number(snapshot.pps) || 0;
      if (snapshot && snapshot.apm !== undefined) self.apm = Number(snapshot.apm) || 0;
      broadcastRoomState();
      if (room.gameMode === 'blitz' || room.gameMode === 'race') {
        evaluateRoundEnd();
      }
    }

    function reportSelfKo(snapshot) {
      const self = players.get('host');
      const extra = snapshot
        ? {
            altitude: snapshot.altitude,
            peakAltitude: snapshot.peakAltitude,
            floor: snapshot.floor,
            durationMs: snapshot.durationMs,
            score: snapshot.score,
            lines: snapshot.lines,
            attack: snapshot.attackSent !== undefined ? snapshot.attackSent : snapshot.attack,
            vs: snapshot.vs,
            pps: snapshot.pps,
            apm: snapshot.apm
          }
        : null;
      if (!markPlayerEliminated(self, extra)) return;
      broadcastRoomState();
      evaluateRoundEnd();
    }

    async function handleIncomingSignalMsg(msg, replyFn) {
      if (closed || !msg || typeof msg !== 'object') return;
      if (msg.roomCode && normalizeRoomCode(msg.roomCode) !== room.roomCode) return;

      if (msg.kind === 'join_req' && msg.clientId) {
        if (cachedOffersByClient.has(msg.clientId)) {
          const cached = cachedOffersByClient.get(msg.clientId);
          const existingConn = cached && connections.get(cached.peerId);
          if (cached && (!existingConn || !existingConn.openedAt)) {
            await replyFn(cached);
          }
          return;
        }
        if (players.size >= maxPlayers) {
          await replyFn({
            kind: 'room_full',
            roomCode: room.roomCode,
            to: msg.clientId,
            maxPlayers
          });
          return;
        }
        if (seenClientReqs.has(msg.clientId)) return;
        seenClientReqs.add(msg.clientId);
        try {
          const invite = await createInvite(msg.name || 'PLAYER', {
            clientId: msg.clientId,
            avatar: msg.avatar,
            onTrickleCandidate(pId, cand) {
              if (closed || !cand) return;
              const conn = connections.get(pId);
              if (conn && conn.openedAt) return;
              replyFn({
                kind: 'ice',
                roomCode: room.roomCode,
                peerId: pId,
                to: msg.clientId,
                from: 'host',
                candidate: safeSerializeCandidate(cand)
              });
            }
          });
          const envelope = {
            kind: 'offer',
            roomCode: room.roomCode,
            to: msg.clientId,
            peerId: invite.peerId,
            roomName: room.roomName,
            hostName,
            offer: invite.code
          };
          cachedOffersByClient.set(msg.clientId, envelope);
          await replyFn(envelope);
        } catch (_) {
          seenClientReqs.delete(msg.clientId);
          await replyFn({
            kind: 'offer_relay',
            roomCode: room.roomCode,
            to: msg.clientId,
            peerId: 'p' + nextPeerSeq++,
            roomName: room.roomName,
            hostName
          });
        }
      } else if (msg.kind === 'answer' && msg.peerId && msg.answer && !seenAnswerPeerIds.has(msg.peerId)) {
        if (!pendingOffers.has(msg.peerId)) return;
        seenAnswerPeerIds.add(msg.peerId);
        await acceptAnswer(msg.peerId, msg.answer);
      } else if (msg.kind === 'ice' && msg.from !== 'host' && msg.peerId && msg.candidate) {
        const pend = pendingOffers.get(msg.peerId);
        const conn = connections.get(msg.peerId);
        const targetPc = (conn && conn.pc) || (pend && pend.pc);
        if (targetPc && targetPc.remoteDescription && typeof targetPc.addIceCandidate === 'function') {
          try {
            await targetPc.addIceCandidate(msg.candidate);
          } catch (_) {}
        } else if (targetPc) {
          if (!pendingIceByPeer.has(msg.peerId)) pendingIceByPeer.set(msg.peerId, []);
          pendingIceByPeer.get(msg.peerId).push(msg.candidate);
        }
      } else if (msg.kind === 'relay_open' && msg.clientId) {
        const targetPeerId = msg.peerId || ('p' + nextPeerSeq++);
        const existingRelay = relayChannels.get(targetPeerId);
        if (existingRelay && existingRelay.clientId === msg.clientId) {
          await replyFn({
            kind: 'relay_ack',
            roomCode: room.roomCode,
            peerId: targetPeerId,
            to: msg.clientId
          });
          return;
        }
        if (!players.has(targetPeerId) && players.size >= maxPlayers) {
          await replyFn({
            kind: 'room_full',
            roomCode: room.roomCode,
            to: msg.clientId,
            maxPlayers
          });
          return;
        }
        // Detach stalled WebRTC resources silently before binding the relay channel.
        const pend = pendingOffers.get(targetPeerId);
        if (pend) {
          pendingOffers.delete(targetPeerId);
          try {
            if (pend.pc) {
              pend.pc.onicecandidate = null;
              pend.pc.onicegatheringstatechange = null;
              pend.pc.onconnectionstatechange = null;
              pend.pc.oniceconnectionstatechange = null;
              if (typeof pend.pc.close === 'function') pend.pc.close();
            }
          } catch (_) {}
        }
        const staleConn = connections.get(targetPeerId);
        if (staleConn) {
          connections.delete(targetPeerId);
          try {
            if (staleConn.channel) {
              staleConn.channel.onclose = null;
              staleConn.channel.onopen = null;
              staleConn.channel.onmessage = null;
              if (typeof staleConn.channel.close === 'function') staleConn.channel.close();
            }
            if (staleConn.pc) {
              staleConn.pc.onicecandidate = null;
              staleConn.pc.onconnectionstatechange = null;
              staleConn.pc.oniceconnectionstatechange = null;
              if (typeof staleConn.pc.close === 'function') staleConn.pc.close();
            }
          } catch (_) {}
        }
        pendingIceByPeer.delete(targetPeerId);
        const rCh = createVirtualRelayChannel({
          roomCode: room.roomCode,
          peerId: targetPeerId,
          from: 'host',
          to: msg.clientId,
          publishPacket: (pkt) => replyFn(pkt),
          onLocalClose: () => {
            relayChannels.delete(targetPeerId);
            if (!closed) {
              replyFn({ kind: 'relay_close', roomCode: room.roomCode, peerId: targetPeerId, from: 'host', to: msg.clientId });
            }
          }
        });
        relayChannels.set(targetPeerId, { ch: rCh, clientId: msg.clientId });
        attachPeerChannel(targetPeerId, null, rCh, msg.name || 'PLAYER', msg.avatar);
        if (typeof rCh.onopen === 'function') rCh.onopen();
        await replyFn({
          kind: 'relay_ack',
          roomCode: room.roomCode,
          peerId: targetPeerId,
          to: msg.clientId
        });
      } else if (msg.kind === 'dc' && msg.from !== 'host' && msg.peerId && typeof msg.data === 'string') {
        const rEntry = relayChannels.get(msg.peerId);
        if (!rEntry || (rEntry.clientId && msg.from && rEntry.clientId !== msg.from)) return;
        if (isDupRelay(`${msg.peerId}:${msg.from}:${msg.seq}`)) return;
        if (rEntry.ch && typeof rEntry.ch.onmessage === 'function') {
          rEntry.ch.onmessage({ data: msg.data });
        }
      } else if (msg.kind === 'relay_close' && msg.from !== 'host' && msg.peerId) {
        const rEntry = relayChannels.get(msg.peerId);
        if (rEntry && (!rEntry.clientId || !msg.from || rEntry.clientId === msg.from)) {
          relayChannels.delete(msg.peerId);
          handlePeerDisconnect(msg.peerId, 'left the room');
        }
      }
    }

    async function pollAutoSignalingOnce() {
      if (closed || !shouldAutoSignalFetch) return;
      try {
        const items = await pollLegacyTopicSignals(fetchFn, room.roomCode, '2m');
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
          await handleIncomingSignalMsg(item.payload, (out) => postLegacyTopicSignal(fetchFn, room.roomCode, out));
        }
      } catch (_) {
        if (signalingStatus !== 'offline') {
          signalingStatus = 'offline';
          notify('signaling_offline');
        }
      }
    }

    function scheduleAutoPoll(delay) {
      if (closed || !shouldAutoSignalFetch) return;
      pollTimer = setTimeout(async () => {
        await pollAutoSignalingOnce();
        scheduleAutoPoll(pollIntervalMs);
      }, delay);
    }

    if (shouldAutoSignalWs) {
      signalBus = createMultiBrokerSignalBus({
        roomCode: room.roomCode,
        brokers: opts.brokers,
        wsFactory,
        onReady() {
          if (!closed && signalingStatus !== 'online') {
            signalingStatus = 'online';
            notify('signaling_ready');
          }
        },
        onOffline() {
          if (!closed && signalingStatus !== 'offline') {
            signalingStatus = 'offline';
            notify('signaling_offline');
          }
        },
        onMessage(msg) {
          handleIncomingSignalMsg(msg, (out) => {
            if (signalBus) signalBus.publish(out);
          });
        }
      });
    } else if (shouldAutoSignalFetch) {
      scheduleAutoPoll(25);
    }

    function close() {
      if (closed) return;
      const successor = selectNextHostCandidate(Array.from(players.values()));
      const canMigrate = Boolean(successor && room.roomCode && (shouldAutoSignalWs || shouldAutoSignalFetch));
      if (connections.size > 0) {
        broadcast({
          type: 'host_closing',
          reason: canMigrate ? 'host_migrating' : 'host_left',
          hostName,
          roomCode: room.roomCode,
          canMigrate,
          successorId: successor ? successor.id : null,
          successorName: successor ? successor.name : null,
          snapshot: {
            roomCode: room.roomCode,
            roomName: room.roomName,
            pieceSet: room.pieceSet,
            gameMode: room.gameMode,
            blitzDurationMs: room.blitzDurationMs,
            garbageMultiplier: room.garbageMultiplier,
            gravityLevel: room.gravityLevel,
            round: room.round,
            chat: chat.slice(-25)
          }
        });
      }
      closed = true;
      clearBlitzTimer();
      clearRaceCountdown();
      stopHostHeartbeat();
      const busToClose = signalBus;
      signalBus = null;
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
      cachedOffersByClient.clear();
      pendingIceByPeer.clear();
      relayChannels.clear();
      const connsToClose = Array.from(connections.values());
      connections.clear();
      listeners.clear();

      if (connsToClose.length > 0) {
        const closeSockets = () => {
          for (const conn of connsToClose) {
            try {
              if (conn.channel) conn.channel.onclose = null;
              if (conn.pc) {
                conn.pc.onconnectionstatechange = null;
                conn.pc.oniceconnectionstatechange = null;
              }
              if (conn.channel && typeof conn.channel.close === 'function') conn.channel.close();
              if (conn.pc && typeof conn.pc.close === 'function') conn.pc.close();
            } catch (_) {}
          }
          if (busToClose) busToClose.close();
        };
        // Allow queued host_closing frame (WebRTC or WS relay) to flush before tearing down sockets.
        unrefIfPossible(setTimeout(closeSockets, 25));
      } else if (busToClose) {
        busToClose.close();
      }
    }

    function setSelfSpectator(val) {
      const self = players.get('host');
      if (!self) return false;
      self.spectator = Boolean(val);
      if (self.spectator && room.status === 'playing' && self.alive) {
        self.alive = false;
        self.finished = true;
      }
      notify('self_spectator', { spectator: self.spectator });
      broadcastRoomState();
      if (room.status === 'playing') evaluateRoundEnd();
      else checkRaceReadyLaunch();
      return self.spectator;
    }

    function setReady(val) {
      const self = players.get('host');
      if (!self) return false;
      self.ready = Boolean(val);
      broadcastRoomState();
      checkRaceReadyLaunch();
      return self.ready;
    }

    function resetLobby() {
      clearBlitzTimer();
      clearRaceCountdown();
      room.status = 'lobby';
      room.winner = null;
      for (const p of players.values()) {
        p.ready = defaultReadyState;
        p.alive = !p.spectator;
        p.finished = false;
        p.koOrder = null;
        p.placement = null;
        p.eliminatedAt = null;
        p.altitude = 0;
        p.peakAltitude = 0;
        p.floor = 1;
        p.durationMs = 0;
        p.board = null;
      }
      broadcast({ type: 'lobby_reset' });
      broadcastRoomState();
      notify('lobby_reset');
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
      setSelfSpectator,
      setReady,
      resetLobby,
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
    const wsFactory = resolveWsFactory(opts);
    const fetchFn = resolveFetch(opts);
    const pollIntervalMs = Math.max(20, Number(opts.pollIntervalMs) || 650);
    const joinTimeoutMs = Math.max(500, Number(opts.joinTimeoutMs) || 15000);
    const relayFallbackDelayMs = Number.isFinite(Number(opts.relayFallbackDelayMs))
      ? Math.max(200, Number(opts.relayFallbackDelayMs))
      : 3600;
    const allowWsRelay = opts.wsRelay !== false;
    const heartbeatIntervalMs = Math.max(25, Number(opts.heartbeatIntervalMs) || 2500);
    const heartbeatTimeoutMs = Math.max(60, Number(opts.heartbeatTimeoutMs) || 8000);
    let roomAutoSignaling = Boolean(opts.autoSignaling !== false && (wsFactory || fetchFn));
    const playerName = String(opts.playerName || 'PLAYER').trim().slice(0, 20) || 'PLAYER';
    const playerAvatar = sanitizeAvatarUrl(opts.playerAvatar || opts.avatar || '');

    let pc = null;
    let channel = null;
    let selfId = null;
    let connected = false;
    let ready = true;
    let spectator = Boolean(opts.spectator);
    let closed = false;
    let hostLostHandled = false;
    let activeSignalBus = null;
    let usingRelay = false;
    let activeRelayPeerId = null;
    let activeClientId = null;
    let relayRetryTimer = null;
    let relayFallbackTimer = null;
    let clientHeartbeatTimer = null;
    let lastHostSeenAt = 0;
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
      winner: null,
      lastResults: null
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
        spectator,
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

    function stopClientHeartbeat() {
      if (clientHeartbeatTimer) {
        clearInterval(clientHeartbeatTimer);
        clientHeartbeatTimer = null;
      }
    }

    function handleHostLost(hostCloseMsg) {
      if (closed || hostLostHandled) return;
      hostLostHandled = true;
      stopClientHeartbeat();
      const wasConnected = connected;
      connected = false;

      if (channel) {
        try {
          channel.onclose = null;
          if (channel.readyState !== 'closed') channel.close();
        } catch (_) {}
      }
      if (pc) {
        try {
          pc.onconnectionstatechange = null;
          pc.oniceconnectionstatechange = null;
          if (typeof pc.close === 'function') pc.close();
        } catch (_) {}
      }

      const prevHost = players.find((p) => p && p.isHost);
      const previousHostName = (hostCloseMsg && hostCloseMsg.hostName) || (prevHost && prevHost.name) || 'HOST';
      const fallbackSuccessor = selectNextHostCandidate(players);
      const successorId = hostCloseMsg ? hostCloseMsg.successorId : (fallbackSuccessor ? fallbackSuccessor.id : null);
      const successorName = hostCloseMsg ? hostCloseMsg.successorName : (fallbackSuccessor ? fallbackSuccessor.name : null);
      const canMigrate = hostCloseMsg
        ? Boolean(hostCloseMsg.canMigrate && successorId && room.roomCode)
        : Boolean(wasConnected && roomAutoSignaling && room.roomCode && successorId && selfId);

      if (canMigrate) {
        const baseSnap = (hostCloseMsg && hostCloseMsg.snapshot) || {
          roomCode: room.roomCode,
          roomName: room.roomName,
          pieceSet: room.pieceSet,
          gameMode: room.gameMode,
          blitzDurationMs: room.blitzDurationMs,
          garbageMultiplier: room.garbageMultiplier,
          gravityLevel: room.gravityLevel,
          round: room.round,
          chat: chat.slice(-25)
        };
        room.status = 'migrating';
        if (selfId && successorId === selfId) {
          notify('host_migrate_self', {
            ...baseSnap,
            previousHostName,
            successorId,
            successorName: successorName || playerName
          });
        } else {
          notify('host_migrating', {
            ...baseSnap,
            previousHostName,
            successorId,
            successorName
          });
        }
        return;
      }

      room.status = 'disconnected';
      notify('host_closed', {
        reason: (hostCloseMsg && hostCloseMsg.reason) || 'host_left',
        hostName: previousHostName,
        roomCode: room.roomCode
      });
      notify('disconnected');
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
      lastHostSeenAt = Date.now();

      switch (msg.type) {
        case 'ping':
          send({ type: 'pong', ts: msg.ts || Date.now() });
          break;
        case 'host_closing':
          handleHostLost(msg);
          break;
        case 'welcome':
          selfId = msg.id;
          if (msg.autoSignaling !== undefined) {
            roomAutoSignaling = Boolean(msg.autoSignaling);
          }
          notify('welcome', { id: selfId });
          break;
        case 'room_state':
          if (msg.room) room = msg.room;
          if (Array.isArray(msg.players)) {
            players = msg.players;
            const me = selfId ? players.find((p) => p.id === selfId) : null;
            if (me) {
              spectator = Boolean(me.spectator);
              ready = Boolean(me.ready);
            }
          }
          if (Array.isArray(msg.chat)) chat = msg.chat;
          notify('room_state');
          break;
        case 'race_countdown':
          room.status = 'countdown';
          notify('race_countdown', msg);
          break;
        case 'race_countdown_cancel':
          room.status = 'lobby';
          notify('race_countdown_cancel', msg);
          break;
        case 'lobby_reset':
          room.status = 'lobby';
          notify('lobby_reset', msg);
          break;
        case 'peer_board': {
          const target = players.find((p) => p.id === msg.id);
          if (target) {
            target.board = msg.board;
            if (msg.altitude !== undefined) {
              const nextAlt = Math.max(0, Number(msg.altitude) || 0);
              target.altitude = nextAlt;
              target.peakAltitude = Math.max(Number(target.peakAltitude) || 0, nextAlt);
            }
            if (msg.peakAltitude !== undefined) {
              target.peakAltitude = Math.max(Number(target.peakAltitude) || 0, Number(msg.peakAltitude) || 0);
            }
            if (msg.floor !== undefined) target.floor = Math.max(1, Math.floor(Number(msg.floor) || 1));
            if (msg.durationMs !== undefined) target.durationMs = Math.max(0, Number(msg.durationMs) || 0);
            if (msg.score !== undefined) target.score = Number(msg.score) || 0;
            target.lines = msg.lines;
            target.attack = msg.attack;
            target.vs = msg.vs;
            if (msg.pps !== undefined) target.pps = Number(msg.pps) || 0;
            if (msg.apm !== undefined) target.apm = Number(msg.apm) || 0;
            target.alive = msg.alive;
            notify('peer_board', { id: msg.id });
          }
          break;
        }
        case 'match_start':
          room.status = 'playing';
          room.round = msg.round;
          room.winner = null;
          room.lastResults = null;
          notify('match_start', msg);
          break;
        case 'garbage':
          notify('garbage', msg);
          break;
        case 'round_end':
          room.status = 'results';
          room.winner = msg.winner;
          if (Array.isArray(msg.players)) players = msg.players;
          if (Array.isArray(msg.standings)) room.lastResults = msg.standings;
          notify('round_end', msg);
          break;
      }
    }

    async function joinFromInvite(inviteCode, inviteHooks) {
      const hooks = inviteHooks && typeof inviteHooks === 'object' ? inviteHooks : {};
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
      pc.onconnectionstatechange = () => {
        if (connected && !usingRelay && pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) {
          handleHostLost(null);
        } else if (!connected && !usingRelay && pc && pc.connectionState === 'failed' && hooks.onWebRtcFailed) {
          hooks.onWebRtcFailed('Connection failed');
        }
      };
      pc.oniceconnectionstatechange = () => {
        if (!connected && !usingRelay && pc && pc.iceConnectionState === 'failed') {
          if (hooks.onWebRtcFailed) {
            hooks.onWebRtcFailed('ICE failed (strict NAT or firewall)');
          } else {
            notify('webrtc_failed', { reason: 'ICE failed (strict NAT or firewall)' });
          }
        } else if (connected && !usingRelay && pc && (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed')) {
          handleHostLost(null);
        }
      };
      pc.ondatachannel = (ev) => {
        if (usingRelay || closed) return;
        channel = ev.channel;
        channel.onopen = () => {
          if (usingRelay || closed) return;
          if (relayFallbackTimer) {
            clearTimeout(relayFallbackTimer);
            relayFallbackTimer = null;
          }
          if (relayRetryTimer) {
            clearInterval(relayRetryTimer);
            relayRetryTimer = null;
          }
          connected = true;
          lastHostSeenAt = Date.now();
          if (activeSignalBus) {
            activeSignalBus.close();
            activeSignalBus = null;
          }
          send({ type: 'hello', name: playerName, avatar: playerAvatar });
          if (spectator) {
            send({ type: 'spectator', spectator: true });
          }
          notify('connected');
          stopClientHeartbeat();
          clientHeartbeatTimer = unrefIfPossible(setInterval(() => {
            if (closed || !connected) {
              stopClientHeartbeat();
              return;
            }
            if (
              !channel ||
              channel.readyState === 'closed' ||
              (!usingRelay && pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) ||
              Date.now() - lastHostSeenAt > heartbeatTimeoutMs
            ) {
              handleHostLost(null);
            }
          }, heartbeatIntervalMs));
        };
        channel.onmessage = (mEv) => handleServerMessage(mEv && mEv.data);
        channel.onclose = () => {
          handleHostLost(null);
        };
      };
      await pc.setRemoteDescription(decoded.sdp);
      if (Array.isArray(hooks.queuedIce) && typeof pc.addIceCandidate === 'function') {
        while (hooks.queuedIce.length > 0) {
          const cand = hooks.queuedIce.shift();
          try {
            await pc.addIceCandidate(cand);
          } catch (_) {}
        }
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGathering(
        pc,
        3000,
        typeof hooks.onTrickleCandidate === 'function' ? hooks.onTrickleCandidate : null
      );
      return await encodeSignal({
        role: 'answer',
        peerId: decoded.peerId || null,
        name: playerName,
        avatar: playerAvatar,
        sdp: pc.localDescription
      });
    }

    async function joinViaWsBus(code, clientId) {
      if (activeSignalBus) {
        activeSignalBus.close();
        activeSignalBus = null;
      }
      if (relayFallbackTimer) {
        clearTimeout(relayFallbackTimer);
        relayFallbackTimer = null;
      }
      if (relayRetryTimer) {
        clearInterval(relayRetryTimer);
        relayRetryTimer = null;
      }
      activeClientId = clientId;
      let offerResolve = null;
      let offerReject = null;
      let offerSettled = false;
      let lastAnswerEnvelope = null;
      let targetPeerId = null;
      const queuedHostIce = [];
      const isDupRelay = createRelayPacketDeduper(500);
      const reqPayload = { kind: 'join_req', roomCode: code, clientId, name: playerName, avatar: playerAvatar };

      const finishOffer = (fn, arg) => {
        if (offerSettled) return;
        offerSettled = true;
        clearTimeout(overallTimer);
        if (retryTimer) clearInterval(retryTimer);
        fn(arg);
      };

      const offerPromise = new Promise((resolve, reject) => {
        offerResolve = resolve;
        offerReject = reject;
      });

      function activateRelayTransport(peerIdForRelay) {
        if (closed || connected || usingRelay || !allowWsRelay) return;
        if (relayFallbackTimer) {
          clearTimeout(relayFallbackTimer);
          relayFallbackTimer = null;
        }
        usingRelay = true;
        activeRelayPeerId = peerIdForRelay || targetPeerId || null;

        // Cleanly silence failed/pending WebRTC handlers before swapping channel.
        if (channel) {
          try {
            channel.onopen = null;
            channel.onmessage = null;
            channel.onclose = null;
            if (channel.readyState !== 'closed') channel.close();
          } catch (_) {}
        }
        if (pc) {
          try {
            pc.onicecandidate = null;
            pc.onicegatheringstatechange = null;
            pc.onconnectionstatechange = null;
            pc.oniceconnectionstatechange = null;
            pc.ondatachannel = null;
            if (typeof pc.close === 'function') pc.close();
          } catch (_) {}
        }

        const rCh = createVirtualRelayChannel({
          roomCode: code,
          peerId: activeRelayPeerId || clientId,
          from: clientId,
          to: 'host',
          publishPacket: (pkt) => {
            if (activeSignalBus) {
              pkt.peerId = activeRelayPeerId || pkt.peerId;
              activeSignalBus.publish(pkt);
            }
          }
        });
        channel = rCh;
        notify('relay_fallback', { roomCode: code });

        const openReq = {
          kind: 'relay_open',
          roomCode: code,
          peerId: activeRelayPeerId,
          clientId,
          name: playerName,
          avatar: playerAvatar
        };
        if (activeSignalBus) activeSignalBus.publish(openReq);
        let tries = 0;
        relayRetryTimer = unrefIfPossible(setInterval(() => {
          tries += 1;
          if (closed || connected || tries > 8) {
            clearInterval(relayRetryTimer);
            relayRetryTimer = null;
            return;
          }
          if (activeSignalBus) activeSignalBus.publish(openReq);
        }, 1200));
      }

      const bus = createMultiBrokerSignalBus({
        roomCode: code,
        brokers: opts.brokers,
        wsFactory,
        onBrokerReady(cli) {
          if (closed) return;
          if (!offerSettled) {
            cli.publish(reqPayload);
          } else if (lastAnswerEnvelope && !connected && !usingRelay) {
            cli.publish(lastAnswerEnvelope);
          } else if (usingRelay && !connected) {
            cli.publish({ kind: 'relay_open', roomCode: code, peerId: activeRelayPeerId, clientId, name: playerName, avatar: playerAvatar });
          }
        },
        onMessage(msg) {
          if (!msg || typeof msg !== 'object') return;
          if (msg.kind === 'room_full' && msg.to === clientId) {
            finishOffer(offerReject, new Error(`Room #${code} is full (max ${msg.maxPlayers || 4} players).`));
          } else if (msg.kind === 'offer' && msg.to === clientId && msg.offer) {
            finishOffer(offerResolve, msg);
          } else if (msg.kind === 'offer_relay' && msg.to === clientId) {
            finishOffer(offerResolve, msg);
          } else if (msg.kind === 'ice' && msg.from === 'host' && (!msg.to || msg.to === clientId) && msg.candidate) {
            if (!usingRelay && pc && pc.remoteDescription && typeof pc.addIceCandidate === 'function') {
              try {
                pc.addIceCandidate(msg.candidate);
              } catch (_) {}
            } else {
              queuedHostIce.push(msg.candidate);
            }
          } else if (msg.kind === 'relay_ack' && msg.to === clientId) {
            if (!usingRelay || connected || closed) return;
            if (msg.peerId) activeRelayPeerId = msg.peerId;
            if (relayRetryTimer) {
              clearInterval(relayRetryTimer);
              relayRetryTimer = null;
            }
            connected = true;
            lastHostSeenAt = Date.now();
            send({ type: 'hello', name: playerName, avatar: playerAvatar });
            if (spectator) {
              send({ type: 'spectator', spectator: true });
            }
            notify('connected');
            stopClientHeartbeat();
            clientHeartbeatTimer = unrefIfPossible(setInterval(() => {
              if (closed || !connected) {
                stopClientHeartbeat();
                return;
              }
              if (!channel || channel.readyState === 'closed' || Date.now() - lastHostSeenAt > heartbeatTimeoutMs) {
                handleHostLost(null);
              }
            }, heartbeatIntervalMs));
          } else if (msg.kind === 'dc' && msg.from === 'host' && typeof msg.data === 'string') {
            if (!usingRelay) return;
            if (msg.to && msg.to !== clientId) return;
            if (activeRelayPeerId && msg.peerId && msg.peerId !== activeRelayPeerId) return;
            if (isDupRelay(`${msg.peerId}:host:${msg.seq}`)) return;
            handleServerMessage(msg.data);
          } else if (msg.kind === 'relay_close' && msg.from === 'host') {
            if (!usingRelay) return;
            if (msg.to && msg.to !== clientId) return;
            handleHostLost(null);
          }
        },
        onOffline() {
          finishOffer(offerReject, new Error('Signaling relay unavailable. Try MANUAL P2P FALLBACK.'));
        }
      });
      activeSignalBus = bus;

      const overallTimer = unrefIfPossible(setTimeout(() => {
        finishOffer(offerReject, new Error(`Room #${code} did not respond. Verify the Host room is open or use MANUAL P2P FALLBACK.`));
      }, joinTimeoutMs));

      let retryTimer = null;
      const relayOk = await bus.waitUntilReady(6000);
      if (closed) {
        finishOffer(offerReject, new Error('Room join cancelled.'));
        throw await offerPromise;
      }
      if (!relayOk) {
        finishOffer(offerReject, new Error('Could not connect to signaling relay. Use MANUAL P2P FALLBACK.'));
      } else {
        bus.publish(reqPayload);
        retryTimer = unrefIfPossible(setInterval(() => {
          if (!closed && !offerSettled) bus.publish(reqPayload);
        }, 2200));
      }

      let offerMsg;
      try {
        offerMsg = await offerPromise;
      } catch (err) {
        if (activeSignalBus === bus) {
          bus.close();
          activeSignalBus = null;
        }
        throw err;
      }

      targetPeerId = offerMsg.peerId;
      if (offerMsg.roomName) room.roomName = offerMsg.roomName;
      notify('exchanging_sdp', { roomCode: code, roomName: room.roomName });

      if (offerMsg.kind === 'offer_relay' || !offerMsg.offer) {
        activateRelayTransport(offerMsg.peerId);
        return {
          mode: 'relay',
          roomCode: code,
          roomName: room.roomName,
          peerId: offerMsg.peerId
        };
      }

      let answerCode;
      try {
        answerCode = await joinFromInvite(offerMsg.offer, {
          queuedIce: queuedHostIce,
          onTrickleCandidate(cand) {
            if (!closed && !usingRelay && activeSignalBus === bus) {
              bus.publish({
                kind: 'ice',
                roomCode: code,
                peerId: offerMsg.peerId,
                from: clientId,
                candidate: safeSerializeCandidate(cand)
              });
            }
          },
          onWebRtcFailed(reason) {
            if (allowWsRelay) {
              activateRelayTransport(offerMsg.peerId);
            } else {
              notify('webrtc_failed', { reason });
            }
          }
        });
      } catch (rtcErr) {
        if (allowWsRelay) {
          activateRelayTransport(offerMsg.peerId);
          return {
            mode: 'relay',
            roomCode: code,
            roomName: room.roomName,
            peerId: offerMsg.peerId
          };
        }
        throw rtcErr;
      }

      lastAnswerEnvelope = {
        kind: 'answer',
        roomCode: code,
        peerId: offerMsg.peerId,
        clientId,
        name: playerName,
        answer: answerCode
      };
      bus.publish(lastAnswerEnvelope);

      if (allowWsRelay && !connected && !closed && !usingRelay) {
        relayFallbackTimer = unrefIfPossible(setTimeout(() => {
          if (!closed && !connected && !usingRelay) {
            activateRelayTransport(offerMsg.peerId);
          }
        }, relayFallbackDelayMs));
      }

      return {
        mode: 'auto',
        roomCode: code,
        roomName: room.roomName,
        peerId: offerMsg.peerId
      };
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
        throw new Error('Invalid room code. Use a 4-char code (e.g. K7M4 or #K7M4) or FOX1:... invite.');
      }
      if (!wsFactory && !fetchFn) {
        throw new Error('Auto-join network unavailable. Use MANUAL P2P FALLBACK with a FOX1:... invite.');
      }

      const clientId = 'c_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      room.roomCode = code;
      room.status = 'connecting';
      notify('connecting', { roomCode: code });

      if (wsFactory) {
        return await joinViaWsBus(code, clientId);
      }

      await postLegacyTopicSignal(fetchFn, code, {
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
          items = await pollLegacyTopicSignals(fetchFn, code, '2m');
        } catch (_) {
          continue;
        }
        const offerMsg = items
          .map((item) => item && item.payload)
          .find((msg) => msg && msg.kind === 'offer' && msg.to === clientId && msg.offer);
        if (offerMsg) {
          if (offerMsg.roomName) room.roomName = offerMsg.roomName;
          const answerCode = await joinFromInvite(offerMsg.offer);
          await postLegacyTopicSignal(fetchFn, code, {
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
      if (closed) return;
      if (relayFallbackTimer) {
        clearTimeout(relayFallbackTimer);
        relayFallbackTimer = null;
      }
      if (relayRetryTimer) {
        clearInterval(relayRetryTimer);
        relayRetryTimer = null;
      }
      if (connected && channel && channel.readyState === 'open') {
        send({ type: 'leave' });
      }
      if (usingRelay && activeSignalBus && activeRelayPeerId) {
        activeSignalBus.publish({
          kind: 'relay_close',
          roomCode: room.roomCode,
          peerId: activeRelayPeerId,
          from: activeClientId || activeRelayPeerId
        });
      }
      closed = true;
      stopClientHeartbeat();
      if (activeSignalBus) {
        const busRef = activeSignalBus;
        activeSignalBus = null;
        if (usingRelay && connected) {
          unrefIfPossible(setTimeout(() => busRef.close(), 25));
        } else {
          busRef.close();
        }
      }
      if (channel) {
        try {
          channel.onclose = null;
          channel.close();
        } catch (_) {}
      }
      if (pc) {
        try {
          pc.onconnectionstatechange = null;
          pc.oniceconnectionstatechange = null;
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
      setSpectator(val) {
        spectator = Boolean(val);
        send({ type: 'spectator', spectator });
        notify('self_spectator', { spectator });
      },
      sendChat(text) {
        send({ type: 'chat', text });
      },
      updateSelfBoard(snapshot) {
        if (!snapshot) return;
        const selfPlayer = selfId ? players.find((p) => p.id === selfId) : null;
        if (selfPlayer) {
          if (snapshot.altitude !== undefined) {
            const nextAlt = Math.max(0, Number(snapshot.altitude) || 0);
            selfPlayer.altitude = nextAlt;
            selfPlayer.peakAltitude = Math.max(Number(selfPlayer.peakAltitude) || 0, nextAlt);
          }
          if (snapshot.floor !== undefined) selfPlayer.floor = Math.max(1, Math.floor(Number(snapshot.floor) || 1));
          if (snapshot.durationMs !== undefined) selfPlayer.durationMs = Math.max(0, Number(snapshot.durationMs) || 0);
          selfPlayer.score = Number(snapshot.score) || 0;
          selfPlayer.lines = snapshot.lines || 0;
          selfPlayer.attack = snapshot.attackSent || 0;
          selfPlayer.vs = Number(snapshot.vs) || 0;
          selfPlayer.pps = Number(snapshot.pps) || 0;
          selfPlayer.apm = Number(snapshot.apm) || 0;
        }
        send({
          type: 'board_state',
          board: snapshot.compactBoard,
          altitude: snapshot.altitude !== undefined ? Number(snapshot.altitude) || 0 : undefined,
          peakAltitude: snapshot.peakAltitude !== undefined ? Number(snapshot.peakAltitude) || 0 : undefined,
          floor: snapshot.floor !== undefined ? Math.max(1, Math.floor(Number(snapshot.floor) || 1)) : undefined,
          durationMs: snapshot.durationMs !== undefined ? Math.max(0, Number(snapshot.durationMs) || 0) : undefined,
          score: Number(snapshot.score) || 0,
          lines: snapshot.lines || 0,
          attack: snapshot.attackSent || 0,
          vs: Number(snapshot.vs) || 0,
          pps: Number(snapshot.pps) || 0,
          apm: Number(snapshot.apm) || 0
        });
        if (selfPlayer) notify('self_board', { id: selfId });
      },
      sendSelfAttack(amount, callout) {
        send({ type: 'attack', amount, callout });
      },
      reportSelfFinish(snapshot) {
        send({
          type: 'finish_match',
          altitude: snapshot && snapshot.altitude !== undefined ? Number(snapshot.altitude) || 0 : undefined,
          peakAltitude: snapshot && snapshot.peakAltitude !== undefined ? Number(snapshot.peakAltitude) || 0 : undefined,
          floor: snapshot && snapshot.floor !== undefined ? Math.max(1, Math.floor(Number(snapshot.floor) || 1)) : undefined,
          durationMs: snapshot && snapshot.durationMs !== undefined ? Math.max(0, Number(snapshot.durationMs) || 0) : undefined,
          score: Number(snapshot && snapshot.score) || 0,
          lines: Number(snapshot && snapshot.lines) || 0,
          attack: Number(snapshot && (snapshot.attackSent !== undefined ? snapshot.attackSent : snapshot.attack)) || 0,
          vs: Number(snapshot && snapshot.vs) || 0,
          pps: Number(snapshot && snapshot.pps) || 0,
          apm: Number(snapshot && snapshot.apm) || 0
        });
      },
      reportSelfKo(snapshot) {
        const extra = snapshot
          ? {
              altitude: snapshot.altitude !== undefined ? Number(snapshot.altitude) || 0 : undefined,
              peakAltitude: snapshot.peakAltitude !== undefined ? Number(snapshot.peakAltitude) || 0 : undefined,
              floor: snapshot.floor !== undefined ? Math.max(1, Math.floor(Number(snapshot.floor) || 1)) : undefined,
              durationMs: snapshot.durationMs !== undefined ? Math.max(0, Number(snapshot.durationMs) || 0) : undefined,
              score: Number(snapshot.score) || 0,
              lines: Number(snapshot.lines) || 0,
              attack: Number(snapshot.attackSent !== undefined ? snapshot.attackSent : snapshot.attack) || 0,
              vs: Number(snapshot.vs) || 0,
              pps: Number(snapshot.pps) || 0,
              apm: Number(snapshot.apm) || 0
            }
          : {};
        send({ type: 'ko', ...extra });
      },
      close
    };
  }

  root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
  root.__TWFOX_INTERNAL__.p2pRoom = {
    ICE_SERVERS,
    ROOM_CODE_ALPHABET,
    SIGNAL_BROKERS,
    mqttPacketConnect,
    mqttPacketSubscribe,
    mqttPacketPublish,
    mqttPacketPingReq,
    mqttPacketDisconnect,
    createMqttFrameReader,
    generateRoomCode,
    normalizeRoomCode,
    sanitizeAvatarUrl,
    encodeSignal,
    decodeSignal,
    pickAttackTarget,
    selectNextHostCandidate,
    buildRoundStandings,
    createHostServer,
    createClientPeer
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));
