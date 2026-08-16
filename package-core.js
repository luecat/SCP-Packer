const encoder = new TextEncoder();

const audioExtensions = new Set(['mp3', 'ogg', 'wav', 'm4a', 'aac', 'flac']);
const coverExtensions = new Set(['png', 'jpg', 'jpeg', 'webp']);

function extensionOf(name) {
  const match = /\.([^.]+)$/.exec(name.trim());
  return match ? match[1].toLowerCase() : '';
}

function assertExtension(name, extensions, label) {
  if (!extensions.has(extensionOf(name))) throw new Error(`${label}格式不支援。`);
}

export function validatePackageInput({ uscText, audioName, coverName }) {
  try {
    const usc = JSON.parse(uscText);
    if (!usc?.usc || !Array.isArray(usc.usc.objects)) throw new Error();
  } catch {
    throw new Error('USC 不是有效的 USC JSON 檔案。');
  }
  assertExtension(audioName, audioExtensions, '音樂');
  if (coverName) assertExtension(coverName, coverExtensions, '封面僅支援 PNG、JPEG 或 WebP。');
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function u16(view, offset, value) { view.setUint16(offset, value, true); }
function u32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }

function zip(entries) {
  let offset = 0;
  const chunks = [];
  const directory = [];
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    u32(view, 0, 0x04034b50);
    u16(view, 4, 20);
    u32(view, 14, crc);
    u32(view, 18, data.length);
    u32(view, 22, data.length);
    u16(view, 26, name.length);
    local.set(name, 30);
    chunks.push(local, data);
    directory.push({ name, data, crc, offset });
    offset += local.length + data.length;
  }
  const centralStart = offset;
  for (const entry of directory) {
    const central = new Uint8Array(46 + entry.name.length);
    const view = new DataView(central.buffer);
    u32(view, 0, 0x02014b50);
    u16(view, 4, 20);
    u16(view, 6, 20);
    u32(view, 16, entry.crc);
    u32(view, 20, entry.data.length);
    u32(view, 24, entry.data.length);
    u16(view, 28, entry.name.length);
    u32(view, 42, entry.offset);
    central.set(entry.name, 46);
    chunks.push(central);
    offset += central.length;
  }
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  u32(view, 0, 0x06054b50);
  u16(view, 8, directory.length);
  u16(view, 10, directory.length);
  u32(view, 12, offset - centralStart);
  u32(view, 16, centralStart);
  chunks.push(end);
  return new Blob(chunks, { type: 'application/zip' });
}

export function buildGgrPackage({ uscBytes, audioBytes, audioName, manifest, metadataBytes, coverBytes, coverName }) {
  const audioExtension = extensionOf(audioName);
  const entries = [
    { name: 'manifest.json', data: encoder.encode(JSON.stringify(manifest, null, 2)) },
    { name: 'chart.usc', data: uscBytes },
    { name: `audio.${audioExtension}`, data: audioBytes },
  ];
  if (metadataBytes) entries.push({ name: 'metadata.json', data: metadataBytes });
  if (coverBytes) entries.push({ name: `cover.${extensionOf(coverName)}`, data: coverBytes });
  return zip(entries);
}

export function fileExtension(name) {
  return extensionOf(name);
}
