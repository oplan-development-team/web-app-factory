import type { CompositeMode, FrontLayer } from './lib/compositor.ts';

export type Status = 'idle' | 'detecting' | 'ready';

export interface AppState {
  readonly imageA: HTMLImageElement | null;
  readonly imageB: HTMLImageElement | null;
  readonly cropBottomA: number;
  readonly cropTopB: number;
  readonly overlapPx: number;
  readonly frontLayer: FrontLayer;
  readonly mode: CompositeMode;
  readonly status: Status;
  readonly lastDetectScore: number | null;
}

export function createInitialState(): AppState {
  return {
    imageA: null,
    imageB: null,
    cropBottomA: 0,
    cropTopB: 0,
    overlapPx: 0,
    frontLayer: 'top',
    mode: 'normal',
    status: 'idle',
    lastDetectScore: null,
  };
}

export function withPatch(state: AppState, patch: Partial<AppState>): AppState {
  return { ...state, ...patch };
}

export function hasBothImages(state: AppState): boolean {
  return state.imageA !== null && state.imageB !== null;
}

export function maxOverlapPx(state: AppState): number {
  if (!state.imageA || !state.imageB) return 0;
  const heightA = Math.max(0, state.imageA.naturalHeight - state.cropBottomA);
  const heightB = Math.max(0, state.imageB.naturalHeight - state.cropTopB);
  return Math.max(0, Math.min(heightA, heightB));
}
