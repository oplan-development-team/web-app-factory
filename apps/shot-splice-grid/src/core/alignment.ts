import type { AlignmentResult } from './types';
import { type GrayImage, toGrayscale, toGrayscaleFullHeight } from './image-utils';

const COARSE_WIDTH = 100;
const MAX_COARSE_CANDIDATES = 4000;
const FINE_WINDOW_PADDING = 4;

/**
 * Mean absolute per-pixel luminance difference between the tail `h` rows of
 * `top` and the head `h` rows of `bottom`. Both images must share width.
 * Lower is a better match; a perfect seam approaches 0.
 */
function overlapCost(top: GrayImage, bottom: GrayImage, h: number): number {
  const width = top.width;
  const topStart = (top.height - h) * width;
  const pixels = h * width;
  let sum = 0;
  for (let i = 0; i < pixels; i += 1) {
    sum += Math.abs(top.data[topStart + i] - bottom.data[i]);
  }
  return pixels > 0 ? sum / pixels : Infinity;
}

/** Finds the best-cost overlap height by scanning a candidate list. */
function searchBest(top: GrayImage, bottom: GrayImage, candidates: number[]): { h: number; cost: number } {
  let bestH = candidates[0] ?? 0;
  let bestCost = Infinity;
  for (const h of candidates) {
    if (h < 1 || h > top.height || h > bottom.height) continue;
    const cost = overlapCost(top, bottom, h);
    if (cost < bestCost) {
      bestCost = cost;
      bestH = h;
    }
  }
  return { h: bestH, cost: bestCost };
}

/**
 * Two-stage coarse-to-fine search for the vertical overlap between two
 * already-cropped, width-matched screenshot canvases.
 *
 * Stage 1 scans the *entire* candidate range cheaply by squashing width
 * only (never height) into a narrow grayscale strip — this keeps every row
 * position intact, which matters because a genuinely matching seam can be
 * an exact single-pixel spike (cost collapses to ~0 only at the true
 * offset); averaging rows together while downscaling height would blur
 * that spike into its neighbors and could point the search at the wrong
 * offset entirely. The stride adapts so very tall screenshots still finish
 * in bounded time.
 *
 * Stage 2 re-scores a narrow window around the stage 1 estimate at full
 * resolution to remove any residual bias from the coarse width squash.
 */
export function detectOverlap(
  topCanvas: HTMLCanvasElement,
  bottomCanvas: HTMLCanvasElement,
): AlignmentResult {
  const maxOverlapPx = Math.floor(Math.min(topCanvas.height, bottomCanvas.height) * 0.95);
  if (maxOverlapPx < 2) {
    return { overlapPx: Math.max(0, maxOverlapPx), cost: Infinity, maxOverlapPx };
  }

  const coarseTop = toGrayscaleFullHeight(topCanvas, COARSE_WIDTH);
  const coarseBottom = toGrayscaleFullHeight(bottomCanvas, COARSE_WIDTH);
  const coarseStride = Math.max(1, Math.ceil(maxOverlapPx / MAX_COARSE_CANDIDATES));
  const coarseCandidates: number[] = [];
  for (let h = 1; h <= maxOverlapPx; h += coarseStride) coarseCandidates.push(h);
  const coarse = searchBest(coarseTop, coarseBottom, coarseCandidates);

  const fineTop = toGrayscale(topCanvas);
  const fineBottom = toGrayscale(bottomCanvas);
  const windowMargin = coarseStride + FINE_WINDOW_PADDING;
  const lo = Math.max(1, coarse.h - windowMargin);
  const hi = Math.min(maxOverlapPx, coarse.h + windowMargin);
  const fineCandidates: number[] = [];
  for (let h = lo; h <= hi; h += 1) fineCandidates.push(h);
  const fine = searchBest(fineTop, fineBottom, fineCandidates.length > 0 ? fineCandidates : [coarse.h]);

  return { overlapPx: fine.h, cost: fine.cost, maxOverlapPx };
}
