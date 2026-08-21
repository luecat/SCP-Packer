import assert from 'node:assert/strict';
import test from 'node:test';

import { isWebpFile, normalizeCoverFile } from '../cover-conversion.js';

test('recognizes WebP covers even when the browser omits the MIME type', () => {
  assert.equal(isWebpFile({ name: 'art.WEBP', type: '' }), true);
  assert.equal(isWebpFile({ name: 'art.bin', type: 'image/webp' }), true);
  assert.equal(isWebpFile({ name: 'art.png', type: 'image/png' }), false);
});

test('flattens a WebP cover onto white and returns a JPEG asset', async () => {
  const drawCalls = [];
  let closed = false;
  let requestedType = '';
  let requestedQuality = 0;
  const bitmap = {
    width: 320,
    height: 180,
    close() {
      closed = true;
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext() {
      return {
        fillStyle: '',
        fillRect(...args) {
          drawCalls.push(['fillRect', ...args]);
        },
        drawImage(...args) {
          drawCalls.push(['drawImage', ...args]);
        },
      };
    },
    toBlob(callback, type, quality) {
      requestedType = type;
      requestedQuality = quality;
      callback(new Blob(['jpeg-bytes'], { type }));
    },
  };

  const result = await normalizeCoverFile(
    { name: 'art.webp', type: 'image/webp' },
    {
      createImageBitmapImpl: async () => bitmap,
      createCanvas: () => canvas,
    },
  );

  assert.equal(result.name, 'cover.jpg');
  assert.equal(result.blob.type, 'image/jpeg');
  assert.equal(requestedType, 'image/jpeg');
  assert.equal(requestedQuality, 0.92);
  assert.deepEqual(drawCalls, [
    ['fillRect', 0, 0, 320, 180],
    ['drawImage', bitmap, 0, 0, 320, 180],
  ]);
  assert.equal(closed, true);
});

test('keeps non-WebP cover files unchanged', async () => {
  const file = { name: 'art.png', type: 'image/png' };
  const result = await normalizeCoverFile(file);
  assert.equal(result.name, 'art.png');
  assert.equal(result.blob, file);
});
