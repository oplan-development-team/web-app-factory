import { DEFAULT_ROW_SAMPLES, seamCost } from './gray';
import type { AlignmentResult, GrayImage } from './types';

/** Shorter overlaps are too easy to match by accident, so the search ignores them. */
export const MIN_OVERLAP_PX = 8;

/** Two shots can never share more than this fraction of the shorter one. */
export const MAX_OVERLAP_RATIO = 0.95;

/** Mean absolute luminance difference above which a candidate seam is not believable. */
export const MATCH_COST_THRESHOLD = 12;

/** Upper bound on how many offsets the coarse pass evaluates. */
export const MAX_COARSE_CANDIDATES = 4000;

/** Extra offsets scanned either side of the coarse winner during the fine pass. */
const FINE_WINDOW_PADDING = 4;

export interface DetectOverlapInput {
  /** Width-squashed, full-height pair used for the coarse sweep. */
  readonly coarseUpper: GrayImage;
  readonly coarseLower: GrayImage;
  /** Full-resolution pair used to settle the exact offset. */
  readonly fineUpper: GrayImage;
  readonly fineLower: GrayImage;
  readonly maxOverlapPx?: number;
  readonly minOverlapPx?: number;
  readonly matchCostThreshold?: number;
  readonly rowBudget?: number;
}

interface Candidate {
  readonly h: number;
  readonly cost: number;
}

function bestOf(
  upper: GrayImage,
  lower: GrayImage,
  from: number,
  to: number,
  stride: number,
  rowBudget: number,
): Candidate {
  let best: Candidate = { h: from, cost: Infinity };
  for (let h = from; h <= to; h += stride) {
    const cost = seamCost(upper, lower, h, rowBudget);
    if (cost < best.cost) best = { h, cost };
  }
  return best;
}

/**
 * Finds how many rows two vertically adjacent screenshots share.
 *
 * Runs in two passes. The coarse pass sweeps the whole candidate range on a
 * width-squashed copy, inspecting a bounded number of rows per candidate so
 * that very tall screenshots still finish quickly. The fine pass re-scores a
 * narrow window around the coarse winner at full resolution and full row
 * density, which removes any bias the squash introduced and pins the offset to
 * the exact pixel.
 */
export function detectOverlapGray(input: DetectOverlapInput): AlignmentResult {
  const minOverlap = input.minOverlapPx ?? MIN_OVERLAP_PX;
  const threshold = input.matchCostThreshold ?? MATCH_COST_THRESHOLD;
  const rowBudget = input.rowBudget ?? DEFAULT_ROW_SAMPLES;

  const ceiling = Math.floor(Math.min(input.fineUpper.height, input.fineLower.height) * MAX_OVERLAP_RATIO);
  const maxOverlap = Math.min(ceiling, input.maxOverlapPx ?? ceiling);

  if (maxOverlap < minOverlap) {
    return { overlapPx: 0, cost: Infinity, maxOverlapPx: 0, matched: false };
  }

  const span = maxOverlap - minOverlap + 1;
  const stride = Math.max(1, Math.ceil(span / MAX_COARSE_CANDIDATES));
  const coarse = bestOf(input.coarseUpper, input.coarseLower, minOverlap, maxOverlap, stride, rowBudget);

  const window = stride + FINE_WINDOW_PADDING;
  const fineFrom = Math.max(minOverlap, coarse.h - window);
  const fineTo = Math.min(maxOverlap, coarse.h + window);
  const fine = bestOf(input.fineUpper, input.fineLower, fineFrom, fineTo, 1, Number.POSITIVE_INFINITY);

  return {
    overlapPx: fine.h,
    cost: fine.cost,
    maxOverlapPx: maxOverlap,
    matched: fine.cost <= threshold,
  };
}
