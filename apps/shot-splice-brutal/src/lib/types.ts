export interface LoadedImage {
  element: HTMLImageElement;
  objectUrl: string;
  fileName: string;
  fileSize: number;
  naturalWidth: number;
  naturalHeight: number;
}

export type FrontLayer = 'top' | 'bottom';

export interface AppState {
  top: LoadedImage | null;
  bottom: LoadedImage | null;
  cutBottomOfTop: number;
  cutTopOfBottom: number;
  overlapPx: number;
  frontLayer: FrontLayer;
  diffMode: boolean;
  isDetecting: boolean;
}

export interface EffectiveDimensions {
  topHeight: number;
  bottomHeight: number;
  maxOverlap: number;
  outputWidth: number;
  outputHeight: number;
}
