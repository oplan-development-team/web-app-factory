export type FrontLayer = 'top' | 'bottom';

export interface SpliceState {
  topImage: HTMLImageElement | null;
  bottomImage: HTMLImageElement | null;
  topCut: number;
  bottomCut: number;
  overlapPx: number;
  frontLayer: FrontLayer;
  diffMode: boolean;
}

export interface AlignmentResult {
  overlapPx: number;
  cost: number;
  maxOverlapPx: number;
}

export interface OutputSize {
  width: number;
  height: number;
}
