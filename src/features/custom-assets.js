(function (root) {
  'use strict';

  const logic =
    (root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.customAssetsLogic) ||
    (typeof require === 'function' ? require('./custom-assets-logic.js') : null);

  if (!logic) return;

  const DB_NAME = 'twfoxtetrio_assets_v1';
  const DB_VERSION = 1;
  const STORE_ASSETS = 'assets';
  const META_STORAGE_KEY = 'twfoxtetrio_assets_meta_v1';
  const STYLE_ID = 'twfoxtetrio-custom-bg-style';
  const BG_LAYER_ID = 'twfoxtetrio-custom-bg';
  const TRANSPARENT_1PX_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  const memoryAssetStore = new Map();
  const catalogCache = { items: null, votes: null, fetchedAt: 0, promise: null };
  const previewMemoryCache = new Map();
  const previewInFlight = new Map();
  const previewQueue = [];
  let previewWorkersActive = 0;
  let previewEpoch = 0;
  const activePayloads = {
    skin: null,
    board: null,
    sfx: null,
    background: null
  };
  const trackedImages = new Map(); // img -> logicalPath
  const listeners = new Set();

  let dbInstance = null;
  let dbPromise = null;
  let readyResolved = false;
  let needsReload = false;
  let tetrioSkinsLoadedOnBoot = false;
  let tetrioSfxLoadedOnBoot = false;
  let lastError = '';
  let hooksInstalled = false;
  let nativeImgSrcDesc = null;
  let nativeFetch = null;
  let bgRafId = null;
  let bgCurrentSignature = '';
  let assetsFolderPath = '';
  let folderSyncing = false;
  let folderSyncPromise = null;

  const DEFAULT_META = {
    activeSkinId: null,
    activeSkinFormat: null,
    activeGhostFormat: null,
    activeBoardId: null,
    activeSfxId: null,
    bgMode: 'none', // 'none' | 'preset' | 'asset' | 'url'
    bgPresetId: 'none',
    bgAssetId: null,
    bgIndex: 0,
    bgUrl: '',
    bgMediaType: 'image',
    bgOpacity: 0.72,
    bgBlur: 0
  };

  let activeMeta = loadMeta();

  function loadMeta() {
    const base = { ...DEFAULT_META };
    try {
      const raw = root.localStorage ? root.localStorage.getItem(META_STORAGE_KEY) : null;
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.assign(base, parsed);
      }
    } catch (_) {}
    base.bgOpacity = clamp(Number(base.bgOpacity), 0.05, 1, DEFAULT_META.bgOpacity);
    base.bgBlur = clamp(Number(base.bgBlur), 0, 20, DEFAULT_META.bgBlur);
    base.bgIndex = Math.max(0, Math.floor(Number(base.bgIndex) || 0));
    return base;
  }

  function saveMeta() {
    try {
      if (root.localStorage) {
        root.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(activeMeta));
      }
    } catch (_) {}
  }

  function clamp(val, min, max, fallback) {
    if (!Number.isFinite(val)) return fallback;
    return Math.min(max, Math.max(min, val));
  }

  function emitChange() {
    const snap = getStateSnapshot();
    for (const fn of listeners) {
      try {
        fn(snap);
      } catch (_) {}
    }
  }

  function summarizeRecord(record) {
    if (!record) return null;
    const p = record.payload || {};
    return {
      id: record.id,
      name: record.name,
      author: record.author || 'Local / Custom',
      description: record.description || '',
      category: record.category || p.category || 'skin',
      sourceKind: record.sourceKind || 'tetrioplus',
      downloadedAt: Number(record.downloadedAt) || 0,
      bytesEstimate: Number(record.bytesEstimate) || 0,
      capabilities: p.capabilities ? { ...p.capabilities } : {},
      skinFormat: p.skinFormat || null,
      ghostFormat: p.ghostFormat || null,
      backgroundCount: Array.isArray(p.backgrounds) ? p.backgrounds.length : 0,
      previewSkin:
        (p.variants && p.variants.previewStrip) ||
        p.skin ||
        p.board ||
        p.queue ||
        (p.backgrounds && p.backgrounds[0] && p.backgrounds[0].mediaType === 'image' ? p.backgrounds[0].dataUrl : null)
    };
  }

  function estimatePayloadBytes(payload) {
    if (!payload) return 0;
    let total = 0;
    for (const k of ['skin', 'skinAnim', 'ghost', 'ghostAnim', 'board', 'queue', 'grid', 'sfxAtlasDataUrl']) {
      if (typeof payload[k] === 'string') total += payload[k].length;
    }
    if (payload.sfxFiles && typeof payload.sfxFiles === 'object') {
      for (const v of Object.values(payload.sfxFiles)) {
        if (typeof v === 'string') total += v.length;
      }
    }
    if (Array.isArray(payload.backgrounds)) {
      for (const bg of payload.backgrounds) {
        if (bg && typeof bg.dataUrl === 'string') total += bg.dataUrl.length;
      }
    }
    return Math.round(total * 0.75);
  }

  function openDatabase() {
    if (dbInstance) return Promise.resolve(dbInstance);
    if (dbPromise) return dbPromise;
    if (!root.indexedDB || typeof root.indexedDB.open !== 'function') {
      return Promise.resolve(null);
    }
    dbPromise = new Promise((resolve) => {
      try {
        const req = root.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (ev) {
          const db = ev.target.result;
          if (!db.objectStoreNames.contains(STORE_ASSETS)) {
            db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
          }
        };
        req.onsuccess = function () {
          dbInstance = req.result;
          resolve(dbInstance);
        };
        req.onerror = function () {
          resolve(null);
        };
      } catch (_) {
        resolve(null);
      }
    });
    return dbPromise;
  }

  async function dbPutAsset(record) {
    memoryAssetStore.set(record.id, record);
    const db = await openDatabase();
    if (!db) return record;
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_ASSETS, 'readwrite');
        tx.objectStore(STORE_ASSETS).put(record);
        tx.oncomplete = () => resolve(record);
        tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
      } catch (err) {
        reject(err);
      }
    });
  }

  async function dbDeleteAsset(id) {
    memoryAssetStore.delete(id);
    const db = await openDatabase();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ASSETS, 'readwrite');
        tx.objectStore(STORE_ASSETS).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (_) {
        resolve();
      }
    });
  }

  async function dbGetAllAssets() {
    const db = await openDatabase();
    if (!db) {
      return Array.from(memoryAssetStore.values());
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ASSETS, 'readonly');
        const req = tx.objectStore(STORE_ASSETS).getAll();
        req.onsuccess = () => {
          const list = Array.isArray(req.result) ? req.result : [];
          memoryAssetStore.clear();
          for (const rec of list) {
            if (rec && rec.id) memoryAssetStore.set(rec.id, rec);
          }
          resolve(list);
        };
        req.onerror = () => resolve(Array.from(memoryAssetStore.values()));
      } catch (_) {
        resolve(Array.from(memoryAssetStore.values()));
      }
    });
  }

  function canCompileCanvas() {
    try {
      const doc = root.document;
      if (!doc || typeof doc.createElement !== 'function' || typeof root.Image !== 'function') return false;
      const c = doc.createElement('canvas');
      return Boolean(c && typeof c.getContext === 'function' && c.getContext('2d'));
    } catch (_) {
      return false;
    }
  }

  function loadImageForCompile(src, fallbackDims) {
    return new Promise((resolve) => {
      try {
        const img = new root.Image();
        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          if (!ok) return resolve(null);
          const w = Number(img.naturalWidth || img.width) || (fallbackDims && fallbackDims.width) || 0;
          const h = Number(img.naturalHeight || img.height) || (fallbackDims && fallbackDims.height) || 0;
          resolve(w > 0 && h > 0 ? { img, w, h } : null);
        };
        img.onload = () => finish(true);
        img.onerror = () => finish(false);
        if (nativeImgSrcDesc && nativeImgSrcDesc.set) {
          nativeImgSrcDesc.set.call(img, src);
        } else {
          img.src = src;
        }
        if (img.complete && (img.naturalWidth || (fallbackDims && fallbackDims.width))) {
          finish(true);
        }
      } catch (_) {
        resolve(null);
      }
    });
  }

  function safeToPngDataUrl(canvas, fallback) {
    try {
      return canvas.toDataURL('image/png');
    } catch (_) {
      return fallback || null;
    }
  }

  function makeCanvas(w, h) {
    const c = root.document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    return { canvas: c, ctx };
  }

  async function rasterizeSvgIfNeeded(loaded, src) {
    if (!loaded || !String(src || '').startsWith('data:image/svg+xml')) return loaded;
    const targetH = loaded.h < 96 ? 96 : loaded.h;
    const scale = targetH / Math.max(1, loaded.h);
    const targetW = Math.max(1, Math.round(loaded.w * scale));
    const { canvas, ctx } = makeCanvas(targetW, targetH);
    ctx.drawImage(loaded.img, 0, 0, targetW, targetH);
    return { img: canvas, w: targetW, h: targetH };
  }

  function resolveMinoSourceRect(srcW, srcH, layout, slot, isGhost) {
    if (layout === 'strip12' || layout === 'strip12_ghost') {
      const idx = isGhost
        ? logic.STRIP12_GHOST_SLOTS[slot]
        : (logic.STRIP12_MINO_SLOTS.find((x) => x[0] === slot) || [null, -1])[1];
      if (idx < 0) return null;
      const slotW = srcW / 12;
      const tileW = Math.min(srcH, slotW);
      return { x: idx * slotW, y: 0, w: tileW, h: srcH };
    }
    if (layout === 'connected_hd' || layout === 'connected_uhd') {
      const sRatio = srcW / (isGhost ? 512 : 1024);
      const sTile = 46 * sRatio;
      const sPad = 1 * sRatio;
      const sStride = 48 * sRatio;
      const base = isGhost
        ? (slot === 'x' ? [4, 0] : [0, 0])
        : logic.TETRIO_CONNECTED_COORDS[slot];
      if (!base) return null;
      return {
        x: sPad + (base[0] + 0) * sStride,
        y: sPad + (base[1] + 3) * sStride,
        w: sTile,
        h: sTile
      };
    }
    if (layout === 'simple_5x2_cropped') {
      const sStrideX = srcW / 5;
      const sStrideY = srcH / 2;
      const c = logic.TETRIO_SIMPLE_COORDS[slot];
      if (!c) return null;
      return { x: c[0] * sStrideX, y: c[1] * sStrideY, w: sStrideX, h: sStrideY };
    }
    if (layout === 'simple_rect' && isGhost) {
      const sTile = srcW / 2;
      return { x: (slot === 'x' ? 1 : 0) * sTile, y: 0, w: sTile, h: srcH };
    }
    const baseW = isGhost ? 128 : 256;
    const sRatio = Math.max(1, srcW / baseW);
    const sTile = 46 * sRatio;
    const sPad = 1 * sRatio;
    const sStride = 48 * sRatio;
    const coord = isGhost ? [slot === 'x' ? 1 : 0, 0] : logic.TETRIO_SIMPLE_COORDS[slot];
    if (!coord) return null;
    return {
      x: sPad + coord[0] * sStride,
      y: sPad + coord[1] * sStride,
      w: sTile,
      h: sTile
    };
  }

  function renderSimpleMinoAtlas(srcImg, srcW, srcH, layout, scale, origSrc) {
    const dim = 256 * scale;
    if (
      String(origSrc || '').startsWith('data:image/png') &&
      ((scale === 1 && layout === 'simple_hd' && srcW === 256 && srcH === 256) ||
       (scale === 2 && layout === 'simple_uhd' && srcW === 512 && srcH === 512))
    ) {
      return origSrc;
    }
    const { canvas, ctx } = makeCanvas(dim, dim);
    if (layout === 'simple_hd' || layout === 'simple_uhd') {
      ctx.drawImage(srcImg, 0, 0, dim, dim);
      return safeToPngDataUrl(canvas, origSrc);
    }
    if (layout === 'simple_5x2_cropped') {
      ctx.drawImage(srcImg, 0, 0, srcW, srcH, 0, 0, 240 * scale, 96 * scale);
      return safeToPngDataUrl(canvas, origSrc);
    }
    const tile = 46 * scale;
    const pad = 1 * scale;
    const stride = 48 * scale;
    for (const [slot, dstCoord] of Object.entries(logic.TETRIO_SIMPLE_COORDS)) {
      const r = resolveMinoSourceRect(srcW, srcH, layout, slot, false);
      if (!r) continue;
      const dx = pad + dstCoord[0] * stride;
      const dy = pad + dstCoord[1] * stride;
      ctx.drawImage(srcImg, r.x, r.y, r.w, r.h, dx, dy, tile, tile);
    }
    return safeToPngDataUrl(canvas, origSrc);
  }

  function renderConnectedMinoAtlas(srcImg, srcW, srcH, layout, scale, origSrc) {
    const dim = 1024 * scale;
    if (
      String(origSrc || '').startsWith('data:image/png') &&
      ((scale === 1 && layout === 'connected_hd' && srcW === 1024 && srcH === 1024) ||
       (scale === 2 && layout === 'connected_uhd' && srcW === 2048 && srcH === 2048))
    ) {
      return origSrc;
    }
    const { canvas, ctx } = makeCanvas(dim, dim);
    if (layout === 'connected_hd' || layout === 'connected_uhd') {
      ctx.drawImage(srcImg, 0, 0, dim, dim);
      return safeToPngDataUrl(canvas, origSrc);
    }
    const tile = 46 * scale;
    const pad = 1 * scale;
    const stride = 48 * scale;
    for (const [slot, base] of Object.entries(logic.TETRIO_CONNECTED_COORDS)) {
      const r = resolveMinoSourceRect(srcW, srcH, layout, slot, false);
      if (!r) continue;
      const maxRows = slot === 'gb' || slot === 'gbd' ? 4 : 6;
      for (let oy = 0; oy < maxRows; oy++) {
        for (let ox = 0; ox < 4; ox++) {
          const dx = pad + (base[0] + ox) * stride;
          const dy = pad + (base[1] + oy) * stride;
          ctx.drawImage(srcImg, r.x, r.y, r.w, r.h, dx, dy, tile, tile);
        }
      }
    }
    return safeToPngDataUrl(canvas, origSrc);
  }

  function renderGhostAtlas(srcImg, srcW, srcH, layout, isConnectedOut, scale, origSrc) {
    const dim = (isConnectedOut ? 512 : 128) * scale;
    if (
      String(origSrc || '').startsWith('data:image/png') &&
      ((isConnectedOut && scale === 1 && layout === 'connected_hd' && srcW === 512 && srcH === 512) ||
       (isConnectedOut && scale === 2 && layout === 'connected_uhd' && srcW === 1024 && srcH === 1024) ||
       (!isConnectedOut && scale === 1 && layout === 'simple_hd' && srcW === 128 && srcH === 128) ||
       (!isConnectedOut && scale === 2 && layout === 'simple_uhd' && srcW === 256 && srcH === 256))
    ) {
      return origSrc;
    }
    const { canvas, ctx } = makeCanvas(dim, dim);
    if (
      (isConnectedOut && (layout === 'connected_hd' || layout === 'connected_uhd')) ||
      (!isConnectedOut && (layout === 'simple_hd' || layout === 'simple_uhd'))
    ) {
      ctx.drawImage(srcImg, 0, 0, dim, dim);
      return safeToPngDataUrl(canvas, origSrc);
    }
    const tile = 46 * scale;
    const pad = 1 * scale;
    const stride = 48 * scale;
    for (const slot of ['g', 'x']) {
      const r = resolveMinoSourceRect(srcW, srcH, layout, slot, true);
      if (!r) continue;
      if (isConnectedOut) {
        const bx = slot === 'x' ? 4 : 0;
        for (let oy = 0; oy < 6; oy++) {
          for (let ox = 0; ox < 4; ox++) {
            ctx.drawImage(srcImg, r.x, r.y, r.w, r.h, pad + (bx + ox) * stride, pad + oy * stride, tile, tile);
          }
        }
      } else {
        const dx = pad + (slot === 'x' ? 1 : 0) * stride;
        ctx.drawImage(srcImg, r.x, r.y, r.w, r.h, dx, pad, tile, tile);
      }
    }
    return safeToPngDataUrl(canvas, origSrc);
  }

  async function rescaleSquareTexture(dataUrl, targetSize) {
    if (!dataUrl) return null;
    const dims = logic.readPngDimensionsFromDataUrl(dataUrl);
    if (dims && dims.width === targetSize && dims.height === targetSize && String(dataUrl).startsWith('data:image/png')) {
      return dataUrl;
    }
    const loaded = await loadImageForCompile(dataUrl, dims);
    if (!loaded) return dataUrl;
    if (loaded.w === targetSize && loaded.h === targetSize && String(dataUrl).startsWith('data:image/png')) {
      return dataUrl;
    }
    const { canvas, ctx } = makeCanvas(targetSize, targetSize);
    ctx.drawImage(loaded.img, 0, 0, targetSize, targetSize);
    return safeToPngDataUrl(canvas, dataUrl);
  }

  async function compilePayloadVariants(payload, meta) {
    if (!payload || !canCompileCanvas()) return payload;
    const variants = {};
    const formatHint = meta && meta.format ? meta.format : '';
    let skinStripLoaded = null;
    let skinStripLayout = '';

    if (payload.skin) {
      const rawDims = logic.readPngDimensionsFromDataUrl(payload.skin);
      const rawLoaded = await loadImageForCompile(payload.skin, rawDims);
      const loaded = await rasterizeSvgIfNeeded(rawLoaded, payload.skin);
      if (loaded) {
        const layout = logic.detectSkinSourceLayout(loaded.w, loaded.h, false, formatHint);
        payload.skinFormat = layout.startsWith('connected_') ? 'connected' : 'simple';
        variants.simpleHd = renderSimpleMinoAtlas(loaded.img, loaded.w, loaded.h, layout, 1, payload.skin);
        variants.simpleUhd = renderSimpleMinoAtlas(loaded.img, loaded.w, loaded.h, layout, 2, payload.skin);
        variants.connectedHd = renderConnectedMinoAtlas(loaded.img, loaded.w, loaded.h, layout, 1, payload.skin);
        variants.connectedUhd = renderConnectedMinoAtlas(loaded.img, loaded.w, loaded.h, layout, 2, payload.skin);
        if (layout === 'strip12') {
          skinStripLoaded = loaded;
          skinStripLayout = 'strip12';
        }
      }
    }

    if (payload.ghost) {
      const rawDims = logic.readPngDimensionsFromDataUrl(payload.ghost);
      const rawLoaded = await loadImageForCompile(payload.ghost, rawDims);
      const loaded = await rasterizeSvgIfNeeded(rawLoaded, payload.ghost);
      if (loaded) {
        const layout = logic.detectSkinSourceLayout(loaded.w, loaded.h, true, formatHint);
        payload.ghostFormat = layout.startsWith('connected_') ? 'connected' : 'simple';
        variants.ghostSimpleHd = renderGhostAtlas(loaded.img, loaded.w, loaded.h, layout, false, 1, payload.ghost);
        variants.ghostSimpleUhd = renderGhostAtlas(loaded.img, loaded.w, loaded.h, layout, false, 2, payload.ghost);
        variants.ghostConnectedHd = renderGhostAtlas(loaded.img, loaded.w, loaded.h, layout, true, 1, payload.ghost);
        variants.ghostConnectedUhd = renderGhostAtlas(loaded.img, loaded.w, loaded.h, layout, true, 2, payload.ghost);
      }
    } else if (skinStripLoaded && skinStripLayout === 'strip12') {
      variants.ghostSimpleHd = renderGhostAtlas(skinStripLoaded.img, skinStripLoaded.w, skinStripLoaded.h, 'strip12_ghost', false, 1, null);
      variants.ghostSimpleUhd = renderGhostAtlas(skinStripLoaded.img, skinStripLoaded.w, skinStripLoaded.h, 'strip12_ghost', false, 2, null);
      variants.ghostConnectedHd = renderGhostAtlas(skinStripLoaded.img, skinStripLoaded.w, skinStripLoaded.h, 'strip12_ghost', true, 1, null);
      variants.ghostConnectedUhd = renderGhostAtlas(skinStripLoaded.img, skinStripLoaded.w, skinStripLoaded.h, 'strip12_ghost', true, 2, null);
      payload.ghostFormat = 'simple';
    }

    if (payload.board) {
      variants.board512 = await rescaleSquareTexture(payload.board, 512);
    }
    if (payload.queue) {
      variants.queue512 = await rescaleSquareTexture(payload.queue, 512);
    }
    if (payload.grid) {
      variants.grid1024 = await rescaleSquareTexture(payload.grid, 1024);
    }

    const previewStrip = await buildPreviewStripFromPayload(payload, meta);
    if (previewStrip) {
      variants.previewStrip = previewStrip;
    }

    payload.variants = variants;
    return payload;
  }

  const PREVIEW_STRIP_SLOTS = ['z', 'l', 'o', 's', 'i', 'j', 't', 'ghost', 'd', 'gb', 'gbd'];

  async function buildPreviewStripFromPayload(payload, meta) {
    if (!payload || !canCompileCanvas()) return null;
    const formatHint = meta && meta.format ? meta.format : '';

    if (payload.skin) {
      const rawDims = logic.readPngDimensionsFromDataUrl(payload.skin);
      const rawLoaded = await loadImageForCompile(payload.skin, rawDims);
      const skinLoaded = await rasterizeSvgIfNeeded(rawLoaded, payload.skin);
      if (!skinLoaded) return null;
      const skinLayout = logic.detectSkinSourceLayout(skinLoaded.w, skinLoaded.h, false, formatHint);

      let ghostLoaded = null;
      let ghostLayout = '';
      if (payload.ghost) {
        const gDims = logic.readPngDimensionsFromDataUrl(payload.ghost);
        const gRaw = await loadImageForCompile(payload.ghost, gDims);
        ghostLoaded = await rasterizeSvgIfNeeded(gRaw, payload.ghost);
        if (ghostLoaded) {
          ghostLayout = logic.detectSkinSourceLayout(ghostLoaded.w, ghostLoaded.h, true, formatHint);
        }
      } else if (skinLayout === 'strip12') {
        ghostLoaded = skinLoaded;
        ghostLayout = 'strip12_ghost';
      }

      const cellSize = 26;
      const step = 28;
      const { canvas, ctx } = makeCanvas(PREVIEW_STRIP_SLOTS.length * step, cellSize + 2);
      for (let i = 0; i < PREVIEW_STRIP_SLOTS.length; i++) {
        const slot = PREVIEW_STRIP_SLOTS[i];
        let srcLoaded = skinLoaded;
        let layout = skinLayout;
        let rect = null;
        if (slot === 'ghost') {
          if (!ghostLoaded) continue;
          srcLoaded = ghostLoaded;
          layout = ghostLayout;
          rect = resolveMinoSourceRect(srcLoaded.w, srcLoaded.h, layout, 'g', true);
        } else {
          rect = resolveMinoSourceRect(srcLoaded.w, srcLoaded.h, layout, slot, false);
        }
        if (!rect || rect.w <= 0 || rect.h <= 0) continue;
        ctx.drawImage(srcLoaded.img, rect.x, rect.y, rect.w, rect.h, 1 + i * step, 1, cellSize, cellSize);
      }
      return safeToPngDataUrl(canvas, null);
    }

    if (payload.ghost) {
      const gDims = logic.readPngDimensionsFromDataUrl(payload.ghost);
      const gRaw = await loadImageForCompile(payload.ghost, gDims);
      const ghostLoaded = await rasterizeSvgIfNeeded(gRaw, payload.ghost);
      if (!ghostLoaded) return null;
      const ghostLayout = logic.detectSkinSourceLayout(ghostLoaded.w, ghostLoaded.h, true, formatHint);
      const { canvas, ctx } = makeCanvas(58, 28);
      ['g', 'x'].forEach((slot, idx) => {
        const r = resolveMinoSourceRect(ghostLoaded.w, ghostLoaded.h, ghostLayout, slot, true);
        if (r) ctx.drawImage(ghostLoaded.img, r.x, r.y, r.w, r.h, 1 + idx * 28, 1, 26, 26);
      });
      return safeToPngDataUrl(canvas, null);
    }

    if (payload.board || payload.queue) {
      const src = payload.board || payload.queue;
      const loaded = await loadImageForCompile(src, logic.readPngDimensionsFromDataUrl(src));
      if (!loaded) return null;
      const { canvas, ctx } = makeCanvas(56, 56);
      ctx.drawImage(loaded.img, 0, 0, 56, 56);
      return safeToPngDataUrl(canvas, null);
    }
    return null;
  }

  function cachePreviewUrl(id, url) {
    if (previewMemoryCache.size >= 250) {
      const oldest = previewMemoryCache.keys().next().value;
      if (oldest !== undefined) previewMemoryCache.delete(oldest);
    }
    previewMemoryCache.set(String(id), url || '');
  }

  function getCatalogItemPreviewUrl(item) {
    if (!item || !item.id) return null;
    const downloaded = memoryAssetStore.get(String(item.id));
    if (downloaded && downloaded.payload) {
      const s = summarizeRecord(downloaded);
      if (s && s.previewSkin) return s.previewSkin;
    }
    if (previewMemoryCache.has(String(item.id))) {
      return previewMemoryCache.get(String(item.id)) || null;
    }
    return logic.getStaticCatalogPreviewUrl(item);
  }

  function pumpPreviewQueue() {
    while (previewWorkersActive < 2 && previewQueue.length > 0) {
      const job = previewQueue.shift();
      if (!job) break;
      if (job.epoch !== previewEpoch) {
        job.resolve(null);
        continue;
      }
      previewWorkersActive += 1;
      (async () => {
        try {
          const item = job.item;
          const tpseUrls = [];
          if (item.tpsePath) {
            tpseUrls.push(logic.TETRIOPLUS_BASE_URL + logic.encodeCatalogPath(item.tpsePath));
            if (!item.tpsePath.endsWith('.tpse')) {
              tpseUrls.push(logic.TETRIOPLUS_BASE_URL + logic.encodeCatalogPath(item.tpsePath + '.tpse'));
            }
          } else if (item.path && !/\.zip$/i.test(item.path)) {
            tpseUrls.push(logic.TETRIOPLUS_BASE_URL + logic.encodeCatalogPath(item.path));
          }
          let resultUrl = null;
          for (const url of tpseUrls) {
            if (job.epoch !== previewEpoch) break;
            try {
              const { bytes, contentType } = await fetchRemoteBytes(url);
              const payload = await parseDownloadedBytes(bytes, url.split('/').pop(), contentType, item);
              resultUrl = await buildPreviewStripFromPayload(payload, item);
              if (resultUrl) break;
            } catch (_) {}
          }
          if (resultUrl) {
            cachePreviewUrl(item.id, resultUrl);
          } else if (job.epoch === previewEpoch) {
            cachePreviewUrl(item.id, '');
          }
          job.resolve(resultUrl || null);
        } catch (_) {
          job.resolve(null);
        } finally {
          previewInFlight.delete(String(job.item.id));
          previewWorkersActive -= 1;
          pumpPreviewQueue();
        }
      })();
    }
  }

  function requestCatalogItemPreview(item) {
    if (!item || !item.id) return Promise.resolve(null);
    const id = String(item.id);
    const immediate = getCatalogItemPreviewUrl(item);
    if (immediate) return Promise.resolve(immediate);
    if (previewMemoryCache.has(id)) return Promise.resolve(previewMemoryCache.get(id) || null);
    if (item.category === 'sfx' || item.category === 'background') return Promise.resolve(null);
    if (!canCompileCanvas()) return Promise.resolve(null);
    if (!item.tpsePath && (!item.path || /\.zip$/i.test(item.path))) return Promise.resolve(null);

    if (previewInFlight.has(id)) {
      return previewInFlight.get(id);
    }
    const epochAtQueue = previewEpoch;
    const promise = new Promise((resolve) => {
      previewQueue.push({ item, epoch: epochAtQueue, resolve });
      pumpPreviewQueue();
    });
    previewInFlight.set(id, promise);
    return promise;
  }

  function resetPreviewQueue() {
    previewEpoch += 1;
    while (previewQueue.length > 0) {
      const dropped = previewQueue.shift();
      if (dropped) {
        previewInFlight.delete(String(dropped.item.id));
        dropped.resolve(null);
      }
    }
  }

  async function hydrateActivePayloads() {
    try {
      await dbGetAllAssets();
      activePayloads.skin = activeMeta.activeSkinId ? memoryAssetStore.get(activeMeta.activeSkinId) || null : null;
      activePayloads.board = activeMeta.activeBoardId ? memoryAssetStore.get(activeMeta.activeBoardId) || null : null;
      activePayloads.sfx = activeMeta.activeSfxId ? memoryAssetStore.get(activeMeta.activeSfxId) || null : null;
      activePayloads.background = activeMeta.bgAssetId ? memoryAssetStore.get(activeMeta.bgAssetId) || null : null;

      // Upgrade any legacy active records missing compiled resolution variants
      for (const slotRec of [activePayloads.skin, activePayloads.board]) {
        if (slotRec && slotRec.payload && !slotRec.payload.variants && (slotRec.payload.skin || slotRec.payload.ghost || slotRec.payload.board || slotRec.payload.queue)) {
          await compilePayloadVariants(slotRec.payload, slotRec);
          await dbPutAsset(slotRec);
        }
      }
      if (activePayloads.skin && activePayloads.skin.payload) {
        activeMeta.activeSkinFormat = activePayloads.skin.payload.skinFormat || 'simple';
        activeMeta.activeGhostFormat = activePayloads.skin.payload.ghostFormat || activeMeta.activeSkinFormat;
      }

      if (activeMeta.activeSkinId && !activePayloads.skin) {
        activeMeta.activeSkinId = null;
        activeMeta.activeSkinFormat = null;
        activeMeta.activeGhostFormat = null;
      }
      if (activeMeta.activeBoardId && !activePayloads.board) {
        activeMeta.activeBoardId = null;
      }
      if (activeMeta.activeSfxId && !activePayloads.sfx) {
        activeMeta.activeSfxId = null;
      }
      if (activeMeta.bgMode === 'asset' && activeMeta.bgAssetId && !activePayloads.background) {
        activeMeta.bgMode = 'none';
        activeMeta.bgAssetId = null;
      }
      saveMeta();
    } finally {
      readyResolved = true;
      applyConnectedHookIfNeeded();
      refreshCustomBackgroundDom();
      notifyCanvasSpriteReload();
      emitChange();
      if (root.IPC && typeof root.IPC.invoke === 'function') {
        Promise.resolve()
          .then(() => syncAssetsFolder({ exportMissing: true }))
          .catch(() => {});
      }
    }
  }

  const readyPromise = hydrateActivePayloads();

  async function fetchRemoteBytes(url) {
    if (root.IPC && typeof root.IPC.invoke === 'function') {
      try {
        const res = await root.IPC.invoke('twfoxtetrio-fetch', url);
        if (res && typeof res.status === 'number') {
          if (!res.ok) {
            const err = new Error(`HTTP ${res.status} fetching ${url}`);
            err.status = res.status;
            throw err;
          }
          return {
            bytes: logic.base64ToBytes(res.base64 || ''),
            contentType: String(res.contentType || 'application/octet-stream')
          };
        }
      } catch (ipcErr) {
        if (ipcErr && typeof ipcErr.status === 'number') throw ipcErr;
      }
    }

    const fetcher = nativeFetch || root.fetch;
    if (typeof fetcher !== 'function') {
      throw new Error('No fetch implementation available');
    }
    const resp = await fetcher(url);
    if (!resp.ok) {
      const err = new Error(`HTTP ${resp.status} fetching ${url}`);
      err.status = resp.status;
      throw err;
    }
    const contentType = resp.headers && typeof resp.headers.get === 'function'
      ? String(resp.headers.get('content-type') || 'application/octet-stream')
      : 'application/octet-stream';
    const buf = await resp.arrayBuffer();
    return {
      bytes: new Uint8Array(buf),
      contentType
    };
  }

  async function fetchRemoteJson(url) {
    const { bytes } = await fetchRemoteBytes(url);
    const text = typeof TextDecoder === 'function'
      ? new TextDecoder('utf-8').decode(bytes)
      : Buffer.from(bytes).toString('utf8');
    return JSON.parse(text);
  }

  async function fetchCatalog(forceRefresh) {
    const freshMs = 5 * 60 * 1000;
    if (!forceRefresh && Array.isArray(catalogCache.items) && Date.now() - catalogCache.fetchedAt < freshMs) {
      return catalogCache.items;
    }
    if (!forceRefresh && catalogCache.promise) {
      return catalogCache.promise;
    }

    catalogCache.promise = (async () => {
      try {
        const [rawCatalog, votesObj] = await Promise.all([
          fetchRemoteJson(logic.TETRIOPLUS_CATALOG_URL),
          fetchRemoteJson(logic.TETRIOPLUS_VOTES_URL).catch(() => ({}))
        ]);
        const list = Array.isArray(rawCatalog)
          ? rawCatalog.map((item) => logic.normalizeCatalogItem(item, votesObj)).filter(Boolean)
          : [];
        catalogCache.items = list;
        catalogCache.votes = votesObj;
        catalogCache.fetchedAt = Date.now();
        lastError = '';
        emitChange();
        return list;
      } catch (err) {
        lastError = err && err.message ? err.message : String(err);
        emitChange();
        throw err;
      } finally {
        catalogCache.promise = null;
      }
    })();

    return catalogCache.promise;
  }

  async function parseDownloadedBytes(bytes, sourceName, contentType, meta) {
    const mime = logic.detectMimeFromBytes(bytes, contentType);
    const lowerName = String(sourceName || '').toLowerCase();

    if (mime === 'application/json' || (mime !== 'application/zip' && lowerName.endsWith('.tpse'))) {
      const text = typeof TextDecoder === 'function'
        ? new TextDecoder('utf-8').decode(bytes)
        : Buffer.from(bytes).toString('utf8');
      return logic.parseTpseObject(JSON.parse(text), meta);
    }
    if (mime === 'application/zip' || lowerName.endsWith('.zip')) {
      return logic.parseAssetZip(bytes, meta);
    }
    return logic.parseSingleMediaPayload(bytes, sourceName, mime, meta);
  }

  async function downloadAndInstallCatalogItem(item, opts) {
    await readyPromise;
    const options = opts || {};
    const urls = Array.isArray(item && item.downloadUrls) && item.downloadUrls.length > 0
      ? item.downloadUrls
      : logic.buildDownloadCandidates(item);

    let lastErr = null;
    for (const url of urls) {
      try {
        const { bytes, contentType } = await fetchRemoteBytes(url);
        const payload = await parseDownloadedBytes(bytes, url.split('/').pop(), contentType, item);
        await compilePayloadVariants(payload, item);
        const record = {
          id: String(item.id),
          name: String(item.name || item.id),
          author: String(item.author || 'Unknown'),
          description: String(item.description || ''),
          category: payload.category || item.category || 'skin',
          sourceKind: 'tetrioplus',
          sourceUrl: url,
          downloadedAt: Date.now(),
          bytesEstimate: estimatePayloadBytes(payload),
          payload
        };
        await dbPutAsset(record);
        await persistRecordToDisk(record, {
          fileName: url.split('/').pop(),
          bytes
        });
        lastError = '';
        if (options.autoApply !== false) {
          await activateAsset(record.id);
        } else {
          emitChange();
        }
        return summarizeRecord(record);
      } catch (err) {
        lastErr = err;
      }
    }
    lastError = lastErr && lastErr.message ? lastErr.message : 'Download failed';
    emitChange();
    throw (lastErr || new Error('Failed to download asset'));
  }

  async function importLocalAsset(input) {
    await readyPromise;
    const fileName = String((input && input.name) || 'custom-asset');
    const bytes = input && input.bytes
      ? input.bytes instanceof Uint8Array
        ? input.bytes
        : new Uint8Array(input.bytes)
      : new Uint8Array(0);
    const payload = await parseDownloadedBytes(bytes, fileName, (input && input.type) || '', {
      category: input && input.category,
      format: input && input.format
    });
    await compilePayloadVariants(payload, { format: input && input.format });
    const cleanStem = fileName.replace(/\.[^.]+$/, '') || 'Custom Asset';
    const id = 'local-' + Date.now() + '-' + cleanStem.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32);
    const record = {
      id,
      name: (input && input.displayName) || cleanStem,
      author: 'Local File',
      description: `Imported from ${fileName}`,
      category: payload.category || 'skin',
      sourceKind: 'local',
      downloadedAt: Date.now(),
      bytesEstimate: estimatePayloadBytes(payload),
      payload
    };
    await dbPutAsset(record);
    await persistRecordToDisk(record, {
      fileName,
      bytes
    });
    lastError = '';
    if (!input || input.autoApply !== false) {
      await activateAsset(id);
    } else {
      emitChange();
    }
    return summarizeRecord(record);
  }

  function applyConnectedHookIfNeeded() {
    const wantsConnected = activeMeta.activeSkinFormat === 'connected' || activeMeta.activeGhostFormat === 'connected';
    if (wantsConnected && typeof root.DEVHOOK_CONNECTED_SKIN === 'function') {
      try {
        root.DEVHOOK_CONNECTED_SKIN();
      } catch (_) {}
    }
  }

  function notifyCanvasSpriteReload() {
    try {
      const fc = root.__TWFOX_INTERNAL__ && root.__TWFOX_INTERNAL__.foxmodCanvas;
      if (fc && typeof fc.reloadSprites === 'function') {
        fc.reloadSprites();
      }
    } catch (_) {}
  }

  function refreshTrackedTetrioImages() {
    for (const [img, rawPath] of trackedImages.entries()) {
      const override = resolveSkinOverrideUrl(rawPath);
      const nextSrc = override || rawPath;
      if (nativeImgSrcDesc && nativeImgSrcDesc.set) {
        try {
          nativeImgSrcDesc.set.call(img, nextSrc);
        } catch (_) {}
      }
    }
    try {
      const utils = root.PIXI && root.PIXI.utils;
      const cache = utils && utils.BaseTextureCache;
      if (cache) {
        for (const key of Object.keys(cache)) {
          const override = resolveSkinOverrideUrl(key);
          const bt = cache[key];
          if (!bt || !bt.resource) continue;
          const img = bt.resource.source;
          if (!img || img.tagName !== 'IMG') continue;
          const target = override || key;
          if (nativeImgSrcDesc && nativeImgSrcDesc.set) {
            const onLoadOnce = () => {
              try { bt.update(); } catch (_) {}
            };
            img.addEventListener('load', onLoadOnce, { once: true });
            nativeImgSrcDesc.set.call(img, target);
          }
        }
      }
    } catch (_) {}
  }

  async function activateAsset(id) {
    await readyPromise;
    const record = memoryAssetStore.get(String(id));
    if (!record || !record.payload) return null;
    const p = record.payload;
    if (!p.variants && (p.skin || p.ghost || p.board || p.queue || p.grid)) {
      await compilePayloadVariants(p, record);
      await dbPutAsset(record);
    }
    const caps = p.capabilities || {};

    if (caps.skin || caps.ghost) {
      activeMeta.activeSkinId = record.id;
      activeMeta.activeSkinFormat = p.skinFormat || 'simple';
      activeMeta.activeGhostFormat = p.ghostFormat || p.skinFormat || 'simple';
      activePayloads.skin = record;
      if (tetrioSkinsLoadedOnBoot) {
        needsReload = true;
      }
      applyConnectedHookIfNeeded();
    }

    if (caps.board || caps.queue || caps.grid) {
      activeMeta.activeBoardId = record.id;
      activePayloads.board = record;
      if (tetrioSkinsLoadedOnBoot) {
        needsReload = true;
      }
    }

    if (caps.sfx) {
      activeMeta.activeSfxId = record.id;
      activePayloads.sfx = record;
      if (tetrioSfxLoadedOnBoot) {
        needsReload = true;
      }
    }

    if (caps.background && Array.isArray(p.backgrounds) && p.backgrounds.length > 0) {
      activeMeta.bgMode = 'asset';
      activeMeta.bgAssetId = record.id;
      activeMeta.bgIndex = 0;
      activePayloads.background = record;
    }

    saveMeta();
    refreshTrackedTetrioImages();
    refreshCustomBackgroundDom();
    notifyCanvasSpriteReload();
    emitChange();
    return summarizeRecord(record);
  }

  async function deactivateSlot(slot) {
    await readyPromise;
    if (slot === 'skin') {
      if (tetrioSkinsLoadedOnBoot) {
        needsReload = true;
      }
      activeMeta.activeSkinId = null;
      activeMeta.activeSkinFormat = null;
      activeMeta.activeGhostFormat = null;
      activePayloads.skin = null;
      refreshTrackedTetrioImages();
      notifyCanvasSpriteReload();
    } else if (slot === 'board') {
      if (tetrioSkinsLoadedOnBoot) {
        needsReload = true;
      }
      activeMeta.activeBoardId = null;
      activePayloads.board = null;
      refreshTrackedTetrioImages();
      notifyCanvasSpriteReload();
    } else if (slot === 'sfx') {
      if (tetrioSfxLoadedOnBoot && activeMeta.activeSfxId) {
        needsReload = true;
      }
      activeMeta.activeSfxId = null;
      activePayloads.sfx = null;
    } else if (slot === 'background') {
      activeMeta.bgMode = 'none';
      activeMeta.bgPresetId = 'none';
      activeMeta.bgAssetId = null;
      activeMeta.bgUrl = '';
      activePayloads.background = null;
      refreshTrackedTetrioImages();
      refreshCustomBackgroundDom();
    }
    saveMeta();
    emitChange();
  }

  async function uninstallAsset(id, opts) {
    await readyPromise;
    const strId = String(id);
    const existing = memoryAssetStore.get(strId);
    if (activeMeta.activeSkinId === strId) await deactivateSlot('skin');
    if (activeMeta.activeBoardId === strId) await deactivateSlot('board');
    if (activeMeta.activeSfxId === strId) await deactivateSlot('sfx');
    if (activeMeta.bgAssetId === strId) await deactivateSlot('background');
    await dbDeleteAsset(strId);
    if (
      existing &&
      existing.diskRelPath &&
      !(opts && opts.skipDiskDelete) &&
      root.IPC &&
      typeof root.IPC.invoke === 'function'
    ) {
      try {
        await root.IPC.invoke('twfoxtetrio-assets-delete-file', { relPath: existing.diskRelPath });
      } catch (_) {}
    }
    emitChange();
  }

  function subfolderToCategoryHint(sub) {
    if (sub === 'boards') return 'board';
    if (sub === 'sfx') return 'sfx';
    if (sub === 'backgrounds') return 'background';
    return 'skin';
  }

  async function persistRecordToDisk(record, rawFile) {
    if (!root.IPC || typeof root.IPC.invoke !== 'function' || !record || !record.payload) return null;
    if (record.diskRelPath) return null;
    try {
      let uploadSpec = null;
      const rawName = rawFile && typeof rawFile.fileName === 'string' ? rawFile.fileName.trim() : '';
      const rawExtMatch = rawName.match(/\.(tpse|zip|png|jpe?g|gif|webp|svg|mp4|webm|mov|m4v|ogg|wav|mp3|flac|m4a|rsd)$/i);
      if (rawFile && rawFile.bytes && rawFile.bytes.length > 0 && rawExtMatch) {
        const subfolder = logic.mapCategoryToSubfolder(record.category, record.payload.capabilities);
        const cleanStem = String(record.name || rawName.replace(/\.[^.]+$/, '') || 'asset')
          .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
          .trim()
          .slice(0, 80);
        uploadSpec = {
          subfolder,
          fileName: (cleanStem || 'asset') + '.' + rawExtMatch[1].toLowerCase(),
          bytes: rawFile.bytes
        };
      } else if (typeof logic.serializeRecordForDisk === 'function') {
        uploadSpec = logic.serializeRecordForDisk(record);
      }
      if (!uploadSpec || !uploadSpec.bytes || uploadSpec.bytes.length === 0) return null;

      const res = await root.IPC.invoke('twfoxtetrio-assets-save-file', {
        subfolder: uploadSpec.subfolder,
        fileName: uploadSpec.fileName,
        base64: logic.bytesToBase64(uploadSpec.bytes)
      });
      if (res && res.ok && res.relPath) {
        record.diskRelPath = res.relPath;
        record.diskMtimeMs = res.mtimeMs || Date.now();
        if (res.rootPath) assetsFolderPath = res.rootPath;
        await dbPutAsset(record);
        return res;
      }
    } catch (_) {}
    return null;
  }

  async function buildRecordFromDiskItem(item, existing) {
    const categoryHint = subfolderToCategoryHint(item.subfolder);
    let payload = null;
    let displayName = '';

    if (item.kind === 'dir' && Array.isArray(item.files)) {
      const entries = item.files.map((f) => ({
        fileName: f.fileName,
        bytes: logic.base64ToBytes(f.base64 || '')
      }));
      payload = logic.parseDirectoryPack(entries, { category: categoryHint });
      displayName = String(item.dirName || 'Custom Pack');
    } else {
      const bytes = logic.base64ToBytes(item.base64 || '');
      payload = await parseDownloadedBytes(bytes, item.fileName, '', { category: categoryHint });
      displayName = String(item.fileName || 'Custom Asset').replace(/\.[^.]+$/, '') || 'Custom Asset';
    }

    await compilePayloadVariants(payload, {});
    const isFolderOrigin = !existing || existing.sourceKind === 'folder';
    return {
      id: (existing && existing.id) || ('folder:' + item.relPath),
      name: !isFolderOrigin && existing.name ? existing.name : displayName,
      author: !isFolderOrigin && existing.author ? existing.author : 'Custom Folder',
      description: (!isFolderOrigin && existing.description) || `Loaded from ${item.relPath}`,
      category: payload.category || categoryHint,
      sourceKind: existing ? existing.sourceKind : 'folder',
      sourceUrl: existing ? existing.sourceUrl : undefined,
      downloadedAt: (existing && existing.downloadedAt) || item.mtimeMs || Date.now(),
      bytesEstimate: estimatePayloadBytes(payload),
      diskRelPath: item.relPath,
      diskMtimeMs: item.mtimeMs || 0,
      payload
    };
  }

  async function syncAssetsFolder(opts) {
    await readyPromise;
    if (folderSyncPromise) return folderSyncPromise;
    if (!root.IPC || typeof root.IPC.invoke !== 'function') {
      return { ok: false, unsupported: true, path: assetsFolderPath, added: 0, updated: 0 };
    }

    folderSyncPromise = (async () => {
      folderSyncing = true;
      emitChange();
      let added = 0;
      let updated = 0;
      try {
        if (opts && opts.exportMissing) {
          const currentRecords = Array.from(memoryAssetStore.values());
          for (const rec of currentRecords) {
            if (!rec.diskRelPath) {
              await persistRecordToDisk(rec);
            }
          }
        }

        const scanRes = await root.IPC.invoke('twfoxtetrio-assets-scan-folder');
        if (!scanRes || !scanRes.ok) {
          return {
            ok: false,
            error: (scanRes && scanRes.error) || 'Failed to scan folder',
            path: (scanRes && scanRes.rootPath) || assetsFolderPath,
            added: 0,
            updated: 0
          };
        }
        if (scanRes.rootPath) assetsFolderPath = scanRes.rootPath;

        const byRel = new Map();
        for (const rec of memoryAssetStore.values()) {
          if (rec && rec.diskRelPath) byRel.set(rec.diskRelPath, rec);
        }

        const seenRel = new Set();
        const items = Array.isArray(scanRes.items) ? scanRes.items : [];
        for (const item of items) {
          if (!item || !item.relPath) continue;
          seenRel.add(item.relPath);
          const existing = byRel.get(item.relPath);
          if (existing && existing.diskMtimeMs === item.mtimeMs) {
            continue;
          }
          try {
            const nextRec = await buildRecordFromDiskItem(item, existing);
            await dbPutAsset(nextRec);
            if (existing) {
              updated += 1;
              if (activeMeta.activeSkinId === nextRec.id) activePayloads.skin = nextRec;
              if (activeMeta.activeBoardId === nextRec.id) activePayloads.board = nextRec;
              if (activeMeta.activeSfxId === nextRec.id) activePayloads.sfx = nextRec;
              if (activeMeta.bgMode === 'asset' && activeMeta.bgAssetId === nextRec.id) {
                activePayloads.background = nextRec;
              }
            } else {
              added += 1;
            }
          } catch (_) {}
        }

        const allRecords = Array.from(memoryAssetStore.values());
        for (const rec of allRecords) {
          if (rec && rec.sourceKind === 'folder' && rec.diskRelPath && !seenRel.has(rec.diskRelPath)) {
            await uninstallAsset(rec.id, { skipDiskDelete: true });
          }
        }

        if (updated > 0) {
          refreshTrackedTetrioImages();
          refreshCustomBackgroundDom();
          notifyCanvasSpriteReload();
        }
        return { ok: true, path: assetsFolderPath, added, updated };
      } catch (err) {
        return {
          ok: false,
          error: err && err.message ? err.message : String(err),
          path: assetsFolderPath,
          added,
          updated
        };
      } finally {
        folderSyncing = false;
        folderSyncPromise = null;
        emitChange();
      }
    })();

    return folderSyncPromise;
  }

  async function openAssetsFolder(subfolder) {
    await readyPromise;
    if (!root.IPC || typeof root.IPC.invoke !== 'function') {
      return { ok: false, unsupported: true, error: 'Desktop IPC unavailable' };
    }
    try {
      await syncAssetsFolder({ exportMissing: true });
    } catch (_) {}
    try {
      const res = await root.IPC.invoke('twfoxtetrio-assets-open-folder', {
        subfolder: subfolder || ''
      });
      if (res && (res.rootPath || res.path)) {
        assetsFolderPath = res.rootPath || res.path;
        emitChange();
      }
      return res || { ok: false, error: 'Failed to open folder' };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  }

  async function rescanAssetsFolder() {
    return syncAssetsFolder({ exportMissing: true });
  }

  async function setBackgroundConfig(patch) {
    await readyPromise;
    if (!patch || typeof patch !== 'object') return getStateSnapshot();
    if (patch.mode !== undefined) activeMeta.bgMode = String(patch.mode || 'none');
    if (patch.presetId !== undefined) activeMeta.bgPresetId = String(patch.presetId || 'none');
    if (patch.assetId !== undefined) {
      activeMeta.bgAssetId = patch.assetId ? String(patch.assetId) : null;
      activePayloads.background = activeMeta.bgAssetId ? memoryAssetStore.get(activeMeta.bgAssetId) || null : null;
    }
    if (patch.bgIndex !== undefined) activeMeta.bgIndex = Math.max(0, Math.floor(Number(patch.bgIndex) || 0));
    if (patch.url !== undefined) {
      activeMeta.bgUrl = String(patch.url || '').trim();
      const lower = activeMeta.bgUrl.toLowerCase();
      if (!patch.mediaType) {
        activeMeta.bgMediaType = /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(lower) || lower.startsWith('data:video/')
          ? 'video'
          : 'image';
      }
    }
    if (patch.mediaType !== undefined) activeMeta.bgMediaType = String(patch.mediaType || 'image');
    if (patch.opacity !== undefined) activeMeta.bgOpacity = clamp(Number(patch.opacity), 0.05, 1, activeMeta.bgOpacity);
    if (patch.blur !== undefined) activeMeta.bgBlur = clamp(Number(patch.blur), 0, 20, activeMeta.bgBlur);

    saveMeta();
    refreshTrackedTetrioImages();
    refreshCustomBackgroundDom();
    emitChange();
    return getStateSnapshot();
  }

  function isCustomBgEnabled() {
    if (activeMeta.bgMode === 'preset') return activeMeta.bgPresetId && activeMeta.bgPresetId !== 'none';
    if (activeMeta.bgMode === 'asset') return Boolean(activePayloads.background);
    if (activeMeta.bgMode === 'url') return Boolean(activeMeta.bgUrl);
    return false;
  }

  function normalizeTetrioPath(urlStr) {
    if (typeof urlStr !== 'string') return '';
    if (urlStr.startsWith('data:') || urlStr.startsWith('blob:')) return '';
    try {
      const origin = root.location && root.location.origin && root.location.origin !== 'null'
        ? root.location.origin
        : 'https://tetr.io';
      const u = new URL(urlStr, origin);
      if (u.hostname && u.hostname !== 'tetr.io' && !u.pathname.startsWith('/res/') && !u.pathname.startsWith('/sfx/')) {
        return '';
      }
      return u.pathname;
    } catch (_) {
      return urlStr.split('?')[0].split('#')[0];
    }
  }

  function resolveSkinOverrideUrl(rawUrl) {
    const pathname = normalizeTetrioPath(rawUrl);
    if (!pathname) return null;
    const is2x = /\.2x\.png$/i.test(pathname);

    if (pathname.startsWith('/res/skins/minos/')) {
      const rec = activePayloads.skin;
      const p = rec && rec.payload;
      if (p && p.skin) {
        const v = p.variants || {};
        if (/connected(\.2x)?\.png$/i.test(pathname)) {
          return is2x ? (v.connectedUhd || v.connectedHd || p.skin) : (v.connectedHd || p.skin);
        }
        if (/tetrio(\.2x)?\.png$/i.test(pathname)) {
          return is2x ? (v.simpleUhd || v.simpleHd || p.skin) : (v.simpleHd || p.skin);
        }
      }
    }
    if (pathname.startsWith('/res/skins/ghost/')) {
      const rec = activePayloads.skin;
      const p = rec && rec.payload;
      if (p && (p.ghost || (p.variants && (p.variants.ghostSimpleHd || p.variants.ghostConnectedHd)))) {
        const v = p.variants || {};
        if (/connected(\.2x)?\.png$/i.test(pathname)) {
          return is2x ? (v.ghostConnectedUhd || v.ghostConnectedHd || p.ghost) : (v.ghostConnectedHd || p.ghost);
        }
        if (/tetrio(\.2x)?\.png$/i.test(pathname)) {
          return is2x ? (v.ghostSimpleUhd || v.ghostSimpleHd || p.ghost) : (v.ghostSimpleHd || p.ghost);
        }
      }
    }
    if (pathname.startsWith('/res/skins/board/generic/')) {
      const rec = activePayloads.board;
      const fallbackSkinBoard = activePayloads.skin;
      const p = (rec && rec.payload) || (fallbackSkinBoard && fallbackSkinBoard.payload) || null;
      if (p) {
        const v = p.variants || {};
        if (/board\.png$/i.test(pathname) && (v.board512 || p.board)) return v.board512 || p.board;
        if (/queue\.png$/i.test(pathname) && (v.queue512 || p.queue)) return v.queue512 || p.queue;
        if (/grid\.png$/i.test(pathname) && (v.grid1024 || p.grid)) return v.grid1024 || p.grid;
      }
    }
    if (pathname.startsWith('/res/bg/') && isCustomBgEnabled()) {
      return TRANSPARENT_1PX_PNG;
    }
    return null;
  }

  async function buildCustomRsdResponse(rawResponse) {
    const sfxRecord = activePayloads.sfx;
    if (!sfxRecord || !sfxRecord.payload) return rawResponse;

    const p = sfxRecord.payload;
    const rawBuf = await rawResponse.arrayBuffer();
    const parsed = logic.parseTrsd(rawBuf);

    const AudioCtx = root.AudioContext || root.webkitAudioContext;
    const OfflineCtx = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!AudioCtx) return new Response(rawBuf, { status: 200 });

    const ctx = new AudioCtx();
    try {
      const baseBuffer = await ctx.decodeAudioData(
        parsed.audioBytes.buffer.slice(parsed.audioBytes.byteOffset, parsed.audioBytes.byteOffset + parsed.audioBytes.byteLength)
      );
      const sampleRate = baseBuffer.sampleRate || 44100;
      const numChannels = Math.min(2, Math.max(1, baseBuffer.numberOfChannels || 1));

      let packAtlasBuffer = null;
      if (p.sfxAtlasDataUrl && p.sfxAtlasMap) {
        const atlasBytes = logic.dataUrlToBytes(p.sfxAtlasDataUrl);
        if (atlasBytes.length > 0) {
          packAtlasBuffer = await ctx.decodeAudioData(
            atlasBytes.buffer.slice(atlasBytes.byteOffset, atlasBytes.byteOffset + atlasBytes.byteLength)
          );
        }
      }

      async function resampleToChannels(srcBuffer, startSec, durSec) {
        const s = Math.max(0, startSec);
        const maxAvail = Math.max(0, srcBuffer.duration - s);
        const dur = Math.min(durSec, maxAvail);
        const frameCount = Math.max(1, Math.round(dur * sampleRate));

        if (OfflineCtx && srcBuffer.sampleRate !== sampleRate) {
          const off = new OfflineCtx(numChannels, frameCount, sampleRate);
          const node = off.createBufferSource();
          node.buffer = srcBuffer;
          node.connect(off.destination);
          node.start(0, s, dur);
          const rendered = await off.startRendering();
          return Array.from({ length: numChannels }, (_, ch) => rendered.getChannelData(Math.min(ch, rendered.numberOfChannels - 1)));
        }

        const startIdx = Math.max(0, Math.floor(s * srcBuffer.sampleRate));
        const endIdx = Math.min(srcBuffer.length, startIdx + Math.max(1, Math.floor(dur * srcBuffer.sampleRate)));
        return Array.from({ length: numChannels }, (_, ch) => {
          const chanData = srcBuffer.getChannelData(Math.min(ch, srcBuffer.numberOfChannels - 1));
          return chanData.subarray(startIdx, endIdx);
        });
      }

      const decodedZipBuffers = new Map();
      const perSoundChunks = [];
      let totalFrames = 0;

      for (const entry of parsed.entries) {
        const key = String(entry.name || '').toLowerCase();
        let channels = null;

        if (packAtlasBuffer && p.sfxAtlasMap && p.sfxAtlasMap[key]) {
          const slice = p.sfxAtlasMap[key];
          channels = await resampleToChannels(packAtlasBuffer, slice.offsetSec, slice.durationSec);
        } else if (p.sfxFiles && p.sfxFiles[key]) {
          let customBuf = decodedZipBuffers.get(key);
          if (!customBuf) {
            try {
              const fBytes = logic.dataUrlToBytes(p.sfxFiles[key]);
              customBuf = await ctx.decodeAudioData(
                fBytes.buffer.slice(fBytes.byteOffset, fBytes.byteOffset + fBytes.byteLength)
              );
              decodedZipBuffers.set(key, customBuf);
            } catch (_) {
              customBuf = null;
            }
          }
          if (customBuf) {
            channels = await resampleToChannels(customBuf, 0, customBuf.duration);
          }
        }

        if (!channels) {
          channels = await resampleToChannels(baseBuffer, entry.offsetSec, entry.durationSec);
        }

        const frames = channels[0].length;
        const gapFrames = Math.round(0.01 * sampleRate); // tiny 10ms guard between sounds
        perSoundChunks.push({ name: entry.name, startFrame: totalFrames, channels, frames });
        totalFrames += frames + gapFrames;
      }

      const mergedChannels = Array.from({ length: numChannels }, () => new Float32Array(Math.max(1, totalFrames)));
      const rebuiltEntries = [];
      for (const chunk of perSoundChunks) {
        rebuiltEntries.push({
          name: chunk.name,
          offsetSec: chunk.startFrame / sampleRate
        });
        for (let ch = 0; ch < numChannels; ch++) {
          mergedChannels[ch].set(chunk.channels[ch], chunk.startFrame);
        }
      }

      const wavBytes = logic.encodeWavPcm16(mergedChannels, sampleRate);
      const trsdBytes = logic.buildTrsd(rebuiltEntries, totalFrames / sampleRate, wavBytes);
      return new Response(trsdBytes, {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' }
      });
    } catch (err) {
      console.error('[twfoxtetrio] Failed building custom SFX RSD, using original:', err);
      return new Response(rawBuf, { status: 200 });
    } finally {
      if (typeof ctx.close === 'function') {
        ctx.close().catch(() => {});
      }
    }
  }

  function installEarlyRuntimeHooks() {
    if (hooksInstalled) return;
    hooksInstalled = true;

    // 1. Auto-enable Connected mode on boot when custom skin is 2048x2048 connected
    try {
      let devhookFn = root.DEVHOOK_CONNECTED_SKIN;
      if (typeof devhookFn === 'function') {
        applyConnectedHookIfNeeded();
      } else {
        Object.defineProperty(root, 'DEVHOOK_CONNECTED_SKIN', {
          configurable: true,
          enumerable: true,
          get() {
            return devhookFn;
          },
          set(val) {
            devhookFn = val;
            if (typeof val === 'function') {
              const schedule = typeof root.queueMicrotask === 'function'
                ? root.queueMicrotask.bind(root)
                : (fn) => Promise.resolve().then(fn);
              schedule(() => applyConnectedHookIfNeeded());
            }
          }
        });
      }
    } catch (_) {}

    // 2. HTMLImageElement.prototype.src interception for Skins / Ghost / Board / Queue / Grid / Default BG
    if (typeof root.HTMLImageElement === 'function') {
      const desc = Object.getOwnPropertyDescriptor(root.HTMLImageElement.prototype, 'src');
      if (desc && typeof desc.set === 'function') {
        nativeImgSrcDesc = desc;
        Object.defineProperty(root.HTMLImageElement.prototype, 'src', {
          configurable: true,
          enumerable: desc.enumerable,
          get: desc.get,
          set(val) {
            const rawStr = String(val || '');
            const pathname = normalizeTetrioPath(rawStr);
            if (pathname && (pathname.startsWith('/res/skins/') || pathname.startsWith('/res/bg/'))) {
              if (pathname.startsWith('/res/skins/')) {
                tetrioSkinsLoadedOnBoot = true;
              }
              trackedImages.set(this, rawStr);

              const hasPendingCustom = Boolean(activeMeta.activeSkinId || activeMeta.activeBoardId || isCustomBgEnabled());
              if (!readyResolved && hasPendingCustom) {
                const selfImg = this;
                readyPromise.then(() => {
                  const resolved = resolveSkinOverrideUrl(rawStr) || rawStr;
                  desc.set.call(selfImg, resolved);
                });
                return;
              }

              const override = resolveSkinOverrideUrl(rawStr);
              if (override) {
                desc.set.call(this, override);
                return;
              }
            }
            desc.set.call(this, val);
          }
        });
      }
    }

    // 3. fetch() interception for /sfx/tetrio.*.rsd
    if (typeof root.fetch === 'function') {
      nativeFetch = root.fetch.bind(root);
      root.fetch = async function (input, init) {
        const urlStr = typeof input === 'string' ? input : (input && input.url) || '';
        const pathname = normalizeTetrioPath(urlStr);
        if (pathname && /^\/sfx\/tetrio\.[^/]+\.rsd/i.test(pathname)) {
          tetrioSfxLoadedOnBoot = true;
          await readyPromise;
          const resp = await nativeFetch(input, init);
          if (activeMeta.activeSfxId && activePayloads.sfx) {
            return buildCustomRsdResponse(resp);
          }
          return resp;
        }
        return nativeFetch(input, init);
      };
    }

    // 4. Make #pixi clearColor transparent when a Custom Animated/Static Background layer is active
    for (const CtxName of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
      const Ctor = root[CtxName];
      if (!Ctor || !Ctor.prototype || typeof Ctor.prototype.clearColor !== 'function') continue;
      const origClearColor = Ctor.prototype.clearColor;
      Ctor.prototype.clearColor = function (r, g, b, a) {
        if (isCustomBgEnabled() && this && this.canvas && this.canvas.id === 'pixi' && r === 0 && g === 0 && b === 0) {
          return origClearColor.call(this, 0, 0, 0, 0);
        }
        return origClearColor.call(this, r, g, b, a);
      };
    }
  }

  function ensureBackgroundStyle() {
    if (!root.document || !root.document.head) return;
    if (root.document.getElementById(STYLE_ID)) return;
    const style = root.document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${BG_LAYER_ID} {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  display: none;
  background: #060810;
}
#${BG_LAYER_ID}.is-active {
  display: block;
}
#${BG_LAYER_ID} > video,
#${BG_LAYER_ID} > img,
#${BG_LAYER_ID} > canvas {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
body.twfox-has-custom-bg #pixi {
  background: transparent !important;
}
`;
    root.document.head.appendChild(style);
  }

  function stopBackgroundLoop() {
    if (bgRafId !== null && typeof root.cancelAnimationFrame === 'function') {
      root.cancelAnimationFrame(bgRafId);
      bgRafId = null;
    }
  }

  function startPresetAnimationLoop(canvas, presetId) {
    stopBackgroundLoop();
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars = Array.from({ length: 140 }, (_, i) => ({
      x: ((i * 73) % 200) - 100,
      y: ((i * 137) % 200) - 100,
      z: 0.2 + ((i * 29) % 100) / 100
    }));

    function frame(ts) {
      if (!canvas.isConnected) {
        bgRafId = null;
        return;
      }
      const targetW = Math.max(320, Math.floor((root.innerWidth || 1280) * 0.75));
      const targetH = Math.max(200, Math.floor((root.innerHeight || 720) * 0.75));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      const w = canvas.width;
      const h = canvas.height;
      const t = ts * 0.001;

      if (presetId === 'starfield') {
        ctx.fillStyle = '#050712';
        ctx.fillRect(0, 0, w, h);
        const cx = w / 2;
        const cy = h / 2;
        for (const s of stars) {
          s.z -= 0.006;
          if (s.z <= 0.03) s.z = 1;
          const sx = cx + (s.x / s.z) * (w * 0.012);
          const sy = cy + (s.y / s.z) * (w * 0.012);
          const size = Math.max(1, (1 - s.z) * 3.8);
          ctx.fillStyle = `rgba(170, 210, 255, ${(1 - s.z * 0.85).toFixed(2)})`;
          ctx.fillRect(sx, sy, size, size);
        }
      } else if (presetId === 'synth_grid') {
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#090314');
        sky.addColorStop(0.55, '#1c0b30');
        sky.addColorStop(1, '#080512');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        const horizon = h * 0.54;
        ctx.fillStyle = 'rgba(255, 110, 64, 0.22)';
        ctx.beginPath();
        ctx.arc(w / 2, horizon - 18, Math.min(w, h) * 0.14, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 92, 180, 0.42)';
        ctx.lineWidth = 1.5;
        for (let i = -12; i <= 12; i++) {
          ctx.beginPath();
          ctx.moveTo(w / 2 + i * (w * 0.02), horizon);
          ctx.lineTo(w / 2 + i * (w * 0.12), h);
          ctx.stroke();
        }
        const scroll = (t * 0.7) % 1;
        for (let row = 0; row < 14; row++) {
          const p = (row + scroll) / 14;
          const y = horizon + Math.pow(p, 2.1) * (h - horizon);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      } else {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#070b18');
        g.addColorStop(0.5, '#101d3b');
        g.addColorStop(1, '#1a0f2e');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        for (let wave = 0; wave < 3; wave++) {
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let x = 0; x <= w; x += 28) {
            const y = h * (0.45 + wave * 0.12) + Math.sin(x * 0.008 + t * (1 + wave * 0.35) + wave) * (h * 0.07);
            ctx.lineTo(x, y);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fillStyle = wave === 0
            ? 'rgba(72, 165, 255, 0.14)'
            : wave === 1
              ? 'rgba(255, 130, 68, 0.13)'
              : 'rgba(175, 92, 255, 0.12)';
          ctx.fill();
        }
      }

      if (typeof root.requestAnimationFrame === 'function') {
        bgRafId = root.requestAnimationFrame(frame);
      }
    }

    if (typeof root.requestAnimationFrame === 'function') {
      bgRafId = root.requestAnimationFrame(frame);
    } else {
      frame(0);
    }
  }

  function ensureBackgroundLayer() {
    const doc = root.document;
    if (!doc || !doc.body) return null;
    ensureBackgroundStyle();
    let layer = doc.getElementById(BG_LAYER_ID);
    if (!layer) {
      layer = doc.createElement('div');
      layer.id = BG_LAYER_ID;
      layer.setAttribute('aria-hidden', 'true');
      const pixi = doc.getElementById('pixi');
      if (pixi && pixi.parentNode === doc.body) {
        doc.body.insertBefore(layer, pixi);
      } else {
        doc.body.insertBefore(layer, doc.body.firstChild || null);
      }
    }
    return layer;
  }

  function refreshCustomBackgroundDom() {
    const doc = root.document;
    if (!doc || !doc.body) return;
    const layer = ensureBackgroundLayer();
    if (!layer) return;

    const enabled = isCustomBgEnabled();
    doc.body.classList.toggle('twfox-has-custom-bg', enabled);
    layer.classList.toggle('is-active', enabled);

    if (!enabled) {
      stopBackgroundLoop();
      if (bgCurrentSignature !== 'none') {
        bgCurrentSignature = 'none';
        layer.innerHTML = '';
      }
      return;
    }

    const op = clamp(Number(activeMeta.bgOpacity), 0.05, 1, 0.72);
    const blur = clamp(Number(activeMeta.bgBlur), 0, 20, 0);
    const filterCss = blur > 0 ? `blur(${blur}px) scale(1.03)` : 'none';

    let desiredKind = 'none';
    let desiredSrc = '';
    if (activeMeta.bgMode === 'preset') {
      desiredKind = 'preset';
      desiredSrc = activeMeta.bgPresetId;
    } else if (activeMeta.bgMode === 'asset' && activePayloads.background) {
      const bgs = (activePayloads.background.payload && activePayloads.background.payload.backgrounds) || [];
      const idx = bgs.length > 0 ? Math.min(activeMeta.bgIndex, bgs.length - 1) : -1;
      const entry = idx >= 0 ? bgs[idx] : null;
      if (entry) {
        desiredKind = entry.mediaType === 'video' ? 'video' : 'image';
        desiredSrc = entry.dataUrl;
      }
    } else if (activeMeta.bgMode === 'url' && activeMeta.bgUrl) {
      desiredKind = activeMeta.bgMediaType === 'video' ? 'video' : 'image';
      desiredSrc = activeMeta.bgUrl;
    }

    const sig = `${desiredKind}::${desiredSrc.slice(0, 128)}::${desiredSrc.length}`;
    if (sig !== bgCurrentSignature) {
      bgCurrentSignature = sig;
      stopBackgroundLoop();
      layer.innerHTML = '';

      if (desiredKind === 'preset') {
        const canvas = doc.createElement('canvas');
        canvas.className = 'twfox-bg-media';
        layer.appendChild(canvas);
        startPresetAnimationLoop(canvas, desiredSrc);
      } else if (desiredKind === 'video' && desiredSrc) {
        const vid = doc.createElement('video');
        vid.className = 'twfox-bg-media';
        vid.autoplay = true;
        vid.loop = true;
        vid.muted = true;
        vid.playsInline = true;
        vid.src = desiredSrc;
        layer.appendChild(vid);
        if (typeof vid.play === 'function') {
          try {
            const p = vid.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          } catch (_) {}
        }
      } else if (desiredKind === 'image' && desiredSrc) {
        const img = doc.createElement('img');
        img.className = 'twfox-bg-media';
        img.alt = '';
        img.src = desiredSrc;
        layer.appendChild(img);
      }
    }

    const child = layer.firstElementChild || (layer.children && layer.children[0]) || null;
    if (child) {
      if (child.style) {
        child.style.opacity = String(op);
        child.style.filter = filterCss;
      } else if (typeof child.setAttribute === 'function') {
        child.setAttribute('style', `opacity:${op};filter:${filterCss};`);
      }
    }
  }

  function getActiveTextures() {
    const skinPayload = activePayloads.skin && activePayloads.skin.payload;
    const boardPayload = activePayloads.board && activePayloads.board.payload;
    const sv = (skinPayload && skinPayload.variants) || {};
    const bv = (boardPayload && boardPayload.variants) || {};
    const isConnectedSkin = skinPayload && skinPayload.skinFormat === 'connected';
    const isConnectedGhost = skinPayload && skinPayload.ghostFormat === 'connected';
    return {
      skinDataUrl: skinPayload
        ? (isConnectedSkin ? (sv.connectedUhd || sv.connectedHd || skinPayload.skin) : (sv.simpleUhd || sv.simpleHd || skinPayload.skin))
        : null,
      skinFormat: (skinPayload && skinPayload.skinFormat) || 'simple',
      ghostDataUrl: skinPayload
        ? (isConnectedGhost ? (sv.ghostConnectedUhd || sv.ghostConnectedHd || skinPayload.ghost) : (sv.ghostSimpleUhd || sv.ghostSimpleHd || skinPayload.ghost))
        : null,
      ghostFormat: (skinPayload && skinPayload.ghostFormat) || 'simple',
      boardDataUrl: bv.board512 || (boardPayload && boardPayload.board) || sv.board512 || (skinPayload && skinPayload.board) || null,
      queueDataUrl: bv.queue512 || (boardPayload && boardPayload.queue) || sv.queue512 || (skinPayload && skinPayload.queue) || null,
      gridDataUrl: bv.grid1024 || (boardPayload && boardPayload.grid) || sv.grid1024 || (skinPayload && skinPayload.grid) || null
    };
  }

  function getStateSnapshot() {
    const records = Array.from(memoryAssetStore.values())
      .map(summarizeRecord)
      .sort((a, b) => (b.downloadedAt - a.downloadedAt) || a.name.localeCompare(b.name));

    return {
      ready: readyResolved,
      catalogCount: Array.isArray(catalogCache.items) ? catalogCache.items.length : 0,
      catalogLoaded: Array.isArray(catalogCache.items),
      installed: records,
      active: {
        skinId: activeMeta.activeSkinId,
        skinFormat: activeMeta.activeSkinFormat,
        boardId: activeMeta.activeBoardId,
        sfxId: activeMeta.activeSfxId,
        bgMode: activeMeta.bgMode,
        bgPresetId: activeMeta.bgPresetId,
        bgAssetId: activeMeta.bgAssetId,
        bgIndex: activeMeta.bgIndex,
        bgUrl: activeMeta.bgUrl,
        bgMediaType: activeMeta.bgMediaType,
        bgOpacity: activeMeta.bgOpacity,
        bgBlur: activeMeta.bgBlur
      },
      needsReload,
      lastError,
      folderPath: assetsFolderPath,
      folderSyncing
    };
  }

  async function previewSfxPack(id) {
    await readyPromise;
    const AudioCtx = root.AudioContext || root.webkitAudioContext;
    if (!AudioCtx) return false;
    const rec = memoryAssetStore.get(String(id || activeMeta.activeSfxId || ''));
    if (!rec || !rec.payload) return false;
    const p = rec.payload;

    const ctx = new AudioCtx();
    try {
      if (p.sfxAtlasDataUrl && p.sfxAtlasMap) {
        const sampleKey = ['harddrop', 'move', 'rotate', 'clearline', 'hold'].find((k) => p.sfxAtlasMap[k]) ||
          Object.keys(p.sfxAtlasMap)[0];
        if (!sampleKey) return false;
        const slice = p.sfxAtlasMap[sampleKey];
        const raw = logic.dataUrlToBytes(p.sfxAtlasDataUrl);
        const buf = await ctx.decodeAudioData(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0, slice.offsetSec, Math.min(2, slice.durationSec));
        return true;
      }
      if (p.sfxFiles) {
        const sampleKey = ['harddrop', 'move', 'rotate', 'clearline', 'hold'].find((k) => p.sfxFiles[k]) ||
          Object.keys(p.sfxFiles)[0];
        if (!sampleKey) return false;
        const raw = logic.dataUrlToBytes(p.sfxFiles[sampleKey]);
        const buf = await ctx.decodeAudioData(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0, 0, Math.min(2, buf.duration));
        return true;
      }
    } catch (_) {
      return false;
    }
    return false;
  }

  installEarlyRuntimeHooks();

  const api = {
    ready: () => readyPromise,
    getState: getStateSnapshot,
    subscribe(fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.add(fn);
      fn(getStateSnapshot());
      return () => listeners.delete(fn);
    },
    fetchCatalog,
    searchCatalog(opts) {
      return logic.filterAndSortCatalog(catalogCache.items || [], opts);
    },
    isDownloaded(id) {
      return memoryAssetStore.has(String(id));
    },
    isActive(id) {
      const s = String(id);
      return (
        activeMeta.activeSkinId === s ||
        activeMeta.activeBoardId === s ||
        activeMeta.activeSfxId === s ||
        (activeMeta.bgMode === 'asset' && activeMeta.bgAssetId === s)
      );
    },
    downloadAndInstallCatalogItem,
    importLocalAsset,
    activateAsset,
    deactivateSlot,
    uninstallAsset,
    setBackgroundConfig,
    getActiveTextures,
    previewSfxPack,
    refreshCustomBackgroundDom,
    resolveSkinOverrideUrl,
    getCatalogItemPreviewUrl,
    requestCatalogItemPreview,
    resetPreviewQueue,
    openAssetsFolder,
    rescanAssetsFolder
  };

  root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
  root.__TWFOX_INTERNAL__.customAssets = api;

  if (typeof root.document !== 'undefined') {
    const onDomReady = () => {
      refreshCustomBackgroundDom();
    };
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
    } else {
      onDomReady();
    }
  }
}(typeof globalThis !== 'undefined' ? globalThis : window));
