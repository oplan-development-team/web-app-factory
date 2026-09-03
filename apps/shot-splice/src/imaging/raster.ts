import type { GrayImage } from '../core/types';
import { type CanvasFactory, type CanvasLike, context2d, createCanvas } from './surface';

/** ITU-R BT.601 luma weights — the same basis the prototypes used. */
export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Rasterises an image at a target size and returns its luminance buffer.
 *
 * Width normalisation happens here rather than in a separate pass so that a
 * shot that arrived at a different resolution is only resampled once.
 */
export function imageToGray(
  source: CanvasImageSource,
  width: number,
  height: number,
  factory: CanvasFactory = createCanvas,
): GrayImage {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const canvas = factory(w, h);
  canvas.width = w;
  canvas.height = h;
  const ctx = context2d(canvas, true);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(source, 0, 0, w, h, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; p < gray.length; i += 4, p += 1) {
    gray[p] = luminance(data[i] as number, data[i + 1] as number, data[i + 2] as number);
  }
  return { data: gray, width: w, height: h };
}

/**
 * Average colour of an image, sampled from a tiny downscale.
 *
 * Used to tint the glow behind the preview stage so the interface responds to
 * the material the user actually loaded.
 */
export function averageColor(
  source: CanvasImageSource,
  factory: CanvasFactory = createCanvas,
): { r: number; g: number; b: number } {
  const size = 8;
  const canvas = factory(size, size);
  canvas.width = size;
  canvas.height = size;
  const ctx = context2d(canvas, true);
  ctx.drawImage(source, 0, 0, size, size, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  let r = 0;
  let g = 0;
  let b = 0;
  const count = size * size;
  for (let i = 0; i < count; i += 1) {
    r += data[i * 4] as number;
    g += data[i * 4 + 1] as number;
    b += data[i * 4 + 2] as number;
  }
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
}

/** Reads a canvas back as a luminance buffer (used by the seam loupe). */
export function canvasToGray(canvas: CanvasLike): GrayImage {
  const ctx = context2d(canvas, true);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0, p = 0; p < gray.length; i += 4, p += 1) {
    gray[p] = luminance(data[i] as number, data[i + 1] as number, data[i + 2] as number);
  }
  return { data: gray, width: canvas.width, height: canvas.height };
}
