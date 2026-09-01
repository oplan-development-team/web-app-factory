import type { AppState } from '../lib/types';

type Listener = (state: AppState) => void;

export function createStore(initial: AppState) {
  let state = initial;
  const listeners = new Set<Listener>();

  return {
    get(): AppState {
      return state;
    },
    set(patch: Partial<AppState>): void {
      state = { ...state, ...patch };
      for (const listener of listeners) listener(state);
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type Store = ReturnType<typeof createStore>;

export function initialState(): AppState {
  return {
    top: null,
    bottom: null,
    cutBottomOfTop: 0,
    cutTopOfBottom: 0,
    overlapPx: 0,
    frontLayer: 'top',
    diffMode: false,
    isDetecting: false,
  };
}
