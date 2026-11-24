(function (root) {
  'use strict';

  const TETRIOPLUS_BASE_URL = 'https://you.have.fail/tetrioplus/data/';
  const TETRIOPLUS_CATALOG_URL = TETRIOPLUS_BASE_URL + 'data.json';
  const TETRIOPLUS_VOTES_URL = TETRIOPLUS_BASE_URL + 'votes.json';
  const SUPPORTED_IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
  const SUPPORTED_VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
  const SUPPORTED_AUDIO_EXT = /\.(ogg|wav|mp3|webm|flac|m4a)$/i;

  const BUILTIN_BG_PRESETS = [
    {
      id: 'none',
      name: 'Original TETR.IO',
      description: 'Use the native TETR.IO Desktop background without extra overlay.'
    },
    {
      id: 'starfield',
      name: 'Hyper Starfield',
      description: '3D animated starfield with neon trails.'
    },
    {
      id: 'synth_grid',
      name: 'Synthwave Horizon',
      description: 'Animated retro synthwave grid in endless perspective.'
    },
    {
      id: 'cyber_wave',
      name: 'Cyber Aurora',
      description: 'Soft luminous real-time gradient waves.'
    }
  ];

  function toUint8Array(input) {
    if (!input) return new Uint8Array(0);
    if (input instanceof Uint8Array) return input;
    if (ArrayBuffer.isView(input)) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    if (
      input instanceof ArrayBuffer ||
      Object.prototype.toString.call(input) === '[object ArrayBuffer]' ||
      Object.prototype.toString.call(input) === '[object SharedArrayBuffer]'
    ) {
      return new Uint8Array(input);
    }
    if (typeof input.byteLength === 'number' && input.buffer) {
      return new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength);
    }
    return new Uint8Array(0);
  }

  function encodeCatalogPath(relPath) {
    if (!relPath) return '';
    return String(relPath)
      .replace(/^\/+/, '')
      .split('/')
      .map((seg) => {
        try {
          return encodeURIComponent(decodeURIComponent(seg));
        } catch (_) {
          return encodeURIComponent(seg);
        }
      })
      .join('/');
  }

  function bytesToBase64(bytesInput) {
    const bytes = toUint8Array(bytesInput);
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
      return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
    }
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, slice);
    }
    return root.btoa(binary);
  }

  function base64ToBytes(b64) {
    const clean = String(b64 || '').replace(/\s+/g, '');
    if (!clean) return new Uint8Array(0);
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
      const buf = Buffer.from(clean, 'base64');
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    const binary = root.atob(clean);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }

  function detectMimeFromBytes(bytesInput, fallbackMime) {
    const b = toUint8Array(bytesInput);
    if (b.length >= 4) {
      if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
      if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
      if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
      if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'audio/ogg';
      if (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) return 'audio/flac';
      if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return 'application/zip';
      if (b[0] === 0x74 && b[1] === 0x52 && b[2] === 0x53 && b[3] === 0x44) return 'application/x-trsd';
      if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
      if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b.length >= 12) {
        const fourcc = String.fromCharCode(b[8], b[9], b[10], b[11]);
        if (fourcc === 'WEBP') return 'image/webp';
        if (fourcc === 'WAVE') return 'audio/wav';
      }
      if (b.length >= 8 && String.fromCharCode(b[4], b[5], b[6], b[7]) === 'ftyp') return 'video/mp4';
      if ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) {
        return 'audio/mpeg';
      }
    }
    const prefix = String.fromCharCode.apply(null, b.subarray(0, Math.min(48, b.length))).trim();
    if (prefix.startsWith('<svg') || prefix.startsWith('<?xml')) return 'image/svg+xml';
    if (prefix.startsWith('{') || prefix.startsWith('[')) return 'application/json';
    return fallbackMime || 'application/octet-stream';
  }

  function normalizeDataUrl(value, fallbackMime) {
    if (typeof value !== 'string' || !value) return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith('data:')) return trimmed;
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx === -1) return null;
    const header = trimmed.slice(0, commaIdx);
    const body = trimmed.slice(commaIdx + 1);
    if (!/application\/octet-stream/i.test(header)) return trimmed;
    let detected = fallbackMime || 'image/png';
    if (/;base64/i.test(header)) {
      const sample = base64ToBytes(body.slice(0, 64));
      detected = detectMimeFromBytes(sample, detected);
      return `data:${detected};base64,${body}`;
    }
    return `data:${detected},${body}`;
  }

  function bytesToDataUrl(bytesInput, fallbackMime) {
    const bytes = toUint8Array(bytesInput);
    const mime = detectMimeFromBytes(bytes, fallbackMime);
    return `data:${mime};base64,${bytesToBase64(bytes)}`;
  }

  function dataUrlToBytes(dataUrl) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return new Uint8Array(0);
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return new Uint8Array(0);
    const meta = dataUrl.slice(5, commaIdx);
    const body = dataUrl.slice(commaIdx + 1);
    if (/;base64/i.test(meta)) {
      return base64ToBytes(body);
    }
    const decoded = decodeURIComponent(body);
    const out = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) out[i] = decoded.charCodeAt(i) & 0xff;
    return out;
  }

  const TETRIO_SIMPLE_COORDS = {
    z: [0, 0],
    l: [1, 0],
    o: [2, 0],
    s: [3, 0],
    i: [4, 0],
    j: [0, 1],
    t: [1, 1],
    d: [2, 1],
    gb: [3, 1],
    gbd: [4, 1]
  };

  const TETRIO_CONNECTED_COORDS = {
    z: [0, 0],
    l: [4, 0],
    o: [8, 0],
    s: [12, 0],
    i: [0, 6],
    j: [4, 6],
    t: [8, 6],
    d: [12, 6],
    gb: [16, 0],
    gbd: [16, 4]
  };

  const STRIP12_MINO_SLOTS = [
    ['z', 0],
    ['l', 1],
    ['o', 2],
    ['s', 3],
    ['i', 4],
    ['j', 5],
    ['t', 6],
    ['d', 8],
    ['gb', 9],
    ['gbd', 10]
  ];

  const STRIP12_GHOST_SLOTS = {
    g: 7,
    x: 11
  };

  function parseSvgDimensions(svgInput) {
    const text = String(svgInput || '');
    if (!text) return null;
    const vbMatch = text.match(/viewBox\s*=\s*["']\s*[-\d.]+\s*[,\s]\s*[-\d.]+\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/i);
    if (vbMatch) {
      const w = Math.round(Number(vbMatch[1]));
      const h = Math.round(Number(vbMatch[2]));
      if (w > 0 && h > 0) return { width: w, height: h };
    }
    const wMatch = text.match(/\bwidth\s*=\s*["']\s*([\d.]+)(?:px)?\s*["']/i);
    const hMatch = text.match(/\bheight\s*=\s*["']\s*([\d.]+)(?:px)?\s*["']/i);
    if (wMatch && hMatch) {
      const w = Math.round(Number(wMatch[1]));
      const h = Math.round(Number(hMatch[1]));
      if (w > 0 && h > 0) return { width: w, height: h };
    }
    return null;
  }

  function readPngDimensions(bytesInput) {
    const b = toUint8Array(bytesInput);
    if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      return {
        width: dv.getUint32(16, false),
        height: dv.getUint32(20, false)
      };
    }
    return null;
  }

  function readImageDimensions(bytesInput, mimeHint) {
    const png = readPngDimensions(bytesInput);
    if (png) return png;
    const b = toUint8Array(bytesInput);
    if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) {
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      return {
        width: dv.getUint16(6, true),
        height: dv.getUint16(8, true)
      };
    }
    const mime = mimeHint || detectMimeFromBytes(b, '');
    if (mime === 'image/svg+xml' || (b.length > 0 && b[0] === 0x3c)) {
      return parseSvgDimensions(decodeUtf8(b.subarray(0, Math.min(2048, b.length))));
    }
    return null;
  }

  function readPngDimensionsFromDataUrl(dataUrl) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
    if (dataUrl.includes('image/svg+xml')) {
      return parseSvgDimensions(decodeUtf8(dataUrlToBytes(dataUrl)));
    }
    if (!dataUrl.includes('base64,')) return null;
    const b64Head = dataUrl.split('base64,')[1].slice(0, 96);
    return readImageDimensions(base64ToBytes(b64Head));
  }

  function detectSkinSourceLayout(width, height, isGhost, formatHint) {
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    if (!w || !h) {
      if (isGhost) return 'simple_hd';
      if (typeof formatHint === 'string' && /connected/i.test(formatHint)) return 'connected_uhd';
      if (typeof formatHint === 'string' && /(raster|svg|anim)/i.test(formatHint)) return 'strip12';
      return 'simple_hd';
    }
    if (isGhost) {
      if (w >= h * 5) return 'strip12_ghost';
      if (Math.abs(w - h) <= 8) {
        if (w >= 768) return 'connected_uhd';
        if (w >= 384) return 'connected_hd';
        if (w >= 192) return 'simple_uhd';
        return 'simple_hd';
      }
      if (w > h * 1.4 && w <= h * 3.5) return 'simple_rect';
      return w >= 192 ? 'simple_uhd' : 'simple_hd';
    }
    if (w >= h * 6) return 'strip12';
    if (Math.abs(w - h) <= 8) {
      if (w >= 1536) return 'connected_uhd';
      if (w >= 768) return 'connected_hd';
      if (w >= 384) return 'simple_uhd';
      return 'simple_hd';
    }
    if (w > h * 1.8 && w <= h * 3.2) return 'simple_5x2_cropped';
    return w >= 384 ? 'simple_uhd' : 'simple_hd';
  }

  function classifySkinFormat(dims, isGhost, formatHint) {
    if (dims && dims.width && dims.height) {
      const layout = detectSkinSourceLayout(dims.width, dims.height, isGhost, formatHint);
      return layout.startsWith('connected_') ? 'connected' : 'simple';
    }
    if (typeof formatHint === 'string') {
      if (/connected/i.test(formatHint)) return 'connected';
      if (/(raster|svg|anim)/i.test(formatHint)) return 'simple';
    }
    return 'simple';
  }

  function classifyCatalogCategory(rawItem) {
    const id = String(rawItem && rawItem.id || '');
    const name = String(rawItem && rawItem.name || '');
    const path = String(rawItem && rawItem.path || '');
    const desc = String(rawItem && rawItem.description || '');
    const tags = Array.isArray(rawItem && rawItem.tags) ? rawItem.tags.join(' ') : '';
    const format = String(rawItem && rawItem.format || '');
    const rawType = String(rawItem && rawItem.type || '');
    const combined = `${id} ${name} ${path} ${desc} ${tags}`;

    if (rawType === 'sfx' || /^sfx[-_]/i.test(id) || /\/sfx\//i.test(path) || /\bsfx\b|sound effects?|soundpack/i.test(combined)) {
      return 'sfx';
    }
    if (/board|queue|grid/i.test(`${name} ${path} ${tags} ${desc}`)) {
      return 'board';
    }
    if (rawType === 'unknown' && /\b(bg|background|backdrop|wallpaper|motion graphic)\b/i.test(combined)) {
      return 'background';
    }
    if (rawType === 'unknown' && format === 'null' && /\.tpse$/i.test(path)) {
      return 'board';
    }
    return 'skin';
  }

  function buildDownloadCandidates(rawItem) {
    const urls = [];
    const pushUnique = (u) => {
      if (u && !urls.includes(u)) urls.push(u);
    };
    const tpsePath = rawItem && rawItem.tpsePath ? String(rawItem.tpsePath) : '';
    const rawPath = rawItem && rawItem.path ? String(rawItem.path) : '';

    if (tpsePath) {
      pushUnique(TETRIOPLUS_BASE_URL + encodeCatalogPath(tpsePath));
      if (!tpsePath.endsWith('.tpse') || (rawPath.endsWith('.tpse') && !tpsePath.endsWith('.tpse.tpse'))) {
        pushUnique(TETRIOPLUS_BASE_URL + encodeCatalogPath(tpsePath + '.tpse'));
      }
    }
    if (rawPath) {
      pushUnique(TETRIOPLUS_BASE_URL + encodeCatalogPath(rawPath));
    }
    return urls;
  }

  function normalizeCatalogItem(rawItem, votesMap) {
    if (!rawItem || !rawItem.id) return null;
    const category = classifyCatalogCategory(rawItem);
    const voteObj = votesMap && votesMap[rawItem.id];
    const votes = Number(
      voteObj && typeof voteObj === 'object'
        ? voteObj.votes ?? voteObj.total ?? 0
        : voteObj || 0
    ) || 0;
    const activeVotes = Number(
      voteObj && typeof voteObj === 'object'
        ? voteObj.activeVotes ?? voteObj.active ?? votes
        : votes
    ) || 0;

    return {
      id: String(rawItem.id),
      name: String(rawItem.name || rawItem.id),
      author: String(rawItem.author || 'Unknown'),
      description: String(rawItem.description || ''),
      category,
      rawType: rawItem.type ? String(rawItem.type) : 'unknown',
      format: rawItem.format ? String(rawItem.format) : '',
      animated: Boolean(/anim/i.test(String(rawItem.format || '')) || /\.gif$/i.test(String(rawItem.path || ''))),
      uploaded: Number(rawItem.uploaded) || 0,
      updated: Number(rawItem.updated) || Number(rawItem.uploaded) || 0,
      votes,
      activeVotes,
      modified: Array.isArray(rawItem.modified) ? rawItem.modified.slice() : [],
      tags: Array.isArray(rawItem.tags) ? rawItem.tags.slice() : [],
      path: rawItem.path ? String(rawItem.path) : '',
      tpsePath: rawItem.tpsePath ? String(rawItem.tpsePath) : '',
      previewPath: rawItem.previewPath ? String(rawItem.previewPath) : '',
      downloadUrls: buildDownloadCandidates(rawItem),
      source: rawItem.source ? String(rawItem.source) : ''
    };
  }

  function getStaticCatalogPreviewUrl(item) {
    if (!item || typeof item !== 'object') return null;
    if (item.previewPath && SUPPORTED_IMAGE_EXT.test(item.previewPath)) {
      return TETRIOPLUS_BASE_URL + encodeCatalogPath(item.previewPath);
    }
    if (item.category === 'sfx') return null;
    const fmt = String(item.format || '').toLowerCase();
    const rawPath = String(item.path || '');
    if (
      rawPath &&
      !/\.zip$/i.test(rawPath) &&
      (fmt === 'tetrioraster' || fmt === 'tetriosvg' || fmt === 'tetrioanim' || fmt === 'jstrisraster' || fmt === 'jstrisanim')
    ) {
      return TETRIOPLUS_BASE_URL + encodeCatalogPath(rawPath);
    }
    return null;
  }

  function filterAndSortCatalog(items, opts) {
    const options = opts || {};
    const cat = String(options.category || 'all').toLowerCase();
    const query = String(options.search || '').trim().toLowerCase();
    const sortBy = String(options.sort || 'votes').toLowerCase();

    const filtered = (Array.isArray(items) ? items : []).filter((item) => {
      if (!item) return false;
      if (cat === 'animated') {
        if (!item.animated) return false;
      } else if (cat === 'skins') {
        if (item.category === 'sfx') return false;
      } else if (cat !== 'all' && item.category !== cat) {
        return false;
      }
      if (!query) return true;
      const haystack = `${item.name} ${item.author} ${item.description} ${item.format} ${(item.tags || []).join(' ')}`.toLowerCase();
      return haystack.includes(query);
    });

    const sorted = filtered.slice();
    sorted.sort((a, b) => {
      if (sortBy === 'recent') {
        return (b.updated - a.updated) || (b.votes - a.votes) || a.name.localeCompare(b.name);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name) || (b.votes - a.votes);
      }
      if (sortBy === 'author') {
        return a.author.localeCompare(b.author) || a.name.localeCompare(b.name);
      }
      return (b.votes - a.votes) || (b.activeVotes - a.activeVotes) || (b.updated - a.updated);
    });
    return sorted;
  }

  /** Returns true when a locally stored asset record matches a DOWNLOADED category filter ('all' | 'skins' | 'sfx'). */
  function matchesInstalledCategory(record, category) {
    if (!record) return false;
    const cat = String(category || 'all').toLowerCase();
    if (cat === 'all') return true;
    const caps = record.capabilities && typeof record.capabilities === 'object' ? record.capabilities : {};
    const recCat = String(record.category || '').toLowerCase();
    if (cat === 'sfx') {
      return Boolean(caps.sfx || recCat === 'sfx');
    }
    if (cat === 'skins') {
      return Boolean(
        caps.skin ||
        caps.ghost ||
        caps.board ||
        caps.queue ||
        caps.grid ||
        recCat === 'skin' ||
        recCat === 'board' ||
        (!caps.sfx && !caps.background && recCat !== 'sfx' && recCat !== 'background')
      );
    }
    return recCat === cat;
  }

  /** Filters locally stored asset records by category ('all' | 'skins' | 'sfx'). */
  function filterInstalledAssets(items, category) {
    const list = Array.isArray(items) ? items : [];
    const cat = String(category || 'all').toLowerCase();
    if (cat === 'all') return list.slice();
    return list.filter((item) => matchesInstalledCategory(item, cat));
  }

  function normalizeSfxAtlasEntries(customSoundAtlas) {
    if (!customSoundAtlas || typeof customSoundAtlas !== 'object') return {};
    const out = {};
    for (const key of Object.keys(customSoundAtlas)) {
      const tuple = customSoundAtlas[key];
      if (!Array.isArray(tuple) || tuple.length < 2) continue;
      const offsetMs = Number(tuple[0]);
      const durationMs = Number(tuple[1]);
      if (!Number.isFinite(offsetMs) || !Number.isFinite(durationMs) || durationMs <= 0) continue;
      out[String(key).trim().toLowerCase()] = {
        offsetSec: Math.max(0, offsetMs / 1000),
        durationSec: durationMs / 1000
      };
    }
    return out;
  }

  function parseTpseObject(tpseInput, meta) {
    const obj = typeof tpseInput === 'string' ? JSON.parse(tpseInput) : tpseInput;
    if (!obj || typeof obj !== 'object') {
      throw new Error('Invalid TPSE object');
    }
    const hint = meta && meta.format ? meta.format : '';
    const skinUrl = normalizeDataUrl(obj.skin, 'image/png');
    const ghostUrl = normalizeDataUrl(obj.ghost, 'image/png');
    const skinAnimUrl = normalizeDataUrl(obj.skinAnim, 'image/png');
    const ghostAnimUrl = normalizeDataUrl(obj.ghostAnim, 'image/png');
    const boardUrl = normalizeDataUrl(obj.board, 'image/png');
    const queueUrl = normalizeDataUrl(obj.queue, 'image/png');
    const gridUrl = normalizeDataUrl(obj.grid, 'image/png');
    const customSoundsUrl = normalizeDataUrl(obj.customSounds, 'audio/ogg');
    const atlas = normalizeSfxAtlasEntries(obj.customSoundAtlas);
    let parsedSfxFiles = null;
    if (obj.sfxFiles && typeof obj.sfxFiles === 'object') {
      const cleanSfx = {};
      for (const [k, v] of Object.entries(obj.sfxFiles)) {
        const key = String(k || '').trim().toLowerCase();
        const url = normalizeDataUrl(v, 'audio/ogg');
        if (key && url) cleanSfx[key] = url;
      }
      if (Object.keys(cleanSfx).length > 0) parsedSfxFiles = cleanSfx;
    }

    const skinDims = skinUrl ? readPngDimensionsFromDataUrl(skinUrl) : null;
    const ghostDims = ghostUrl ? readPngDimensionsFromDataUrl(ghostUrl) : null;

    const backgrounds = [];
    if (Array.isArray(obj.backgrounds)) {
      for (const bg of obj.backgrounds) {
        if (!bg || typeof bg !== 'object') continue;
        const sidecarKey = bg.id ? 'background-' + String(bg.id) : '';
        const rawSrc = (sidecarKey && obj[sidecarKey]) || bg.data || bg.url || bg.src || '';
        const fname = String(bg.filename || bg.name || 'background');
        const inferredVideo = bg.type === 'video' || SUPPORTED_VIDEO_EXT.test(fname);
        const src = normalizeDataUrl(rawSrc, inferredVideo ? 'video/webm' : 'image/png');
        if (!src) continue;
        const isVid = /^data:video\//i.test(src) || SUPPORTED_VIDEO_EXT.test(fname) || SUPPORTED_VIDEO_EXT.test(src);
        backgrounds.push({
          id: String(bg.id || 'bg-' + backgrounds.length),
          filename: fname,
          mediaType: isVid ? 'video' : 'image',
          dataUrl: src
        });
      }
    }
    if (obj.animatedBackground && typeof obj.animatedBackground === 'object') {
      const ab = obj.animatedBackground;
      const sidecarKey = ab.id ? 'background-' + String(ab.id) : '';
      const rawSrc = (sidecarKey && obj[sidecarKey]) || ab.data || ab.url || ab.src || '';
      const src = normalizeDataUrl(rawSrc, 'image/png');
      if (src) {
        const isVid = /^data:video\//i.test(src) || SUPPORTED_VIDEO_EXT.test(String(ab.filename || ''));
        backgrounds.push({
          id: String(ab.id || 'anim-bg'),
          filename: String(ab.filename || 'animated-background'),
          mediaType: isVid ? 'video' : 'image',
          dataUrl: src
        });
      }
    }
    for (const k of Object.keys(obj)) {
      if (!k.startsWith('background-')) continue;
      const bgId = k.slice('background-'.length);
      if (backgrounds.some((b) => b.id === bgId)) continue;
      const src = normalizeDataUrl(obj[k], 'image/png');
      if (!src) continue;
      const isVid = /^data:video\//i.test(src);
      backgrounds.push({
        id: bgId || 'bg-' + backgrounds.length,
        filename: isVid ? `${bgId}.webm` : `${bgId}.png`,
        mediaType: isVid ? 'video' : 'image',
        dataUrl: src
      });
    }

    const capabilities = {
      skin: Boolean(skinUrl || skinAnimUrl),
      ghost: Boolean(ghostUrl || ghostAnimUrl),
      board: Boolean(boardUrl),
      queue: Boolean(queueUrl),
      grid: Boolean(gridUrl),
      sfx: Boolean((customSoundsUrl && Object.keys(atlas).length > 0) || parsedSfxFiles),
      background: backgrounds.length > 0,
      animated: Boolean(skinAnimUrl || ghostAnimUrl || (backgrounds[0] && (backgrounds[0].mediaType === 'video' || /gif/i.test(backgrounds[0].dataUrl))))
    };

    let category = meta && meta.category ? meta.category : 'skin';
    if (capabilities.skin || capabilities.ghost) {
      category = 'skin';
    } else if (capabilities.board || capabilities.queue || capabilities.grid) {
      category = 'board';
    } else if (capabilities.sfx) {
      category = 'sfx';
    } else if (capabilities.background) {
      category = 'background';
    }

    return {
      category,
      capabilities,
      skin: skinUrl,
      skinFormat: skinUrl ? classifySkinFormat(skinDims, false, hint) : null,
      skinAnim: skinAnimUrl,
      skinAnimMeta: obj.skinAnimMeta && typeof obj.skinAnimMeta === 'object' ? { ...obj.skinAnimMeta } : null,
      ghost: ghostUrl,
      ghostFormat: ghostUrl ? classifySkinFormat(ghostDims, true, hint) : null,
      ghostAnim: ghostAnimUrl,
      ghostAnimMeta: obj.ghostAnimMeta && typeof obj.ghostAnimMeta === 'object' ? { ...obj.ghostAnimMeta } : null,
      board: boardUrl,
      queue: queueUrl,
      grid: gridUrl,
      sfxAtlasDataUrl: customSoundsUrl,
      sfxAtlasMap: atlas,
      sfxFiles: parsedSfxFiles,
      backgrounds
    };
  }

  function readAscii(bytes, start, len) {
    let out = '';
    for (let i = 0; i < len; i++) {
      out += String.fromCharCode(bytes[start + i]);
    }
    return out;
  }

  function decodeUtf8(bytes) {
    if (typeof TextDecoder === 'function') {
      return new TextDecoder('utf-8').decode(bytes);
    }
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
      return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('utf8');
    }
    let str = '';
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return str;
  }

  async function defaultInflateRaw(compressedBytes) {
    if (typeof root.DecompressionStream === 'function' && typeof root.Response === 'function') {
      const ds = new root.DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      const writePromise = writer.write(compressedBytes).then(() => writer.close());
      const buf = await new root.Response(ds.readable).arrayBuffer();
      await writePromise;
      return new Uint8Array(buf);
    }
    throw new Error('No deflate-raw decompressor available');
  }

  async function parseZipArchive(input, inflateRawFn) {
    const bytes = toUint8Array(input);
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocdOffset = -1;
    const minOff = Math.max(0, bytes.length - 65557);
    for (let i = bytes.length - 22; i >= minOff; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) {
      throw new Error('Invalid ZIP archive: missing End of Central Directory');
    }

    const totalEntries = dv.getUint16(eocdOffset + 10, true);
    const cdOffset = dv.getUint32(eocdOffset + 16, true);
    const inflate = typeof inflateRawFn === 'function' ? inflateRawFn : defaultInflateRaw;
    const entries = [];
    let cursor = cdOffset;

    for (let i = 0; i < totalEntries && cursor + 46 <= bytes.length; i++) {
      if (dv.getUint32(cursor, true) !== 0x02014b50) break;
      const method = dv.getUint16(cursor + 10, true);
      const compressedSize = dv.getUint32(cursor + 20, true);
      const nameLen = dv.getUint16(cursor + 28, true);
      const extraLen = dv.getUint16(cursor + 30, true);
      const commentLen = dv.getUint16(cursor + 32, true);
      const localOffset = dv.getUint32(cursor + 42, true);
      const fileName = decodeUtf8(bytes.subarray(cursor + 46, cursor + 46 + nameLen));
      cursor += 46 + nameLen + extraLen + commentLen;

      if (!fileName || fileName.endsWith('/')) continue;
      if (localOffset + 30 > bytes.length || dv.getUint32(localOffset, true) !== 0x04034b50) continue;

      const lNameLen = dv.getUint16(localOffset + 26, true);
      const lExtraLen = dv.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const slice = bytes.subarray(dataStart, dataStart + compressedSize);

      let rawBytes;
      if (method === 0) {
        rawBytes = new Uint8Array(slice);
      } else if (method === 8) {
        rawBytes = toUint8Array(await inflate(slice));
      } else {
        continue;
      }
      entries.push({
        name: fileName,
        lowerName: fileName.toLowerCase(),
        bytes: rawBytes
      });
    }
    return entries;
  }

  async function parseAssetZip(input, meta, inflateRawFn) {
    const entries = await parseZipArchive(input, inflateRawFn);
    if (entries.length === 1 && entries[0].lowerName.endsWith('.zip')) {
      return parseAssetZip(entries[0].bytes, meta, inflateRawFn);
    }
    const tpseEntry = entries.find((e) => e.lowerName.endsWith('.tpse'));
    if (tpseEntry) {
      const jsonText = decodeUtf8(tpseEntry.bytes);
      return parseTpseObject(JSON.parse(jsonText), meta);
    }
    return parseStructuredFileEntries(entries, meta);
  }

  function parseStructuredFileEntries(entries, meta) {
    const sfxFiles = {};
    const backgrounds = [];
    let skin = null;
    let skinDims = null;
    let ghost = null;
    let ghostDims = null;
    let board = null;
    let queue = null;
    let grid = null;

    for (const entry of entries) {
      const rawName = String((entry && (entry.lowerName || entry.name || entry.fileName)) || '').toLowerCase();
      const base = rawName.replace(/^.*\//, '');
      const bytes = toUint8Array(entry && entry.bytes);
      if (!base || bytes.length === 0) continue;

      if (SUPPORTED_AUDIO_EXT.test(base)) {
        const stem = base.replace(SUPPORTED_AUDIO_EXT, '');
        if (stem) {
          const aMime = detectMimeFromBytes(bytes, 'audio/ogg');
          sfxFiles[stem] = bytesToDataUrl(bytes, aMime.startsWith('audio/') ? aMime : 'audio/ogg');
        }
        continue;
      }
      if (SUPPORTED_VIDEO_EXT.test(base)) {
        backgrounds.push({
          id: 'dir-bg-' + backgrounds.length,
          filename: base,
          mediaType: 'video',
          dataUrl: bytesToDataUrl(bytes, base.endsWith('.webm') ? 'video/webm' : 'video/mp4')
        });
        continue;
      }
      if (!SUPPORTED_IMAGE_EXT.test(base)) continue;

      const mime = detectMimeFromBytes(bytes, 'image/png');
      const dataUrl = bytesToDataUrl(bytes, mime.startsWith('image/') ? mime : 'image/png');
      const dims = readImageDimensions(bytes, mime);
      if (base.includes('board') || (meta && meta.category === 'board' && !base.includes('queue') && !base.includes('grid') && !base.includes('skin') && !base.includes('mino') && !base.includes('ghost'))) {
        board = dataUrl;
      } else if (base.includes('queue')) {
        queue = dataUrl;
      } else if (base.includes('grid')) {
        grid = dataUrl;
      } else if (
        (meta && meta.category === 'background') ||
        /(?:^|[^a-z])(bg|background|backdrop)(?:[^a-z]|$)/i.test(base)
      ) {
        backgrounds.push({
          id: 'dir-bg-' + backgrounds.length,
          filename: base,
          mediaType: 'image',
          dataUrl
        });
      } else if (base.includes('ghost')) {
        if (!ghost || base.includes('connected') || (dims && dims.width >= 512)) {
          ghost = dataUrl;
          ghostDims = dims;
        }
      } else if (
        base.includes('skin') ||
        base.includes('mino') ||
        base.includes('connected') ||
        base.includes('tetrio') ||
        base.includes('block') ||
        (!skin && entries.filter((x) => SUPPORTED_IMAGE_EXT.test(String(x.lowerName || x.name || x.fileName || '').toLowerCase())).length <= 3)
      ) {
        if (!skin || base.includes('connected') || base.includes('2x') || (dims && (!skinDims || dims.width > skinDims.width))) {
          skin = dataUrl;
          skinDims = dims;
        }
      }
    }

    const hasSfx = Object.keys(sfxFiles).length > 0;
    const capabilities = {
      skin: Boolean(skin),
      ghost: Boolean(ghost),
      board: Boolean(board),
      queue: Boolean(queue),
      grid: Boolean(grid),
      sfx: hasSfx,
      background: backgrounds.length > 0,
      animated: backgrounds.some((b) => b.mediaType === 'video' || /gif/i.test(b.filename))
    };

    let category = meta && meta.category ? meta.category : 'skin';
    if (capabilities.skin || capabilities.ghost) category = 'skin';
    else if (capabilities.board || capabilities.queue || capabilities.grid) category = 'board';
    else if (capabilities.sfx) category = 'sfx';
    else if (capabilities.background) category = 'background';

    return {
      category,
      capabilities,
      skin,
      skinFormat: skin ? classifySkinFormat(skinDims, false, meta && meta.format) : null,
      skinAnim: null,
      skinAnimMeta: null,
      ghost,
      ghostFormat: ghost ? classifySkinFormat(ghostDims, true, meta && meta.format) : null,
      ghostAnim: null,
      ghostAnimMeta: null,
      board,
      queue,
      grid,
      sfxAtlasDataUrl: null,
      sfxAtlasMap: null,
      sfxFiles: hasSfx ? sfxFiles : null,
      backgrounds
    };
  }

  function parseDirectoryPack(filesInput, meta) {
    const list = Array.isArray(filesInput) ? filesInput : [];
    const normalized = list.map((f) => ({
      lowerName: String((f && (f.fileName || f.name || f.lowerName)) || '').toLowerCase(),
      bytes: f && f.bytes
    }));
    return parseStructuredFileEntries(normalized, meta);
  }

  function parseSingleMediaPayload(bytesInput, fileName, mimeHint, meta) {
    const bytes = toUint8Array(bytesInput);
    const mime = mimeHint && mimeHint !== 'application/octet-stream' ? mimeHint : detectMimeFromBytes(bytes, 'application/octet-stream');
    const lowerName = String(fileName || '').toLowerCase();
    const dataUrl = `data:${mime};base64,${bytesToBase64(bytes)}`;

    if (mime.startsWith('video/') || SUPPORTED_VIDEO_EXT.test(lowerName) || meta && meta.category === 'background') {
      const isVid = mime.startsWith('video/') || SUPPORTED_VIDEO_EXT.test(lowerName);
      return {
        category: 'background',
        capabilities: {
          skin: false,
          ghost: false,
          board: false,
          queue: false,
          grid: false,
          sfx: false,
          background: true,
          animated: isVid || mime === 'image/gif' || /\.gif$/i.test(lowerName)
        },
        skin: null,
        skinFormat: null,
        skinAnim: null,
        skinAnimMeta: null,
        ghost: null,
        ghostFormat: null,
        ghostAnim: null,
        ghostAnimMeta: null,
        board: null,
        queue: null,
        grid: null,
        sfxAtlasDataUrl: null,
        sfxAtlasMap: null,
        sfxFiles: null,
        backgrounds: [
          {
            id: 'file-bg',
            filename: fileName || (isVid ? 'background.mp4' : 'background.png'),
            mediaType: isVid ? 'video' : 'image',
            dataUrl
          }
        ]
      };
    }

    const dims = readImageDimensions(bytes, mime);
    const hasStripGhost = Boolean(dims && dims.width >= dims.height * 6 && !/ghost/.test(lowerName));
    if (lowerName.includes('board') || (meta && meta.category === 'board' && !lowerName.includes('queue') && !lowerName.includes('grid'))) {
      return {
        category: 'board',
        capabilities: { skin: false, ghost: false, board: true, queue: false, grid: false, sfx: false, background: false, animated: false },
        skin: null, skinFormat: null, skinAnim: null, skinAnimMeta: null,
        ghost: null, ghostFormat: null, ghostAnim: null, ghostAnimMeta: null,
        board: dataUrl, queue: null, grid: null, sfxAtlasDataUrl: null, sfxAtlasMap: null, sfxFiles: null, backgrounds: []
      };
    }
    if (lowerName.includes('queue')) {
      return {
        category: 'board',
        capabilities: { skin: false, ghost: false, board: false, queue: true, grid: false, sfx: false, background: false, animated: false },
        skin: null, skinFormat: null, skinAnim: null, skinAnimMeta: null,
        ghost: null, ghostFormat: null, ghostAnim: null, ghostAnimMeta: null,
        board: null, queue: dataUrl, grid: null, sfxAtlasDataUrl: null, sfxAtlasMap: null, sfxFiles: null, backgrounds: []
      };
    }
    if (lowerName.includes('grid')) {
      return {
        category: 'board',
        capabilities: { skin: false, ghost: false, board: false, queue: false, grid: true, sfx: false, background: false, animated: false },
        skin: null, skinFormat: null, skinAnim: null, skinAnimMeta: null,
        ghost: null, ghostFormat: null, ghostAnim: null, ghostAnimMeta: null,
        board: null, queue: null, grid: dataUrl, sfxAtlasDataUrl: null, sfxAtlasMap: null, sfxFiles: null, backgrounds: []
      };
    }
    if (lowerName.includes('ghost')) {
      return {
        category: 'skin',
        capabilities: { skin: false, ghost: true, board: false, queue: false, grid: false, sfx: false, background: false, animated: false },
        skin: null, skinFormat: null, skinAnim: null, skinAnimMeta: null,
        ghost: dataUrl, ghostFormat: classifySkinFormat(dims, true, meta && meta.format), ghostAnim: null, ghostAnimMeta: null,
        board: null, queue: null, grid: null, sfxAtlasDataUrl: null, sfxAtlasMap: null, sfxFiles: null, backgrounds: []
      };
    }

    return {
      category: 'skin',
      capabilities: {
        skin: true, ghost: hasStripGhost, board: false, queue: false, grid: false, sfx: false, background: false,
        animated: mime === 'image/gif' || /\.gif$/i.test(lowerName)
      },
      skin: dataUrl,
      skinFormat: classifySkinFormat(dims, false, meta && meta.format),
      skinAnim: null,
      skinAnimMeta: null,
      ghost: null,
      ghostFormat: hasStripGhost ? 'simple' : null,
      ghostAnim: null,
      ghostAnimMeta: null,
      board: null,
      queue: null,
      grid: null,
      sfxAtlasDataUrl: null,
      sfxAtlasMap: null,
      sfxFiles: null,
      backgrounds: []
    };
  }

  function parseTrsd(input) {
    const bytes = toUint8Array(input);
    if (bytes.length < 16) throw new Error('The RSD file is too short.');
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (readAscii(bytes, 0, 4) !== 'tRSD') {
      throw new Error('The RSD file is not valid. (Header Bytes)');
    }
    const major = dv.getUint32(4, true);
    const minor = dv.getUint32(8, true);
    if (major !== 1 || minor !== 0) {
      throw new Error(`The RSD file version (${major}.${minor}) is not recognized.`);
    }

    let offset = 12;
    const rawMarks = [];
    for (;;) {
      if (offset + 8 > bytes.length) throw new Error('Unexpected end of RSD table.');
      const timeSec = dv.getFloat32(offset, true);
      offset += 4;
      const nameLen = dv.getUint32(offset, true);
      offset += 4;
      if (offset + nameLen > bytes.length) throw new Error('Unexpected end of RSD name.');
      const name = readAscii(bytes, offset, nameLen);
      offset += nameLen;
      rawMarks.push({ timeSec, name, nameLen });
      if (nameLen === 0) break;
    }

    if (offset + 4 > bytes.length) throw new Error('Missing RSD audio length.');
    const audioLength = dv.getUint32(offset, true);
    offset += 4;
    if (offset + audioLength > bytes.length) throw new Error('Truncated RSD audio payload.');

    const entries = [];
    for (let i = 0; i < rawMarks.length - 1; i++) {
      const cur = rawMarks[i];
      const next = rawMarks[i + 1];
      entries.push({
        name: cur.name,
        offsetSec: cur.timeSec,
        durationSec: Math.max(0, next.timeSec - cur.timeSec)
      });
    }
    const endOffsetSec = rawMarks.length > 0 ? rawMarks[rawMarks.length - 1].timeSec : 0;

    return {
      major,
      minor,
      entries,
      endOffsetSec,
      audioBytes: bytes.subarray(offset, offset + audioLength)
    };
  }

  function buildTrsd(entries, endOffsetSec, audioBytesInput) {
    const audioBytes = toUint8Array(audioBytesInput);
    const list = Array.isArray(entries) ? entries : [];

    let tableSize = 12;
    const encodedEntries = [];
    for (const entry of list) {
      const cleanName = String(entry && entry.name || '').replace(/[^\x20-\x7e]/g, '');
      if (!cleanName) continue;
      encodedEntries.push({
        name: cleanName,
        offsetSec: Number(entry.offsetSec) || 0
      });
      tableSize += 8 + cleanName.length;
    }
    // Terminator sentinel + audioLength uint32
    tableSize += 8 + 4;

    const out = new Uint8Array(tableSize + audioBytes.length);
    const dv = new DataView(out.buffer);
    out[0] = 0x74; // 't'
    out[1] = 0x52; // 'R'
    out[2] = 0x53; // 'S'
    out[3] = 0x44; // 'D'
    dv.setUint32(4, 1, true);
    dv.setUint32(8, 0, true);

    let offset = 12;
    for (const item of encodedEntries) {
      dv.setFloat32(offset, item.offsetSec, true);
      offset += 4;
      dv.setUint32(offset, item.name.length, true);
      offset += 4;
      for (let i = 0; i < item.name.length; i++) {
        out[offset + i] = item.name.charCodeAt(i) & 0x7f;
      }
      offset += item.name.length;
    }

    dv.setFloat32(offset, Number(endOffsetSec) || 0, true);
    offset += 4;
    dv.setUint32(offset, 0, true);
    offset += 4;
    dv.setUint32(offset, audioBytes.length, true);
    offset += 4;
    out.set(audioBytes, offset);
    return out;
  }

  function encodeWavPcm16(channels, sampleRate) {
    const chList = Array.isArray(channels) ? channels.filter(Boolean) : [];
    const numChannels = Math.max(1, chList.length);
    const sr = Math.max(8000, Math.round(Number(sampleRate) || 44100));
    const frameCount = chList.reduce((max, c) => Math.max(max, c.length || 0), 0);
    const dataSize = frameCount * numChannels * 2;
    const out = new Uint8Array(44 + dataSize);
    const dv = new DataView(out.buffer);

    const writeTag = (pos, tag) => {
      for (let i = 0; i < 4; i++) out[pos + i] = tag.charCodeAt(i);
    };

    writeTag(0, 'RIFF');
    dv.setUint32(4, 36 + dataSize, true);
    writeTag(8, 'WAVE');
    writeTag(12, 'fmt ');
    dv.setUint32(16, 16, true); // PCM subchunk size
    dv.setUint16(20, 1, true); // PCM format
    dv.setUint16(22, numChannels, true);
    dv.setUint32(24, sr, true);
    dv.setUint32(28, sr * numChannels * 2, true);
    dv.setUint16(32, numChannels * 2, true);
    dv.setUint16(34, 16, true);
    writeTag(36, 'data');
    dv.setUint32(40, dataSize, true);

    let cursor = 44;
    for (let f = 0; f < frameCount; f++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const arr = chList[ch] || chList[0];
        const raw = arr && f < arr.length ? arr[f] : 0;
        const clamped = raw < -1 ? -1 : raw > 1 ? 1 : raw;
        const sample = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
        dv.setInt16(cursor, sample, true);
        cursor += 2;
      }
    }
    return out;
  }

  function mapCategoryToSubfolder(category, capabilities) {
    const caps = capabilities || {};
    if (caps.skin || caps.ghost || category === 'skin' || category === 'skins') return 'skins';
    if (caps.board || caps.queue || caps.grid || category === 'board' || category === 'boards') return 'boards';
    if (caps.sfx || category === 'sfx') return 'sfx';
    if (caps.background || category === 'background' || category === 'backgrounds') return 'backgrounds';
    return 'skins';
  }

  function sanitizeDiskStem(raw) {
    const clean = String(raw || 'asset').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim();
    return (clean && clean !== '.' && clean !== '..' ? clean : 'asset').slice(0, 80);
  }

  function serializeRecordForDisk(record) {
    if (!record || !record.payload) return null;
    const p = record.payload;
    const caps = p.capabilities || {};
    const subfolder = mapCategoryToSubfolder(record.category, caps);
    const stem = sanitizeDiskStem(record.name || record.id);

    // Pure single-background media exports directly as PNG/GIF/MP4/WEBM so it's easy to preview & swap
    if (
      subfolder === 'backgrounds' &&
      !caps.skin &&
      !caps.board &&
      !caps.sfx &&
      Array.isArray(p.backgrounds) &&
      p.backgrounds.length === 1 &&
      p.backgrounds[0] &&
      p.backgrounds[0].dataUrl
    ) {
      const bg = p.backgrounds[0];
      const extMatch = String(bg.filename || '').match(/\.(png|jpe?g|gif|webp|svg|mp4|webm|mov|m4v)$/i);
      const mimeExt = bg.mediaType === 'video' ? (/webm/i.test(bg.dataUrl) ? '.webm' : '.mp4') : (/gif/i.test(bg.dataUrl) ? '.gif' : '.png');
      const ext = extMatch ? '.' + extMatch[1].toLowerCase() : mimeExt;
      return {
        subfolder,
        fileName: stem + ext,
        bytes: dataUrlToBytes(bg.dataUrl)
      };
    }

    const tpseObj = { version: 1, name: record.name || stem, author: record.author || 'FOXMOD' };
    for (const k of ['skin', 'skinAnim', 'skinAnimMeta', 'ghost', 'ghostAnim', 'ghostAnimMeta', 'board', 'queue', 'grid']) {
      if (p[k]) tpseObj[k] = p[k];
    }
    if (p.sfxAtlasDataUrl) tpseObj.customSounds = p.sfxAtlasDataUrl;
    if (p.sfxAtlasMap) tpseObj.customSoundAtlas = p.sfxAtlasMap;
    if (p.sfxFiles) tpseObj.sfxFiles = p.sfxFiles;
    if (Array.isArray(p.backgrounds) && p.backgrounds.length > 0) {
      tpseObj.backgrounds = p.backgrounds.map((bg) => ({
        id: bg.id,
        filename: bg.filename,
        type: bg.mediaType,
        data: bg.dataUrl
      }));
    }
    const json = JSON.stringify(tpseObj);
    const bytes = typeof Buffer === 'function' ? Buffer.from(json, 'utf8') : new TextEncoder().encode(json);
    return {
      subfolder,
      fileName: stem + '.tpse',
      bytes: toUint8Array(bytes)
    };
  }

  const api = {
    TETRIOPLUS_BASE_URL,
    TETRIOPLUS_CATALOG_URL,
    TETRIOPLUS_VOTES_URL,
    BUILTIN_BG_PRESETS,
    TETRIO_SIMPLE_COORDS,
    TETRIO_CONNECTED_COORDS,
    STRIP12_MINO_SLOTS,
    STRIP12_GHOST_SLOTS,
    encodeCatalogPath,
    bytesToBase64,
    base64ToBytes,
    detectMimeFromBytes,
    normalizeDataUrl,
    bytesToDataUrl,
    dataUrlToBytes,
    parseSvgDimensions,
    readPngDimensions,
    readImageDimensions,
    readPngDimensionsFromDataUrl,
    detectSkinSourceLayout,
    classifySkinFormat,
    classifyCatalogCategory,
    buildDownloadCandidates,
    normalizeCatalogItem,
    getStaticCatalogPreviewUrl,
    filterAndSortCatalog,
    matchesInstalledCategory,
    filterInstalledAssets,
    normalizeSfxAtlasEntries,
    parseTpseObject,
    parseZipArchive,
    parseAssetZip,
    parseDirectoryPack,
    parseSingleMediaPayload,
    mapCategoryToSubfolder,
    serializeRecordForDisk,
    parseTrsd,
    buildTrsd,
    encodeWavPcm16
  };

  root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
  root.__TWFOX_INTERNAL__.customAssetsLogic = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : window));
