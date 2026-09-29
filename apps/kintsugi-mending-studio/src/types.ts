export type VesselId = 'bowl' | 'plate' | 'vase';
export type GlazeId = 'celadon' | 'hakuji' | 'tenmoku' | 'shinsha';
export type Stage = 'select' | 'breaking' | 'mending' | 'poster';

export interface Point {
  x: number;
  y: number;
}

export interface CrackSegment {
  /** Points in the vessel's own local coordinate space (not canvas pixels). */
  points: Point[];
  /** 0 = trunk crack, increasing = finer branch/capillary generations. */
  depth: number;
  /** Which break origin (0-3) this segment belongs to. */
  originId: number;
  /** Base stroke width in local units (scaled to canvas px at draw time). */
  widthBase: number;
  /** Cached polyline length in local units, used for animation timing. */
  length: number;
}
