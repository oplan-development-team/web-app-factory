/**
 * Core data model. Per the spec, the studio's live state is intentionally
 * limited to exactly two structures:
 *   1. `drops`  — the temporally ordered record of ink placed on the water.
 *   2. `field`  — the accumulated distortion (vector warp) field.
 * Everything the user sees is re-derived from these two on every render —
 * there is no separate raster "canvas state" that is mutated in place.
 */

export type InkId = 'sumi' | 'ai' | 'shu' | 'kondo' | 'matsuba' | 'dousa';

export interface InkDefinition {
  id: InkId;
  /** Display name (Japanese) */
  name: string;
  /** Romanized / caption label */
  label: string;
  /** RGB color used when compositing (ignored for dousa, which clears). */
  color: readonly [number, number, number];
  /** True for the 礬水 (dousa) resist — it clears/pushes aside instead of coloring. */
  isResist: boolean;
}

/** A single ink (or dousa) drop, recorded in the order it was placed. */
export interface DropRecord {
  /** Normalized basin coordinates in [0, 1), toroidal. */
  x: number;
  y: number;
  ink: InkId;
  /** Monotonically increasing placement order, used for deterministic derived radii. */
  seq: number;
}

export type CombDensity = 'coarse' | 'medium' | 'dense';

export type ToolId = 'drop' | 'comb' | 'swirl';

/** Distortion field: flat Float32Array of length RES*RES*2 (dx, dy pairs). */
export interface DistortionField {
  res: number;
  data: Float32Array;
}

/** A frozen "print" pulled from the basin via the dip-and-lift gesture. */
export interface PrintRecord {
  id: string;
  createdAt: number;
  drops: DropRecord[];
  field: DistortionField;
  thumbnail: string;
}
