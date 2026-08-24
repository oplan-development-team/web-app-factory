export type ColorMode = 'mono' | 'multi';

export type MultiPreset = 'topo' | 'blueprint' | 'sepia';

export interface PaperPreset {
  id: string;
  label: string;
  hex: string;
}

export interface AppSettings {
  /** number of contour thresholds sliced across the luminance range (5-60) */
  lineCount: number;
  /** stroke width in SVG user units */
  lineWeight: number;
  /** gaussian-ish blur radius applied to the luminance grid before slicing (0-10) */
  smoothing: number;
  /** invert which tonal region reads as "high ground" (dense lines) */
  invert: boolean;
  colorMode: ColorMode;
  inkColor: string;
  paperColor: string;
  multiPreset: MultiPreset;
  title: string;
  includeFrame: boolean;
}

export interface SourceImage {
  fileName: string;
  width: number;
  height: number;
  /** the decoded HTMLImageElement, retained so we can re-fit on demand */
  element: HTMLImageElement;
}

export interface ContourBand {
  /** normalized position 0..1 across the threshold range, low -> high */
  t: number;
  threshold: number;
  path: string;
}

export interface TraceResult {
  bands: ContourBand[];
  gridWidth: number;
  gridHeight: number;
  min: number;
  max: number;
  contourInterval: number;
}

export type ProcessingState = 'idle' | 'empty' | 'loading' | 'ready' | 'error';
