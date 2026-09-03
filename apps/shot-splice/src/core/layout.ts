import { MAX_OVERLAP_RATIO } from './alignment';
import type { BandCuts, Layout, PlacedShot, ShotSize } from './types';

export const noCuts: BandCuts = { headerPx: 0, footerPx: 0, trimEnds: false };

function clampCut(value: number, available: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  // Always leave at least one row, otherwise a shot could vanish entirely.
  return Math.min(Math.round(value), Math.max(0, available - 1));
}

/**
 * Works out where every shot lands in the composed image.
 *
 * Cuts are applied to the seam-facing edges only by default: the first shot
 * keeps its header and the last shot keeps its footer, so the finished image
 * still opens with the status bar and closes with the tab bar exactly once,
 * the way a single tall screenshot would.
 */
export function computeLayout(
  shots: readonly ShotSize[],
  overlaps: readonly number[],
  cuts: BandCuts,
): Layout {
  if (shots.length === 0) {
    return { width: 0, height: 0, shots: [], overlaps: [], maxOverlaps: [] };
  }

  const last = shots.length - 1;
  const placed: PlacedShot[] = [];

  for (let i = 0; i < shots.length; i += 1) {
    const shot = shots[i] as ShotSize;
    const wantsTopCut = cuts.trimEnds || i > 0;
    const wantsBottomCut = cuts.trimEnds || i < last;

    let cutTop = wantsTopCut ? clampCut(cuts.headerPx, shot.height) : 0;
    let cutBottom = wantsBottomCut ? clampCut(cuts.footerPx, shot.height) : 0;
    // Both cuts together must still leave a row behind.
    while (cutTop + cutBottom >= shot.height) {
      if (cutBottom >= cutTop) cutBottom -= 1;
      else cutTop -= 1;
    }

    placed.push({ cutTop, cutBottom, height: shot.height - cutTop - cutBottom, y: 0 });
  }

  const resolvedOverlaps: number[] = [];
  const maxOverlaps: number[] = [];
  for (let i = 0; i < placed.length - 1; i += 1) {
    const upper = placed[i] as PlacedShot;
    const lower = placed[i + 1] as PlacedShot;
    const max = Math.floor(Math.min(upper.height, lower.height) * MAX_OVERLAP_RATIO);
    const requested = overlaps[i] ?? 0;
    const value = Number.isFinite(requested) ? Math.round(requested) : 0;
    maxOverlaps.push(max);
    resolvedOverlaps.push(Math.max(0, Math.min(max, value)));
  }

  let y = 0;
  const positioned = placed.map((shot, i) => {
    if (i > 0) y += (placed[i - 1] as PlacedShot).height - (resolvedOverlaps[i - 1] as number);
    return { ...shot, y };
  });

  const lastShot = positioned[positioned.length - 1] as PlacedShot;
  return {
    width: (shots[0] as ShotSize).width,
    height: lastShot.y + lastShot.height,
    shots: positioned,
    overlaps: resolvedOverlaps,
    maxOverlaps,
  };
}
