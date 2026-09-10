// Core geometric & domain types shared across the app.
//
// Coordinate convention: everything is authored in "wedge-local" space.
// The wedge is a 30° pie slice with its apex at the origin (0,0):
//   - "left" fold edge runs from (0,0) to (R,0)               [angle 0°]
//   - "right" fold edge runs from (0,0) to (R·cos30°, R·sin30°) [angle 30°]
//   - "arc" outer edge runs along radius R from angle 0° to 30°
// Distances (u) along an edge are measured from the center (0,0), in the
// same px units as R, so a "depth" or "amplitude" value means the same
// physical size regardless of which edge it is applied to.

export type EdgeId = 'left' | 'right' | 'arc';

export type CutKind = 'triangle' | 'semicircle' | 'wave' | 'notch';

export type NotchSize = 'small' | 'medium' | 'large';

interface BaseCut {
  id: string;
  kind: CutKind;
}

/** Triangle notch: on an edge (indents the boundary) or free-floating inside the wedge (a hole). */
export interface TriangleCut extends BaseCut {
  kind: 'triangle';
  placement: 'edge' | 'interior';
  edge?: EdgeId;
  /** distance along the edge from the wedge center (edge placement only) */
  u?: number;
  /** interior placement: local x/y within the wedge */
  x?: number;
  y?: number;
  width: number;
  depth: number;
  /** interior only: rotation in degrees */
  rotation?: number;
}

/** Semicircle: a scoop bitten out of an edge, or a full circular hole when placed inside. */
export interface SemicircleCut extends BaseCut {
  kind: 'semicircle';
  placement: 'edge' | 'interior';
  edge?: EdgeId;
  u?: number;
  x?: number;
  y?: number;
  radius: number;
}

/** Wave / scallop range along an edge. */
export interface WaveCut extends BaseCut {
  kind: 'wave';
  placement: 'edge';
  edge: EdgeId;
  uStart: number;
  uEnd: number;
  amplitude: number;
  count: number;
}

/** Small single-click fringe notch along an edge. */
export interface NotchCut extends BaseCut {
  kind: 'notch';
  placement: 'edge';
  edge: EdgeId;
  u: number;
  size: NotchSize;
}

export type Cut = TriangleCut | SemicircleCut | WaveCut | NotchCut;

export interface Point {
  x: number;
  y: number;
}

/** The fixed radius of the wedge / snowflake paper, in local SVG units. */
export const WEDGE_RADIUS = 260;

export const NOTCH_SIZES: Record<NotchSize, { width: number; depth: number }> = {
  small: { width: 8, depth: 6 },
  medium: { width: 14, depth: 10 },
  large: { width: 22, depth: 16 },
};
