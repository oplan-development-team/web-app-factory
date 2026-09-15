import { nextLayerId, type BlendMode, type Layer, type PatternType, type StudioState } from './types';

const BLEND_MODES: BlendMode[] = ['source-over', 'multiply', 'difference', 'exclusion'];
const PATTERN_TYPES: PatternType[] = ['lines', 'dots', 'circles'];

export function defaultLayer(type: PatternType, rotation: number): Layer {
  return {
    id: nextLayerId(),
    type,
    rotation,
    spacing: 12,
    thickness: 3,
    opacity: 1,
    color: '#111111',
    blendOverride: false,
    blendMode: 'source-over',
    kinetic: false,
  };
}

export function defaultState(): StudioState {
  return {
    // 'multiply' reads as a bold, unmistakably grid-on-grid moiré the moment
    // the app loads; 'difference' between two near-black layers mostly
    // cancels itself out (0 or full-white), which looked washed out here.
    layers: [defaultLayer('lines', 0), defaultLayer('lines', 7)],
    globalBlendMode: 'multiply',
    kineticPlaying: false,
    kineticSpeed: 12,
  };
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomColor(): string {
  // Keep the art legible: bias toward near-black or a handful of saturated
  // hues rather than uniform RGB noise (which tends to look muddy/grey).
  const palette = ['#111111', '#111111', '#111111', '#E10600', '#1B3A8C', '#0C6E4F'];
  return palette[Math.floor(Math.random() * palette.length)];
}

function randomLayer(): Layer {
  const type = PATTERN_TYPES[Math.floor(Math.random() * PATTERN_TYPES.length)];
  return {
    id: nextLayerId(),
    type,
    rotation: Math.round(randRange(0, 180)),
    spacing: Math.round(randRange(8, 26)),
    thickness: Math.round(randRange(2, 6) * 10) / 10,
    opacity: Math.round(randRange(0.6, 1) * 100) / 100,
    color: randomColor(),
    blendOverride: false,
    blendMode: 'source-over',
    kinetic: Math.random() > 0.4,
  };
}

export function randomizeState(layerCount: number): StudioState {
  const layers: Layer[] = [];
  for (let i = 0; i < layerCount; i += 1) layers.push(randomLayer());
  return {
    layers,
    globalBlendMode: BLEND_MODES[Math.floor(Math.random() * BLEND_MODES.length)],
    kineticPlaying: false,
    kineticSpeed: Math.round(randRange(6, 24)),
  };
}
