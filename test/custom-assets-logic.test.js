'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const logic = require('../src/features/custom-assets-logic');

function makeMinimalPng(width, height) {
  const buf = Buffer.alloc(24);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf[4] = 0x0d;
  buf[5] = 0x0a;
  buf[6] = 0x1a;
  buf[7] = 0x0a;
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function buildTestZip(entries) {
  const localParts = [];
  const cdParts = [];
  let offset = 0;

  for (const item of entries) {
    const nameBuf = Buffer.from(item.name, 'utf8');
    const rawBuf = Buffer.isBuffer(item.data) ? item.data : Buffer.from(item.data);
    const method = item.deflate ? 8 : 0;
    const compBuf = item.deflate ? zlib.deflateRawSync(rawBuf) : rawBuf;

    const lfh = Buffer.alloc(30 + nameBuf.length);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt32LE(compBuf.length, 18);
    lfh.writeUInt32LE(rawBuf.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(lfh, 30);

    const cdh = Buffer.alloc(46 + nameBuf.length);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt32LE(compBuf.length, 20);
    cdh.writeUInt32LE(rawBuf.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt32LE(offset, 42);
    nameBuf.copy(cdh, 46);

    localParts.push(lfh, compBuf);
    cdParts.push(cdh);
    offset += lfh.length + compBuf.length;
  }

  const cdBuf = Buffer.concat(cdParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, cdBuf, eocd]);
}

test('catalog classification, vote lookup, URL candidates, and filtering/sorting', () => {
  const votes = {
    'skin-4_false-carbon_fiber': { total: 12, active: 2 },
    'sfx-8bJackie-Tetrio_retro_pack': { total: 4, active: 1 },
    'unknown-TRIPPY-Blackout': { total: 8, active: 0 }
  };

  const items = [
    logic.normalizeCatalogItem(
      {
        id: 'skin-4_false-carbon_fiber',
        name: 'Carbon Fiber',
        author: '4_false',
        description: 'Connected carbon minos',
        type: 'skin',
        format: 'tetrioraster',
        uploaded: 1620000000000,
        path: 'content/skin/4_false/carbon_fiber.png',
        tpsePath: 'tpsefiles/skin/4_false/carbon_fiber.png.tpse'
      },
      votes
    ),
    logic.normalizeCatalogItem(
      {
        id: 'unknown-TRIPPY-Blackout',
        name: 'Blackout UI',
        author: 'TRIPPY',
        description: 'Clean dark board skin',
        type: 'unknown',
        format: null,
        uploaded: 1630000000000,
        path: 'content/unknown/TRIPPY/Blackout.zip',
        tpsePath: 'tpsefiles/unknown/TRIPPY/Blackout.zip.tpse'
      },
      votes
    ),
    logic.normalizeCatalogItem(
      {
        id: 'sfx-8bJackie-Tetrio_retro_pack',
        name: 'Tetrio_retro_pack',
        author: '8bJackie',
        description: '8bit chiptune sounds',
        type: 'sfx',
        format: 'tetrio',
        uploaded: 1640000000000,
        path: 'content/sfx/8bJackie/Tetrio_retro_pack.zip',
        tpsePath: 'tpsefiles/sfx/8bJackie/Tetrio_retro_pack.zip'
      },
      votes
    ),
    logic.normalizeCatalogItem(
      {
        id: 'skin-badgoblin-Minimality',
        name: 'Minimality Animated',
        author: 'badgoblin',
        type: 'skin',
        format: 'tetrioanim',
        uploaded: 1610000000000,
        path: 'content/skin/badgoblin/minimality.gif',
        tpsePath: 'tpsefiles/skin/badgoblin/minimality.gif.tpse'
      },
      votes
    )
  ];

  assert.equal(items[0].category, 'skin');
  assert.equal(items[0].votes, 12);
  assert.equal(items[1].category, 'board');
  assert.equal(items[2].category, 'sfx');
  assert.equal(items[3].animated, true);

  assert.deepEqual(items[2].downloadUrls, [
    'https://you.have.fail/tetrioplus/data/tpsefiles/sfx/8bJackie/Tetrio_retro_pack.zip',
    'https://you.have.fail/tetrioplus/data/tpsefiles/sfx/8bJackie/Tetrio_retro_pack.zip.tpse',
    'https://you.have.fail/tetrioplus/data/content/sfx/8bJackie/Tetrio_retro_pack.zip'
  ]);

  const byVotes = logic.filterAndSortCatalog(items, { category: 'all', sort: 'votes' });
  assert.deepEqual(
    byVotes.map((x) => x.id),
    [
      'skin-4_false-carbon_fiber',
      'unknown-TRIPPY-Blackout',
      'sfx-8bJackie-Tetrio_retro_pack',
      'skin-badgoblin-Minimality'
    ]
  );

  assert.equal(logic.filterAndSortCatalog(items, { category: 'board' }).length, 1);
  assert.equal(logic.filterAndSortCatalog(items, { category: 'sfx' }).length, 1);
  assert.equal(logic.filterAndSortCatalog(items, { category: 'animated' }).length, 1);
  assert.equal(logic.filterAndSortCatalog(items, { search: 'chiptune' })[0].id, 'sfx-8bJackie-Tetrio_retro_pack');
});

test('parseTpseObject normalizes octet-stream PNGs, detects connected skin dimensions, SFX atlas, and sidecar backgrounds', () => {
  const skinPngB64 = makeMinimalPng(2048, 2048).toString('base64');
  const ghostPngB64 = makeMinimalPng(1024, 1024).toString('base64');
  const boardPngB64 = makeMinimalPng(512, 512).toString('base64');

  const parsed = logic.parseTpseObject({
    skin: `data:application/octet-stream;base64,${skinPngB64}`,
    ghost: `data:image/png;base64,${ghostPngB64}`,
    board: `data:application/octet-stream;base64,${boardPngB64}`,
    queue: `data:application/octet-stream;base64,${boardPngB64}`,
    customSounds: 'data:audio/ogg;base64,T2dnUwACAAAA',
    customSoundAtlas: {
      move: [100, 250],
      harddrop: [350, 500]
    },
    backgrounds: [{ id: 'clip1', type: 'image', filename: 'bg_anim.webm' }],
    'background-clip1': 'data:application/octet-stream;base64,GkXfowEAAA=='
  });

  assert.equal(parsed.capabilities.skin, true);
  assert.equal(parsed.capabilities.ghost, true);
  assert.equal(parsed.capabilities.board, true);
  assert.equal(parsed.capabilities.queue, true);
  assert.equal(parsed.capabilities.sfx, true);
  assert.equal(parsed.capabilities.background, true);
  assert.equal(parsed.capabilities.animated, true);

  assert.equal(parsed.skinFormat, 'connected');
  assert.equal(parsed.ghostFormat, 'connected');
  assert.ok(parsed.skin.startsWith('data:image/png;base64,'));
  assert.ok(parsed.board.startsWith('data:image/png;base64,'));
  assert.deepEqual(parsed.sfxAtlasMap.move, { offsetSec: 0.1, durationSec: 0.25 });
  assert.deepEqual(parsed.sfxAtlasMap.harddrop, { offsetSec: 0.35, durationSec: 0.5 });
  assert.equal(parsed.backgrounds.length, 1);
  assert.equal(parsed.backgrounds[0].mediaType, 'video');
  assert.ok(parsed.backgrounds[0].dataUrl.startsWith('data:video/webm;base64,'));
});

test('parseAssetZip extracts stored & deflated board/skin/SFX packs', async () => {
  const oggMove = Buffer.from('OggS-fake-move');
  const wavDrop = Buffer.from('RIFF\x00\x00\x00\x00WAVEfmt ');
  const boardPng = makeMinimalPng(512, 512);
  const skinPng = makeMinimalPng(512, 512);

  const zipBuf = buildTestZip([
    { name: 'sfx/move.ogg', data: oggMove, deflate: true },
    { name: 'sfx/harddrop.wav', data: wavDrop, deflate: false },
    { name: 'textures/board.png', data: boardPng, deflate: true },
    { name: 'textures/minos.png', data: skinPng, deflate: false }
  ]);

  const parsed = await logic.parseAssetZip(
    zipBuf,
    { category: 'sfx' },
    (compressed) => zlib.inflateRawSync(Buffer.from(compressed))
  );

  assert.equal(parsed.capabilities.sfx, true);
  assert.equal(parsed.capabilities.board, true);
  assert.equal(parsed.capabilities.skin, true);
  assert.equal(parsed.skinFormat, 'simple');
  assert.ok(parsed.board.startsWith('data:image/png;base64,'));
  assert.ok(parsed.sfxFiles.move.startsWith('data:audio/ogg;base64,'));
  assert.ok(parsed.sfxFiles.harddrop.startsWith('data:audio/wav;base64,'));
});

test('tRSD v1.0 parser/builder and PCM16 WAV encoder round-trip cleanly', () => {
  const left = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const right = new Float32Array([0, -0.25, 0.25, 0.75, -0.75]);
  const wav = logic.encodeWavPcm16([left, right], 44100);

  assert.equal(String.fromCharCode(wav[0], wav[1], wav[2], wav[3]), 'RIFF');
  assert.equal(String.fromCharCode(wav[8], wav[9], wav[10], wav[11]), 'WAVE');
  assert.equal(wav.length, 44 + 5 * 2 * 2);

  const trsd = logic.buildTrsd(
    [
      { name: 'move', offsetSec: 0 },
      { name: 'harddrop', offsetSec: 0.25 }
    ],
    0.85,
    wav
  );

  const reparsed = logic.parseTrsd(trsd);
  assert.equal(reparsed.major, 1);
  assert.equal(reparsed.minor, 0);
  assert.equal(reparsed.entries.length, 2);
  assert.equal(reparsed.entries[0].name, 'move');
  assert.ok(Math.abs(reparsed.entries[0].offsetSec - 0) < 1e-6);
  assert.ok(Math.abs(reparsed.entries[0].durationSec - 0.25) < 1e-6);
  assert.equal(reparsed.entries[1].name, 'harddrop');
  assert.ok(Math.abs(reparsed.entries[1].offsetSec - 0.25) < 1e-6);
  assert.ok(Math.abs(reparsed.entries[1].durationSec - 0.6) < 1e-5);
  assert.deepEqual(Buffer.from(reparsed.audioBytes), Buffer.from(wav));
});
