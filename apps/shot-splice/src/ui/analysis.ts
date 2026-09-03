import { MIN_OVERLAP_PX, detectOverlapGray } from '../core/alignment';
import { detectCommonBands } from '../core/banding';
import { seamCost } from '../core/gray';
import { cropGray, squashWidth } from '../core/gray-scale';
import type { AlignmentResult, BandCuts, BandDetection, GrayImage, Layout } from '../core/types';
import { imageToGray } from '../imaging/raster';
import type { CanvasFactory } from '../imaging/surface';
import type { Shot } from './store';

/** Width the coarse pass squashes to. Height is always left alone. */
export const COARSE_WIDTH = 100;

/** Rows sampled when re-scoring a seam during manual adjustment. */
export const SCORE_ROW_SAMPLES = 192;

export interface Analyzer {
  /** Luminance buffer for a shot, normalised to `width`. Cached per shot and width. */
  gray(shot: Shot, width: number): GrayImage;
  forget(id: string): void;
  clear(): void;
}

export interface AnalyzerDeps {
  readonly factory?: CanvasFactory;
  readonly toGray?: (source: CanvasImageSource, width: number, height: number) => GrayImage;
}

/**
 * Caches one luminance buffer per shot.
 *
 * Rasterising a 1179x2556 screenshot is the single most expensive thing the app
 * does, and every band adjustment and every seam re-detection would otherwise
 * pay for it again. Cuts are applied afterwards as pure row slices.
 */
export function createAnalyzer(deps: AnalyzerDeps = {}): Analyzer {
  const toGray =
    deps.toGray ??
    ((source, width, height) => imageToGray(source, width, height, deps.factory));
  const cache = new Map<string, { width: number; gray: GrayImage }>();

  return {
    gray(shot, width) {
      const target = Math.max(1, Math.round(width));
      const hit = cache.get(shot.id);
      if (hit && hit.width === target) return hit.gray;
      const height = Math.max(
        1,
        Math.round((shot.naturalHeight * target) / Math.max(1, shot.naturalWidth)),
      );
      const gray = toGray(shot.source, target, height);
      cache.set(shot.id, { width: target, gray });
      return gray;
    },
    forget(id) {
      cache.delete(id);
    },
    clear() {
      cache.clear();
    },
  };
}

/** Luminance buffers with the current band cuts already removed. */
export function workingGrays(
  analyzer: Analyzer,
  shots: readonly Shot[],
  width: number,
  layout: Layout,
): GrayImage[] {
  return shots.map((shot, i) => {
    const placed = layout.shots[i];
    const full = analyzer.gray(shot, width);
    if (!placed) return full;
    return cropGray(full, placed.cutTop, placed.cutBottom);
  });
}

export function detectSeam(upper: GrayImage, lower: GrayImage): AlignmentResult {
  return detectOverlapGray({
    coarseUpper: squashWidth(upper, COARSE_WIDTH),
    coarseLower: squashWidth(lower, COARSE_WIDTH),
    fineUpper: upper,
    fineLower: lower,
    minOverlapPx: MIN_OVERLAP_PX,
  });
}

/**
 * Detects the fixed bands on the *uncut* shots.
 *
 * Feeding it the already-cut buffers would let a previous cut hide the very
 * rows the detector is looking for, so the measurement would shrink a little
 * more on every pass.
 */
export function detectBands(
  analyzer: Analyzer,
  shots: readonly Shot[],
  width: number,
): BandDetection {
  if (shots.length < 2 || width <= 0) return { headerPx: 0, footerPx: 0 };
  return detectCommonBands(shots.map((shot) => analyzer.gray(shot, width)));
}

export function cutsEqual(a: BandCuts, b: BandCuts): boolean {
  return a.headerPx === b.headerPx && a.footerPx === b.footerPx && a.trimEnds === b.trimEnds;
}

/**
 * Scores a seam at an arbitrary overlap, without searching.
 *
 * Manual adjustment invalidates the cost recorded by the last detection: the
 * UI would otherwise keep reporting "matched, Δ0.00" for a seam the user has
 * just dragged out of alignment, which is worse than showing nothing. Rows are
 * sampled so this stays cheap enough to run on every drag frame.
 */
export function scoreOverlap(upper: GrayImage, lower: GrayImage, overlapPx: number): number | null {
  if (overlapPx <= 0) return null;
  const cost = seamCost(upper, lower, overlapPx, SCORE_ROW_SAMPLES);
  return Number.isFinite(cost) ? cost : null;
}
