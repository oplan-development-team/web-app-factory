import type { FrontLayer, OutputSize } from './types';
import { buildCroppedCanvas, scaleToWidth } from './image-utils';

export interface WorkingPair {
  top: HTMLCanvasElement;
  bottom: HTMLCanvasElement;
  maxOverlapPx: number;
}

/** Applies user crops and normalizes both shots to the same width. */
export function buildWorkingPair(
  topImage: HTMLImageElement,
  bottomImage: HTMLImageElement,
  topCut: number,
  bottomCut: number,
): WorkingPair {
  const topRaw = buildCroppedCanvas(topImage, topCut, 'bottom');
  const bottomRaw = buildCroppedCanvas(bottomImage, bottomCut, 'top');
  const targetWidth = topRaw.width;
  const top = topRaw;
  const bottom = scaleToWidth(bottomRaw, targetWidth);
  const maxOverlapPx = Math.floor(Math.min(top.height, bottom.height) * 0.95);
  return { top, bottom, maxOverlapPx };
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2Dコンテキストを取得できませんでした');
  return ctx;
}

export function computeOutputSize(pair: WorkingPair, overlapPx: number): OutputSize {
  const clampedOverlap = Math.max(0, Math.min(overlapPx, pair.maxOverlapPx));
  return {
    width: pair.top.width,
    height: pair.top.height + pair.bottom.height - clampedOverlap,
  };
}

/** Builds the final seamless composite, respecting which layer paints on top of the seam. */
export function composeNormal(
  pair: WorkingPair,
  overlapPx: number,
  frontLayer: FrontLayer,
): HTMLCanvasElement {
  const size = computeOutputSize(pair, overlapPx);
  const clampedOverlap = Math.max(0, Math.min(overlapPx, pair.maxOverlapPx));
  const bottomY = pair.top.height - clampedOverlap;

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = context2d(canvas);

  const drawTop = () => ctx.drawImage(pair.top, 0, 0);
  const drawBottom = () => ctx.drawImage(pair.bottom, 0, bottomY);

  if (frontLayer === 'top') {
    drawBottom();
    drawTop();
  } else {
    drawTop();
    drawBottom();
  }
  return canvas;
}

/**
 * Builds a verification view: the unique (non-overlapping) parts of each
 * shot render dimmed and desaturated for context, while the shared seam
 * band shows the absolute pixel difference between the two shots. A
 * perfectly aligned seam renders as flat black.
 */
export function composeDiff(pair: WorkingPair, overlapPx: number): HTMLCanvasElement {
  const size = computeOutputSize(pair, overlapPx);
  const clampedOverlap = Math.max(0, Math.min(overlapPx, pair.maxOverlapPx));
  const bottomY = pair.top.height - clampedOverlap;

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = context2d(canvas);

  ctx.save();
  ctx.filter = 'grayscale(1) brightness(0.55)';
  ctx.globalAlpha = 0.85;
  ctx.drawImage(pair.top, 0, 0);
  ctx.drawImage(pair.bottom, 0, bottomY);
  ctx.restore();

  if (clampedOverlap > 0) {
    const width = pair.top.width;
    const topTail = context2d(pair.top).getImageData(0, pair.top.height - clampedOverlap, width, clampedOverlap);
    const bottomHead = context2d(pair.bottom).getImageData(0, 0, width, clampedOverlap);
    const diff = ctx.createImageData(width, clampedOverlap);
    for (let i = 0; i < diff.data.length; i += 4) {
      diff.data[i] = Math.abs(topTail.data[i] - bottomHead.data[i]);
      diff.data[i + 1] = Math.abs(topTail.data[i + 1] - bottomHead.data[i + 1]);
      diff.data[i + 2] = Math.abs(topTail.data[i + 2] - bottomHead.data[i + 2]);
      diff.data[i + 3] = 255;
    }
    ctx.putImageData(diff, 0, bottomY);
  }

  return canvas;
}
