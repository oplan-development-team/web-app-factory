export type InputMode = 'draw' | 'image';

export type ScaleName = 'pentatonic' | 'wholetone';

export type Duration = 20 | 40 | 80;

export interface StrokePoint {
  x: number;
  y: number;
}

/** A single hand-drawn stroke, in ink-area-local pixel coordinates. */
export interface Stroke {
  points: StrokePoint[];
  width: number;
  opacity: number;
}

/** A detected blob of ink in one sampled column, used for audio mapping. */
export interface InkBlob {
  /** vertical center, normalized 0 (top) .. 1 (bottom) within the ink area */
  yCenter: number;
  /** run length in px, drives volume */
  thickness: number;
  /** average alpha 0..1 of the run, drives timbre */
  density: number;
}

export interface AppState {
  mode: InputMode;
  penWidth: number;
  penOpacity: number;
  threshold: number;
  scale: ScaleName;
  duration: Duration;
  loop: boolean;
  title: string;
  catalogNumber: string;
  createdAt: Date;
  hasImage: boolean;
}

export type TimbreBucket = 'sine' | 'triangle' | 'saw';
