import { fileExtension } from './package-core.js';

const WEBP_MIME = 'image/webp';
const JPEG_MIME = 'image/jpeg';
const JPEG_QUALITY = 0.92;
const JPEG_BACKGROUND = '#ffffff';

export function isWebpFile(file) {
  return file?.type?.toLowerCase() === WEBP_MIME || fileExtension(file?.name ?? '') === 'webp';
}

export async function normalizeCoverFile(file, {
  createImageBitmapImpl = globalThis.createImageBitmap,
  createCanvas = () => document.createElement('canvas'),
} = {}) {
  if (!isWebpFile(file)) return { blob: file, name: file.name };
  if (typeof createImageBitmapImpl !== 'function') throw new Error('此瀏覽器不支援 WebP 轉 JPEG。');

  const bitmap = await createImageBitmapImpl(file);
  try {
    const canvas = createCanvas();
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('無法建立封面轉檔畫布。');

    context.fillStyle = JPEG_BACKGROUND;
    context.fillRect(0, 0, bitmap.width, bitmap.height);
    context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error('WebP 封面轉 JPEG 失敗。'));
      }, JPEG_MIME, JPEG_QUALITY);
    });
    return { blob, name: 'cover.jpg' };
  } finally {
    bitmap.close?.();
  }
}
