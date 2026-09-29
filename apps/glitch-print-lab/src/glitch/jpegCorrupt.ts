import { mulberry32 } from '../rng.ts';

export interface JpegCorruptParams {
  enabled: boolean;
  /** Percentage (0-100) of the scan-data region touched by corruption blocks. */
  rate: number;
  /** Number of contiguous bytes flipped together per corruption hit. */
  blockSize: number;
  seed: number;
}

export interface JpegCorruptResult {
  canvas: HTMLCanvasElement;
  error: string | null;
}

/**
 * Locates the start of the entropy-coded scan data of a JFIF/JPEG byte
 * stream: walks the marker segments from the SOI (0xFFD8) until it finds the
 * SOS marker (0xFFDA), then skips past that marker's own header (its 2-byte
 * length field covers the header only, not the scan data that follows it).
 */
function findScanDataStart(bytes: Uint8Array): number {
  let i = 2; // skip SOI (0xFFD8)
  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1] ?? 0;
    // Markers with no payload/length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9) {
      // Hit EOI before ever finding SOS — malformed stream.
      return -1;
    }
    if (i + 3 >= bytes.length) return -1;
    const segmentLength = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
    if (marker === 0xda) {
      // segmentLength covers the SOS header (component selectors etc.), NOT
      // the entropy-coded scan bytes. Data starts right after it.
      return i + 2 + segmentLength;
    }
    i += 2 + segmentLength;
  }
  return -1;
}

/**
 * Finds the End-Of-Image marker (0xFFD9) starting the search at `from`.
 * Real encoders byte-stuff any literal 0xFF occurring inside entropy-coded
 * data as 0xFF 0x00, so a literal 0xFF followed by 0xD9 inside genuine scan
 * data cannot occur — the first match found scanning forward is the true EOI.
 */
function findScanDataEnd(bytes: Uint8Array, from: number): number {
  for (let i = from; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) return i;
  }
  return bytes.length;
}

function canvasToJpegArrayBuffer(canvas: HTMLCanvasElement, quality = 0.92): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('JPEGエンコードに失敗しました（toBlobがnullを返しました）。'));
          return;
        }
        blob
          .arrayBuffer()
          .then(resolve)
          .catch(() => reject(new Error('JPEGバッファの取得に失敗しました。')));
      },
      'image/jpeg',
      quality,
    );
  });
}

/**
 * The core differentiator of this lab: takes a canvas, actually re-encodes
 * it as a real JPEG, locates the entropy-coded scan-data region by walking
 * the marker structure, and directly overwrites raw bytes inside that
 * region with pseudo-random garbage — a genuine binary corruption, not a
 * simulated/shader effect. The corrupted buffer is then handed back to the
 * browser's own JPEG decoder via createImageBitmap(); if the decoder can't
 * make sense of what's left, that failure is surfaced as a real error
 * rather than swallowed.
 */
export async function applyJpegByteCorruption(
  sourceCanvas: HTMLCanvasElement,
  params: JpegCorruptParams,
): Promise<JpegCorruptResult> {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  if (!params.enabled || params.rate <= 0) {
    return { canvas: sourceCanvas, error: null };
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await canvasToJpegArrayBuffer(sourceCanvas);
  } catch (err) {
    return {
      canvas: sourceCanvas,
      error: err instanceof Error ? err.message : 'JPEGエンコードに失敗しました。',
    };
  }

  const bytes = new Uint8Array(buffer);
  const scanStart = findScanDataStart(bytes);
  if (scanStart < 0) {
    return { canvas: sourceCanvas, error: 'SOSマーカーが見つからず、スキャン領域を特定できませんでした。' };
  }
  const scanEnd = findScanDataEnd(bytes, scanStart);
  const scanLength = scanEnd - scanStart;
  if (scanLength <= 0) {
    return { canvas: sourceCanvas, error: 'スキャンデータ領域が空でした。' };
  }

  const blockSize = Math.max(1, Math.min(params.blockSize, scanLength));
  const rate = Math.min(100, Math.max(0, params.rate));
  const numBlocks = Math.max(1, Math.floor(((scanLength / blockSize) * rate) / 100));
  const rng = mulberry32(params.seed);

  for (let b = 0; b < numBlocks; b++) {
    const maxStart = Math.max(scanStart, scanEnd - blockSize);
    const blockStart = scanStart + Math.floor(rng() * Math.max(1, maxStart - scanStart));
    for (let j = 0; j < blockSize && blockStart + j < scanEnd; j++) {
      // Overwrite values are clamped to 0x00-0xFE. Writing a literal 0xFF
      // risks accidentally forming a new marker prefix right where we
      // stand; real markers still lurk elsewhere in the corrupted region
      // (from bytes we didn't touch) which is exactly what produces
      // authentic — sometimes fatal — decode corruption.
      bytes[blockStart + j] = Math.floor(rng() * 255); // 0-254
    }
  }

  let bitmap: ImageBitmap;
  try {
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    bitmap = await createImageBitmap(blob);
  } catch {
    return {
      canvas: sourceCanvas,
      error:
        'RE-DECODE FAILED: 破壊率が強すぎてデコーダがビットストリームを復元できませんでした。BYTE CORRUPTION RATEを下げるか、CORRUPTION BLOCK SIZEを小さくして再試行してください。',
    };
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) {
    return { canvas: sourceCanvas, error: 'Canvas 2Dコンテキストを取得できませんでした。' };
  }
  ctx.imageSmoothingEnabled = false;
  // The decoded bitmap may differ in size from a fully-decoded frame when
  // the stream broke early; draw it stretched to the working canvas size so
  // downstream layers keep operating on a consistent frame.
  ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, width, height);
  bitmap.close();

  return { canvas: outCanvas, error: null };
}
