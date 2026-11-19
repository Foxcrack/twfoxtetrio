'use strict';

const fs = require('fs');
const crypto = require('crypto');

const BLOCK_SIZE = 4 * 1024 * 1024; // 4 MiB, standard Electron ASAR integrity block size
const MOD_START_MARKER = '// === TWFOXTETRIO MOD START ===';

/**
 * Computes Electron ASAR SHA-256 integrity metadata for a file buffer.
 *
 * @param {Buffer} buffer
 * @returns {{ algorithm: string, hash: string, blockSize: number, blocks: string[] }}
 */
function computeIntegrity(buffer) {
  const fullHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const blocks = [];
  if (buffer.length === 0) {
    blocks.push(fullHash);
  } else {
    for (let offset = 0; offset < buffer.length; offset += BLOCK_SIZE) {
      const end = Math.min(offset + BLOCK_SIZE, buffer.length);
      blocks.push(crypto.createHash('sha256').update(buffer.subarray(offset, end)).digest('hex'));
    }
  }
  return {
    algorithm: 'SHA256',
    hash: fullHash,
    blockSize: BLOCK_SIZE,
    blocks
  };
}

/**
 * Parses an ASAR file's Chromium Pickle header and JSON file tree.
 *
 * @param {string} asarPath
 * @returns {{
 *   asarPath: string,
 *   fileSize: number,
 *   dataBase: number,
 *   header: { files: Record<string, any> }
 * }}
 */
function parseAsar(asarPath) {
  const stat = fs.statSync(asarPath);
  const fd = fs.openSync(asarPath, 'r');
  try {
    if (stat.size < 16) {
      throw new Error('Invalid ASAR file: too small (' + stat.size + ' bytes)');
    }
    const pickle = Buffer.alloc(16);
    fs.readSync(fd, pickle, 0, 16, 0);

    const headerSizeField = pickle.readUInt32LE(0);
    const headerPayloadSize = pickle.readUInt32LE(4);
    const stringAlignedSize = pickle.readUInt32LE(8);
    const stringLength = pickle.readUInt32LE(12);

    if (headerSizeField !== 4) {
      throw new Error('Unsupported ASAR pickle header size: ' + headerSizeField);
    }
    if (stringLength > stringAlignedSize - 4 || headerPayloadSize < stringAlignedSize + 4) {
      throw new Error('Corrupt ASAR pickle header lengths');
    }

    const dataBase = 8 + headerPayloadSize;
    if (dataBase > stat.size) {
      throw new Error('Corrupt ASAR header exceeds file size');
    }

    const jsonBuf = Buffer.alloc(stringLength);
    fs.readSync(fd, jsonBuf, 0, stringLength, 16);
    const header = JSON.parse(jsonBuf.toString('utf8'));

    if (!header || typeof header !== 'object' || !header.files) {
      throw new Error('Invalid ASAR header JSON structure');
    }

    return {
      asarPath,
      fileSize: stat.size,
      dataBase,
      header
    };
  } finally {
    fs.closeSync(fd);
  }
}

function findEntry(header, posixPath) {
  const parts = posixPath.split('/').filter(Boolean);
  let node = header;
  for (const part of parts) {
    if (!node || !node.files || !Object.prototype.hasOwnProperty.call(node.files, part)) {
      return null;
    }
    node = node.files[part];
  }
  return node;
}

/**
 * Reads a packed file buffer from an ASAR archive.
 *
 * @param {string} asarPath
 * @param {string} entryPath
 * @returns {Buffer}
 */
function readAsarFile(asarPath, entryPath) {
  const parsed = parseAsar(asarPath);
  const entry = findEntry(parsed.header, entryPath);
  if (!entry || entry.files) {
    throw new Error('File not found in ASAR: ' + entryPath);
  }
  if (entry.unpacked) {
    throw new Error('Entry is unpacked outside ASAR: ' + entryPath);
  }
  const offset = parsed.dataBase + Number(entry.offset);
  const out = Buffer.alloc(entry.size);
  const fd = fs.openSync(asarPath, 'r');
  try {
    const readBytes = fs.readSync(fd, out, 0, entry.size, offset);
    if (readBytes !== entry.size) {
      throw new Error('Short read for ' + entryPath + ': expected ' + entry.size + ', got ' + readBytes);
    }
    return out;
  } finally {
    fs.closeSync(fd);
  }
}

function collectPackedEntries(node, prefix, list) {
  if (!node || !node.files) return;
  for (const [name, child] of Object.entries(node.files)) {
    const rel = prefix ? prefix + '/' + name : name;
    if (child.files) {
      collectPackedEntries(child, rel, list);
    } else if (!child.unpacked && child.offset !== undefined) {
      list.push({ path: rel, entry: child, origOffset: Number(child.offset) });
    }
  }
}

/**
 * Repacks an ASAR archive with one or more replaced/added file buffers,
 * preserving all unpacked entries, executable flags, and recomputing SHA-256 integrity.
 *
 * @param {string} srcAsarPath
 * @param {Record<string, Buffer>} replacements
 * @param {string} destAsarPath
 */
