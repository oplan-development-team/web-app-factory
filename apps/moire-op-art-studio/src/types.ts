export type PatternType = 'lines' | 'dots' | 'circles';

export type BlendMode = 'source-over' | 'multiply' | 'difference' | 'exclusion';

export interface Layer {
  id: string;
  type: PatternType;
  /** degrees, 0-180. For 'circles' this is reused as the center-offset angle. */
  rotation: number;
  /** px, spacing between lines / grid cells / concentric rings */
  spacing: number;
  /** px, line weight / dot radius / ring stroke weight */
  thickness: number;
  /** 0-1 */
  opacity: number;
  /** hex color, freely chosen by the user */
  color: string;
  /** whether this layer overrides the global blend mode */
  blendOverride: boolean;
  blendMode: BlendMode;
  /** whether this layer participates in Kinetic mode auto-rotation */
  kinetic: boolean;
}

export interface StudioState {
  layers: Layer[];
  globalBlendMode: BlendMode;
  kineticPlaying: boolean;
  kineticSpeed: number; // degrees per second
}

export const CANVAS_SIZE = 1000;

export const BLEND_LABELS: Record<BlendMode, string> = {
  'source-over': 'NORMAL',
  multiply: 'MULTIPLY',
  difference: 'DIFFERENCE',
  exclusion: 'EXCLUSION',
};

export const PATTERN_LABELS: Record<PatternType, string> = {
  lines: 'LINES',
  dots: 'DOTS',
  circles: 'CIRCLES',
};

export function cloneState(state: StudioState): StudioState {
  return {
    layers: state.layers.map((l) => ({ ...l })),
    globalBlendMode: state.globalBlendMode,
    kineticPlaying: state.kineticPlaying,
    kineticSpeed: state.kineticSpeed,
  };
}

let idCounter = 0;
export function nextLayerId(): string {
  idCounter += 1;
  return `layer-${Date.now().toString(36)}-${idCounter}`;
}
