import { buildGgrPackage, fileExtension, validatePackageInput } from './package-core.js';

const $ = selector => document.querySelector(selector);
const status = $('#status');
const packButton = $('#pack');
const encoder = new TextEncoder();

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

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function requiredFile(selector, message) {
  const file = $(selector).files[0];
  if (!file) throw new Error(message);
  return file;
}

packButton.addEventListener('click', async () => {
  try {
    const uscFile = requiredFile('#usc', '請先選擇 USC 譜面。');
    const audioFile = requiredFile('#bgm', '請先選擇音樂檔案。');
    const title = $('#title').value.trim();
    const coverFile = $('#cover').files[0];
    if (!title) throw new Error('請填寫曲名。');
    packButton.disabled = true;
    packButton.innerHTML = '<span>↻</span> 正在打包…';
    status.textContent = '正在建立 Gugarythm 封包…';

    const uscText = await uscFile.text();
    validatePackageInput({ uscText, audioName: audioFile.name, coverName: coverFile?.name });
    const audioExtension = fileExtension(audioFile.name);
    const coverExtension = coverFile ? fileExtension(coverFile.name) : '';
    const manifest = {
      format: 'gugarythm-package', version: 1, title,
      artist: $('#artist').value.trim(), author: $('#author').value.trim(),
      rating: finite($('#rating').value), offset: finite($('#offset').value),
      chart: 'chart.usc', audio: `audio.${audioExtension}`, metadata: 'metadata.json',
      ...(coverFile && { cover: `cover.${coverExtension}` }),
    };
    const metadataBytes = encoder.encode(JSON.stringify({
      title: manifest.title, artist: manifest.artist, author: manifest.author,
      rating: manifest.rating, offset: manifest.offset,
    }, null, 2));
    const blob = buildGgrPackage({
      uscBytes: encoder.encode(uscText),
      audioBytes: new Uint8Array(await audioFile.arrayBuffer()), audioName: audioFile.name,
      metadataBytes, coverBytes: coverFile && new Uint8Array(await coverFile.arrayBuffer()),
      coverName: coverFile?.name, manifest,
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${filenameSafe(title)}.ggr`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const entryCount = 4 + Number(Boolean(coverFile));
    status.textContent = `完成：已建立 ${entryCount} 個資源的 GGR 封包（${(blob.size / 1024 / 1024).toFixed(2)} MB）。`;
  } catch (error) {
    console.error(error);
    status.textContent = `打包失敗：${error.message || error}`;
  } finally {
    packButton.disabled = false;
    packButton.innerHTML = '<span>↓</span> 下載 GGR 封包';
  }
});
