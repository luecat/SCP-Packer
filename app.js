const $ = (selector) => document.querySelector(selector);
const encoder = new TextEncoder();
const status = $("#status");
const packButton = $("#pack");

for (const input of document.querySelectorAll('input[type="file"]')) {
  input.addEventListener('change', () => {
    const zone = input.closest('.drop-zone');
    const output = zone.querySelector('output');
    const file = input.files[0];
    zone.classList.toggle('has-file', Boolean(file));
    output.textContent = file ? file.name : '選擇檔案';
  });
}

function filenameSafe(value) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'chart';
}

function randomId() {
  return `local-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

async function sha1(bytes) {
  const hash = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function gzip(bytes) {
  if (!('CompressionStream' in window)) throw new Error('此瀏覽器不支援 CompressionStream，請使用最新版 Chrome、Edge 或 Safari。');
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function isGzip(bytes) { return bytes[0] === 0x1f && bytes[1] === 0x8b; }

function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function dataField(name, value) { return { name, value }; }
function uscNote(item, kind, index) {
  const critical = item.critical === true;
  const flick = item.direction !== undefined && item.direction !== null;
  const trace = item.trace === true || kind === 'tick';
  const archetype = `${critical ? 'Critical' : ''}USC${trace ? 'Trace' : ''}${flick ? 'Flick' : kind === 'end' ? 'SlideEnd' : kind === 'start' ? 'SlideStart' : 'Tap'}Note`;
  return {
    name: `usc-note-${index}`, archetype,
    data: [dataField('#BEAT', finite(item.beat)), dataField('lane', finite(item.lane)), dataField('size', Math.max(.25, finite(item.size, 1))), dataField('direction', flickDirection(item.direction))]
  };
}
function flickDirection(value) {
  if (value === 'left') return -1; if (value === 'right') return 1;
  return Math.max(-1, Math.min(1, finite(value)));
}
function uscToLevelData(root) {
  const usc = root?.usc;
  if (!usc || !Array.isArray(usc.objects)) throw new Error('USC 缺少 usc.objects 陣列。');
  const entities = []; let index = 0;
  for (const object of usc.objects) {
    if (object.type === 'bpm') entities.push({ archetype: '#BPM_CHANGE', data: [dataField('#BEAT', finite(object.beat)), dataField('#BPM', Math.max(1, finite(object.bpm, 120)))] });
    if (object.type === 'single' || object.type === 'damage') entities.push(uscNote(object, 'single', index++));
    if (object.type === 'slide' && Array.isArray(object.connections)) {
      const visible = object.connections.filter(point => point.judgeType !== 'none' || point.direction !== undefined && point.direction !== null);
      const points = visible.map((point, pointIndex) => uscNote({ ...object, ...point, critical: point.critical ?? object.critical }, point.type === 'start' ? 'start' : point.type === 'end' ? 'end' : 'tick', index++));
      entities.push(...points);
      for (let i = 1; i < points.length; i++) entities.push({ archetype: 'USCSlideConnector', data: [], refs: [{ name: 'start', ref: points[i - 1].name }, { name: 'end', ref: points[i].name }, { name: 'head', ref: points[i - 1].name }, { name: 'tail', ref: points[i].name }] });
    }
  }
  if (!entities.some(entity => entity.archetype === '#BPM_CHANGE')) entities.unshift({ archetype: '#BPM_CHANGE', data: [dataField('#BEAT', 0), dataField('#BPM', 120)] });
  return { bgmOffset: finite(usc.offset) + finite($('#offset').value), entities };
}

// Small dependency-free ZIP writer. SCP readers accept stored entries; gzip is
// still used for LevelData as required by the Sonolus collection format.
const crcTable = (() => { const table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } return table; })();
function crc32(bytes) { let c = 0xffffffff; for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function u16(view, at, value) { view.setUint16(at, value, true); }
function u32(view, at, value) { view.setUint32(at, value >>> 0, true); }
function zip(entries) {
  let offset = 0; const chunks = []; const directory = [];
  for (const entry of entries) {
    const name = encoder.encode(entry.name); const data = entry.data; const crc = crc32(data);
    const local = new Uint8Array(30 + name.length); const view = new DataView(local.buffer);
    u32(view, 0, 0x04034b50); u16(view, 4, 20); u16(view, 8, 0); u32(view, 14, crc); u32(view, 18, data.length); u32(view, 22, data.length); u16(view, 26, name.length);
    local.set(name, 30); chunks.push(local, data);
    directory.push({ name, data, crc, offset }); offset += local.length + data.length;
  }
  const centralStart = offset;
  for (const entry of directory) {
    const central = new Uint8Array(46 + entry.name.length); const view = new DataView(central.buffer);
    u32(view, 0, 0x02014b50); u16(view, 4, 20); u16(view, 6, 20); u32(view, 16, entry.crc); u32(view, 20, entry.data.length); u32(view, 24, entry.data.length); u16(view, 28, entry.name.length); u32(view, 42, entry.offset); central.set(entry.name, 46);
    chunks.push(central); offset += central.length;
  }
  const end = new Uint8Array(22); const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50); u16(endView, 8, directory.length); u16(endView, 10, directory.length); u32(endView, 12, offset - centralStart); u32(endView, 16, centralStart); chunks.push(end);
  return new Blob(chunks, { type: 'application/octet-stream' });
}

function resource(hash) { return { hash, url: `/sonolus/repository/${hash}` }; }

packButton.addEventListener('click', async () => {
  const uscFile = $('#usc').files[0];
  const bgmFile = $('#bgm').files[0];
  const title = $('#title').value.trim();
  if (!uscFile) { status.textContent = '請先選擇 USC 譜面。'; return; }
  if (!bgmFile) { status.textContent = '請先選擇 BGM。'; return; }
  if (!title) { status.textContent = '請填寫曲名。'; $('#title').focus(); return; }
  try {
    packButton.disabled = true; packButton.innerHTML = '<span>↻</span> 正在打包…'; status.textContent = '正在建立資源雜湊與 SCP 封包…';
    let uscRoot;
    try { uscRoot = JSON.parse(await uscFile.text()); } catch { throw new Error('USC 不是有效的 JSON 檔案。'); }
    const packedLevel = await gzip(encoder.encode(JSON.stringify(uscToLevelData(uscRoot))));
    const levelHash = await sha1(packedLevel);
    const levelName = randomId();
    const entries = [{ name: 'sonolus/package', data: encoder.encode('{"shouldUpdate":false}') }, { name: `sonolus/repository/${levelHash}`, data: packedLevel }];
    const item = { name: levelName, version: 1, rating: Number($('#rating').value) || 0, title, artists: $('#artist').value.trim(), author: $('#author').value.trim(), tags: [], engine: { name: 'usc-local', version: 1, title: 'USC Local', subtitle: 'Packed locally', author: 'SCP Packer', tags: [] }, data: resource(levelHash) };
    { const bytes = new Uint8Array(await bgmFile.arrayBuffer()); const hash = await sha1(bytes); entries.push({ name: `sonolus/repository/${hash}`, data: bytes }); item.bgm = resource(hash); }
    const detail = encoder.encode(JSON.stringify({ item }));
    entries.push({ name: `sonolus/levels/${levelName}`, data: detail });
    const blob = zip(entries); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${filenameSafe(title)}.scp`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `完成：已建立 ${entries.length} 個資源的 SCP 封包（${(blob.size / 1024 / 1024).toFixed(2)} MB）。`;
  } catch (error) { console.error(error); status.textContent = `打包失敗：${error.message || error}`; }
  finally { packButton.disabled = false; packButton.innerHTML = '<span>↓</span> 下載 SCP 封包'; }
});
