/**
 * Overlap detection between two vertically-adjacent screenshots.
 *
 * Approach: convert both images to downscaled grayscale row buffers, then
 * search for the overlap width (rows shared between the bottom of image A
 * and the top of image B) that minimises the mean absolute pixel
 * difference. A brute-force search at full resolution is too slow for large
 * screenshots, so the search runs in two passes:
 *
 *   1. Coarse pass — a small thumbnail (fixed width) is searched across the
 *      full candidate range to find an approximate overlap.
 *   2. Fine pass — a larger-resolution render is searched only in a narrow
 *      window around the coarse guess, at single-pixel precision (mapped
 *      back to original-image pixel units).
 */

export interface GrayscaleImage {
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array;
}

export interface AlignmentResult {
  readonly overlapPx: number;
  /** Mean absolute grayscale difference per pixel in the matched band (0 = identical). */
  readonly score: number;
}

const COARSE_WIDTH = 120;
const FINE_WIDTH = 480;
const MIN_OVERLAP_PX = 4;

function toGrayscale(source: CanvasImageSource, width: number, height: number): GrayscaleImage {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D コンテキストを取得できませんでした');
  }
  ctx.drawImage(source, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4] ?? 0;
    const g = data[i * 4 + 1] ?? 0;
    const b = data[i * 4 + 2] ?? 0;
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return { width, height, data: gray };
}

/** Mean absolute difference between A's bottom `rows` rows and B's top `rows` rows. */
function bandDifference(a: GrayscaleImage, b: GrayscaleImage, rows: number): number {
  const width = Math.min(a.width, b.width);
  const aStartRow = a.height - rows;
  let sum = 0;
  for (let r = 0; r < rows; r++) {
    const aRowOffset = (aStartRow + r) * a.width;
    const bRowOffset = r * b.width;
    for (let c = 0; c < width; c++) {
      sum += Math.abs((a.data[aRowOffset + c] ?? 0) - (b.data[bRowOffset + c] ?? 0));
    }
  }
  return sum / (rows * width);
}

interface SearchResult {
  overlap: number;
  score: number;
}

function searchOverlap(a: GrayscaleImage, b: GrayscaleImage, minOverlap: number, maxOverlap: number, step: number): SearchResult {
  let best: SearchResult = { overlap: minOverlap, score: Infinity };
  const ceiling = Math.min(maxOverlap, a.height, b.height);
  for (let overlap = minOverlap; overlap <= ceiling; overlap += step) {
    const score = bandDifference(a, b, overlap);
    if (score < best.score) {
      best = { overlap, score };
    }
  }
  return best;
}

/**
 * Detects the vertical overlap (in original-image pixels) between the
 * bottom of `imgA` and the top of `imgB`.
 */
export function detectOverlap(imgA: HTMLImageElement, imgB: HTMLImageElement): AlignmentResult {
  const referenceWidth = Math.min(imgA.naturalWidth, imgB.naturalWidth);
  const maxOverlapOriginal = Math.min(imgA.naturalHeight, imgB.naturalHeight);

  if (referenceWidth <= 0 || maxOverlapOriginal <= 0) {
    return { overlapPx: 0, score: Infinity };
  }

  // --- Pass 1: coarse, full-range search on a small thumbnail ---
  const coarseScale = COARSE_WIDTH / referenceWidth;
  const coarseA = toGrayscale(imgA, COARSE_WIDTH, Math.max(1, Math.round(imgA.naturalHeight * coarseScale)));
  const coarseB = toGrayscale(imgB, COARSE_WIDTH, Math.max(1, Math.round(imgB.naturalHeight * coarseScale)));
  const coarseCeiling = Math.min(coarseA.height, coarseB.height);
  const coarseStep = Math.max(1, Math.floor(coarseCeiling / 90));
  const coarse = searchOverlap(coarseA, coarseB, 1, coarseCeiling, coarseStep);
  const coarseOverlapOriginal = Math.round(coarse.overlap / coarseScale);

  // --- Pass 2: fine, narrow-window search on a larger render ---
  const fineScale = FINE_WIDTH / referenceWidth;
  const fineA = toGrayscale(imgA, FINE_WIDTH, Math.max(1, Math.round(imgA.naturalHeight * fineScale)));
  const fineB = toGrayscale(imgB, FINE_WIDTH, Math.max(1, Math.round(imgB.naturalHeight * fineScale)));

  const windowOriginal = Math.max(24, Math.round(maxOverlapOriginal * 0.04));
  const fineMinOriginal = Math.max(MIN_OVERLAP_PX, coarseOverlapOriginal - windowOriginal);
  const fineMaxOriginal = Math.min(maxOverlapOriginal, coarseOverlapOriginal + windowOriginal);
  const fineMin = Math.max(1, Math.round(fineMinOriginal * fineScale));
  const fineMax = Math.round(fineMaxOriginal * fineScale);

  const fine = searchOverlap(fineA, fineB, fineMin, Math.max(fineMin, fineMax), 1);
  const overlapPx = Math.min(maxOverlapOriginal, Math.max(0, Math.round(fine.overlap / fineScale)));

  return { overlapPx, score: fine.score };
}
