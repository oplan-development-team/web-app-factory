import type { FrontLayer } from './core/types';

export interface AppState {
  topImage: HTMLImageElement | null;
  bottomImage: HTMLImageElement | null;
  topFileName: string;
  bottomFileName: string;
  topCut: number;
  bottomCut: number;
  overlapPx: number;
  maxOverlapPx: number;
  frontLayer: FrontLayer;
  diffMode: boolean;
  lastDetectionCost: number | null;
}

type Listener = (state: AppState) => void;

const state: AppState = {
  topImage: null,
  bottomImage: null,
  topFileName: '',
  bottomFileName: '',
  topCut: 0,
  bottomCut: 0,
  overlapPx: 0,
  maxOverlapPx: 0,
  frontLayer: 'top',
  diffMode: false,
  lastDetectionCost: null,
};

const listeners = new Set<Listener>();

export function getState(): Readonly<AppState> {
  return state;
}

export function setState(patch: Partial<AppState>): void {
  Object.assign(state, patch);
  for (const listener of listeners) listener(state);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hasBothImages(s: AppState = state): boolean {
  return s.topImage !== null && s.bottomImage !== null;
}