function writePatchedAsar(srcAsarPath, replacements, destAsarPath) {
  const parsed = parseAsar(srcAsarPath);
  const nextHeader = JSON.parse(JSON.stringify(parsed.header));

  for (const [relPath, buf] of Object.entries(replacements)) {
    const parts = relPath.split('/').filter(Boolean);
    let curr = nextHeader;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (!curr.files[seg]) {
        curr.files[seg] = { files: {} };
      }
      curr = curr.files[seg];
    }
    const fileName = parts[parts.length - 1];
    const existing = curr.files[fileName] || {};
    curr.files[fileName] = {
      ...existing,
      size: buf.length,
      offset: existing.offset !== undefined ? existing.offset : '999999999999',
      integrity: computeIntegrity(buf)
    };
    delete curr.files[fileName].unpacked;
  }

  const packedEntries = [];
  collectPackedEntries(nextHeader, '', packedEntries);
  packedEntries.sort((a, b) => a.origOffset - b.origOffset);

  let nextOffset = 0;
  for (const item of packedEntries) {
    const replacementBuf = replacements[item.path];
    item.newOffset = nextOffset;
    item.newSize = replacementBuf ? replacementBuf.length : item.entry.size;
    item.entry.offset = String(nextOffset);
    item.entry.size = item.newSize;
    nextOffset += item.newSize;
  }

  const jsonBuf = Buffer.from(JSON.stringify(nextHeader), 'utf8');
  const alignedJsonLen = Math.ceil(jsonBuf.length / 4) * 4;
  const paddingLen = alignedJsonLen - jsonBuf.length;

  const pickle = Buffer.alloc(16);
  pickle.writeUInt32LE(4, 0);
  pickle.writeUInt32LE(alignedJsonLen + 8, 4);
  pickle.writeUInt32LE(alignedJsonLen + 4, 8);
  pickle.writeUInt32LE(jsonBuf.length, 12);

  const srcFd = fs.openSync(srcAsarPath, 'r');
  const destFd = fs.openSync(destAsarPath, 'w');
  try {
    fs.writeSync(destFd, pickle);
    fs.writeSync(destFd, jsonBuf);
    if (paddingLen > 0) {
      fs.writeSync(destFd, Buffer.alloc(paddingLen, 0));
    }

    const copyChunk = Buffer.allocUnsafe(64 * 1024);
    for (const item of packedEntries) {
      const replacementBuf = replacements[item.path];
      if (replacementBuf) {
        fs.writeSync(destFd, replacementBuf);
        continue;
      }
      let remaining = item.newSize;
      let readPos = parsed.dataBase + item.origOffset;
      while (remaining > 0) {
        const toRead = Math.min(remaining, copyChunk.length);
        const bytesRead = fs.readSync(srcFd, copyChunk, 0, toRead, readPos);
        if (bytesRead !== toRead) {
          throw new Error('Unexpected EOF reading ' + item.path + ' from source ASAR');
        }
        fs.writeSync(destFd, copyChunk, 0, bytesRead);
        readPos += bytesRead;
        remaining -= bytesRead;
      }
    }
  } finally {
    fs.closeSync(srcFd);
    fs.closeSync(destFd);
  }
}

/**
 * Verifies ASAR structure, total byte size, and SHA-256 integrity of every packed entry.
 *
 * @param {string} asarPath
 * @returns {{ ok: boolean, fileCount: number, totalPackedBytes: number }}
 */
function verifyAsar(asarPath) {
  const parsed = parseAsar(asarPath);
  const packedEntries = [];
  collectPackedEntries(parsed.header, '', packedEntries);
  packedEntries.sort((a, b) => a.origOffset - b.origOffset);

  const fd = fs.openSync(asarPath, 'r');
  try {
    let expectedOffset = 0;
    for (const item of packedEntries) {
      if (item.origOffset !== expectedOffset) {
        throw new Error(
          'Offset mismatch for ' + item.path + ': expected ' + expectedOffset + ', got ' + item.origOffset
        );
      }
      const buf = Buffer.alloc(item.entry.size);
      const readBytes = fs.readSync(fd, buf, 0, item.entry.size, parsed.dataBase + item.origOffset);
      if (readBytes !== item.entry.size) {
        throw new Error('Truncated file ' + item.path);
      }
      if (item.entry.integrity && item.entry.integrity.algorithm === 'SHA256') {
        const computed = computeIntegrity(buf);
        if (computed.hash !== item.entry.integrity.hash) {
          throw new Error('SHA-256 mismatch for ' + item.path);
        }
      }
      expectedOffset += item.entry.size;
    }

    if (parsed.dataBase + expectedOffset !== parsed.fileSize) {
      throw new Error(
        'ASAR size mismatch: expected ' + (parsed.dataBase + expectedOffset) + ', got ' + parsed.fileSize
      );
    }

    return {
      ok: true,
      fileCount: packedEntries.length,
      totalPackedBytes: expectedOffset
    };
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = {
  MOD_START_MARKER,
  computeIntegrity,
  parseAsar,
  readAsarFile,
  writePatchedAsar,
  verifyAsar
};
