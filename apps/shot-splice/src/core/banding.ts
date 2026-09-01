import { rowCost } from './gray';
import type { BandDetection, GrayImage } from './types';

/**
 * Neither band may exceed this fraction of the shortest shot.
 *
 * Without a ceiling, a set of identical (or flat white) screenshots would be
 * "all header", and the tool would silently cut everything away.
 */
export const MAX_BAND_RATIO = 0.25;

/** Rows differing by less than this mean absolute luminance count as identical. */
export const ROW_MATCH_THRESHOLD = 6;

export interface BandOptions {
  readonly rowMatchThreshold?: number;
  readonly maxBandRatio?: number;
}

/** True when row `offset` (counted from `edge`) is the same across every shot. */
function rowIsShared(
  shots: readonly GrayImage[],
  offset: number,
  edge: 'top' | 'bottom',
  threshold: number,
): boolean {
  const reference = shots[0] as GrayImage;
  const refY = edge === 'top' ? offset : reference.height - 1 - offset;
  for (let i = 1; i < shots.length; i += 1) {
    const other = shots[i] as GrayImage;
    const otherY = edge === 'top' ? offset : other.height - 1 - offset;
    if (rowCost(reference, other, refY, otherY) > threshold) return false;
  }
  return true;
}

function runLength(
  shots: readonly GrayImage[],
  edge: 'top' | 'bottom',
  limit: number,
  threshold: number,
): number {
  let count = 0;
  while (count < limit && rowIsShared(shots, count, edge, threshold)) count += 1;
  return count;
}

/**
 * Detects the fixed header and footer bands that every shot has in common —
 * status bars, navigation bars, tab bars and the like.
 *
 * Walks inward from each edge and stops at the first row that is not shared by
 * all shots. The result is a *proposal*: callers must show it to the user and
 * let them disable or adjust it (SPEC FR-204). Cutting silently would be
 * unrecoverable, since the tool never keeps a copy of the original.
 */
export function detectCommonBands(
  shots: readonly GrayImage[],
  options: BandOptions = {},
): BandDetection {
  if (shots.length < 2) return { headerPx: 0, footerPx: 0 };

  const threshold = options.rowMatchThreshold ?? ROW_MATCH_THRESHOLD;
  const ratio = options.maxBandRatio ?? MAX_BAND_RATIO;
  const shortest = shots.reduce((min, s) => Math.min(min, s.height), Infinity);
  if (!Number.isFinite(shortest) || shortest <= 0) return { headerPx: 0, footerPx: 0 };

  const limit = Math.max(0, Math.floor(shortest * ratio));
  if (limit === 0) return { headerPx: 0, footerPx: 0 };

  const headerPx = runLength(shots, 'top', limit, threshold);
  const footerPx = Math.min(runLength(shots, 'bottom', limit, threshold), shortest - headerPx);

  return { headerPx, footerPx: Math.max(0, footerPx) };
}
