/**
 * A single-channel luminance buffer, laid out row-major.
 *
 * This is the only image representation the `core/` layer understands. Keeping
 * `core/` free of `HTMLCanvasElement` is a deliberate architectural constraint
 * (see docs/SPEC.md §5): jsdom has no Canvas 2D implementation, so any
 * algorithm that touches a canvas directly becomes untestable.
 */
export interface GrayImage {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

export interface AlignmentResult {
  /** Number of shared rows between the tail of the upper shot and the head of the lower shot. */
  readonly overlapPx: number;
  /** Mean absolute luminance difference across the matched band. 0 = pixel-identical. */
  readonly cost: number;
  /** Largest overlap the pair could possibly have. */
  readonly maxOverlapPx: number;
  /** False when no plausible seam was found; callers should fall back to manual adjustment. */
  readonly matched: boolean;
}

export interface BandDetection {
  readonly headerPx: number;
  readonly footerPx: number;
}

export interface ShotSize {
  readonly width: number;
  readonly height: number;
}

export interface BandCuts {
  readonly headerPx: number;
  readonly footerPx: number;
  /** When true, the first shot's header and the last shot's footer are cut as well. */
  readonly trimEnds: boolean;
}

/** Where a single shot lands inside the composed output, after cuts. */
export interface PlacedShot {
  /** Rows removed from the top of the source image. */
  readonly cutTop: number;
  /** Rows removed from the bottom of the source image. */
  readonly cutBottom: number;
  /** Height after cuts. */
  readonly height: number;
  /** Y position of this shot's first row within the output canvas. */
  readonly y: number;
}

export interface Layout {
  readonly width: number;
  readonly height: number;
  readonly shots: readonly PlacedShot[];
  /** Overlap actually used for each seam, after clamping. Length = shots.length - 1. */
  readonly overlaps: readonly number[];
  /** Upper bound for each seam's overlap, given the cut heights. */
  readonly maxOverlaps: readonly number[];
}

export type FrontLayer = 'upper' | 'lower';
