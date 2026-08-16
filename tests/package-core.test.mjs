import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGgrPackage, validatePackageInput } from '../package-core.js';

const encode = value => new TextEncoder().encode(value);

function readEntries(bytes) {
  const entries = new Map();
  let offset = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLength));
    entries.set(name, bytes.slice(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  return entries;
}

test('creates a minimal GGR archive with unmodified USC and audio', async () => {
  const usc = '{"usc":{"objects":[]}}';
  const blob = buildGgrPackage({
    uscBytes: encode(usc),
    audioBytes: Uint8Array.of(1, 2, 3),
    audioName: 'song.mp3',
    manifest: { format: 'gugarythm-package', version: 1, chart: 'chart.usc', audio: 'audio.mp3' },
  });
  const entries = readEntries(new Uint8Array(await blob.arrayBuffer()));
  assert.deepEqual([...entries.keys()], ['manifest.json', 'chart.usc', 'audio.mp3']);
  assert.equal(new TextDecoder().decode(entries.get('chart.usc')), usc);
});

test('includes optional metadata and cover', async () => {
  const blob = buildGgrPackage({
    uscBytes: encode('{"usc":{"objects":[]}}'),
    audioBytes: Uint8Array.of(0),
    audioName: 'song.ogg',
    metadataBytes: encode('{"genre":"electronic"}'),
    coverBytes: Uint8Array.of(137, 80, 78, 71),
    coverName: 'art.png',
    manifest: { format: 'gugarythm-package', version: 1, chart: 'chart.usc', audio: 'audio.ogg', metadata: 'metadata.json', cover: 'cover.png' },
  });
  assert.deepEqual([...readEntries(new Uint8Array(await blob.arrayBuffer())).keys()], ['manifest.json', 'chart.usc', 'audio.ogg', 'metadata.json', 'cover.png']);
});

test('rejects invalid USC and unsupported covers', () => {
  assert.throws(() => validatePackageInput({ uscText: 'not json', audioName: 'song.mp3' }), /USC/);
  assert.throws(() => validatePackageInput({ uscText: '{"usc":{"objects":[]}}', audioName: 'song.mp3', coverName: 'art.gif' }), /PNG、JPEG 或 WebP/);
});
