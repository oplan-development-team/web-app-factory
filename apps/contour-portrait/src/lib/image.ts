import { ACCEPTED_TYPES, GRID_H, GRID_W, MAX_UPLOAD_BYTES } from './constants';
import type { SourceImage } from '../types';

export class UploadError extends Error {}

export function validateFile(file: File): void {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new UploadError(
      `対応していないファイル形式です（${file.type || '不明な形式'}）。JPEG / PNG / WebP のいずれかを使用してください。`,
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new UploadError(
      `ファイルサイズが上限を超えています（${mb}MB / 上限10MB）。画像を圧縮するか、別のファイルを選択してください。`,
    );
  }
}

export function loadImageFile(file: File): Promise<SourceImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ fileName: file.name, width: img.naturalWidth, height: img.naturalHeight, element: img });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new UploadError('画像を読み込めませんでした。ファイルが破損している可能性があります。'));
    };
    img.src = url;
  });
}

/**
 * Draws the source image into the fixed working grid using a "cover" fit
 * (scaled to fill GRID_W x GRID_H, centered, cropping overflow), then
 * returns the luminance (0-255) of every cell as a flat row-major array.
 */
export function toLuminanceGrid(source: SourceImage): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = GRID_W;
  canvas.height = GRID_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context is unavailable in this browser.');

  const srcRatio = source.width / source.height;
  const dstRatio = GRID_W / GRID_H;
  let drawW: number;
  let drawH: number;
  if (srcRatio > dstRatio) {
    drawH = GRID_H;
    drawW = GRID_H * srcRatio;
  } else {
    drawW = GRID_W;
    drawH = GRID_W / srcRatio;
  }
  const dx = (GRID_W - drawW) / 2;
  const dy = (GRID_H - drawH) / 2;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, GRID_W, GRID_H);
  ctx.drawImage(source.element, dx, dy, drawW, drawH);

  const { data } = ctx.getImageData(0, 0, GRID_W, GRID_H);
  const grid = new Float32Array(GRID_W * GRID_H);
  for (let i = 0, p = 0; i < grid.length; i++, p += 4) {
    // Rec. 601 perceptual luminance weighting.
    grid[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return grid;
}

/**
 * Three-pass box blur approximates a gaussian blur cheaply on the flat
 * luminance grid. `strength` is a 0-10 UI dial mapped to a blur radius.
 */
export function blurGrid(grid: Float32Array, width: number, height: number, strength: number): Float32Array {
  const radius = Math.round(strength * 1.6);
  if (radius <= 0) return grid;
  let src = grid;
  for (let pass = 0; pass < 3; pass++) {
    src = boxBlurPass(src, width, height, radius);
  }
  return src;
}

function boxBlurPass(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  const horizontal = new Float32Array(src.length);
  const win = radius * 2 + 1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let acc = 0;
    for (let x = -radius; x <= radius; x++) {
      acc += src[row + clamp(x, 0, width - 1)];
    }
    for (let x = 0; x < width; x++) {
      horizontal[row + x] = acc / win;
      const nextIn = clamp(x + radius + 1, 0, width - 1);
      const nextOut = clamp(x - radius, 0, width - 1);
      acc += src[row + nextIn] - src[row + nextOut];
    }
  }
  const out = new Float32Array(src.length);
  for (let x = 0; x < width; x++) {
    let acc = 0;
    for (let y = -radius; y <= radius; y++) {
      acc += horizontal[clamp(y, 0, height - 1) * width + x];
    }
    for (let y = 0; y < height; y++) {
      out[y * width + x] = acc / win;
      const nextIn = clamp(y + radius + 1, 0, height - 1);
      const nextOut = clamp(y - radius, 0, height - 1);
      acc += horizontal[nextIn * width + x] - horizontal[nextOut * width + x];
    }
  }
  return out;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
