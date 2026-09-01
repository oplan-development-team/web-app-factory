import type { BandCuts, FrontLayer } from '../core/types';

export const MAX_SHOTS = 12;

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface Shot {
  readonly id: string;
  readonly name: string;
  readonly source: CanvasImageSource;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
  readonly averageColor: Rgb;
}

export interface SeamState {
  readonly overlapPx: number;
  readonly maxOverlapPx: number;
  readonly cost: number | null;
  readonly matched: boolean;
  readonly front: FrontLayer;
}

export interface BandState extends BandCuts {
  readonly detectedHeaderPx: number;
  readonly detectedFooterPx: number;
  readonly enabled: boolean;
  readonly manuallyEdited: boolean;
}

export type StatusTone = 'info' | 'success' | 'error';

export interface Status {
  readonly tone: StatusTone;
  readonly message: string;
}

export type Busy =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly message: string }
  | { readonly kind: 'detecting'; readonly done: number; readonly total: number }
  | { readonly kind: 'exporting' };

export interface AppState {
  readonly shots: readonly Shot[];
  /** Seam state is keyed by the pair of shots it joins, not by index. */
  readonly seams: Readonly<Record<string, SeamState>>;
  readonly bands: BandState;
  readonly activeSeam: number | null;
  readonly diffMode: boolean;
  readonly status: Status | null;
  readonly busy: Busy;
}

export const freshSeam: SeamState = {
  overlapPx: 0,
  maxOverlapPx: 0,
  cost: null,
  matched: false,
  front: 'lower',
};

export const initialBands: BandState = {
  detectedHeaderPx: 0,
  detectedFooterPx: 0,
  headerPx: 0,
  footerPx: 0,
  enabled: true,
  manuallyEdited: false,
  trimEnds: false,
};

export function initialState(): AppState {
  return {
    shots: [],
    seams: {},
    bands: initialBands,
    activeSeam: null,
    diffMode: false,
    status: null,
    busy: { kind: 'idle' },
  };
}

/**
 * Seams are identified by the pair of shots they join.
 *
 * Indexing them by position would throw away every measurement whenever a shot
 * is inserted, removed or reordered, even for pairs that are still adjacent
 * and still correct. Keying by identity means only genuinely new pairs come
 * back unmeasured.
 */
export function seamKey(upper: Shot, lower: Shot): string {
  return `${upper.id}|${lower.id}`;
}

export function seamKeyAt(state: AppState, index: number): string | null {
  const upper = state.shots[index];
  const lower = state.shots[index + 1];
  return upper && lower ? seamKey(upper, lower) : null;
}

/** Seam states in display order. Length is always `shots.length - 1`. */
export function seamList(state: AppState): SeamState[] {
  const out: SeamState[] = [];
  for (let i = 0; i < state.shots.length - 1; i += 1) {
    const key = seamKeyAt(state, i);
    out.push((key ? state.seams[key] : undefined) ?? freshSeam);
  }
  return out;
}

/**
 * Drops measurements that mention a shot which is no longer loaded.
 *
 * Deliberately keyed on whether the shots still exist, not on whether they are
 * still adjacent. Pruning by adjacency looks tidier but throws work away on
 * any round trip: moving a shot down and back up would pass through an
 * arrangement where the original pairs are not adjacent, and every measurement
 * would be gone by the time the user undid the move. The map stays bounded
 * either way — twelve shots can only produce a few dozen pairs.
 */
function pruneSeams(state: AppState): Readonly<Record<string, SeamState>> {
  const ids = new Set(state.shots.map((shot) => shot.id));
  const kept: Record<string, SeamState> = {};
  for (const [key, value] of Object.entries(state.seams)) {
    const [upper, lower] = key.split('|');
    if (upper && lower && ids.has(upper) && ids.has(lower)) kept[key] = value;
  }
  return kept;
}

export interface AddResult {
  readonly state: AppState;
  /** Shots that did not fit under the cap. */
  readonly rejected: readonly Shot[];
}

export function addShots(state: AppState, incoming: readonly Shot[]): AddResult {
  const room = Math.max(0, MAX_SHOTS - state.shots.length);
  const accepted = incoming.slice(0, room);
  const rejected = incoming.slice(room);
  if (accepted.length === 0) return { state, rejected };
  const next: AppState = { ...state, shots: [...state.shots, ...accepted] };
  return { state: { ...next, seams: pruneSeams(next) }, rejected };
}

export function removeShot(state: AppState, id: string): AppState {
  const shots = state.shots.filter((shot) => shot.id !== id);
  if (shots.length === state.shots.length) return state;
  const next: AppState = { ...state, shots, activeSeam: null };
  return { ...next, seams: pruneSeams(next) };
}

export function moveShot(state: AppState, from: number, to: number): AppState {
  if (from === to) return state;
  if (from < 0 || from >= state.shots.length) return state;
  const target = Math.max(0, Math.min(state.shots.length - 1, to));
  const shots = [...state.shots];
  const [moved] = shots.splice(from, 1);
  if (!moved) return state;
  shots.splice(target, 0, moved);
  const next: AppState = { ...state, shots, activeSeam: null };
  return { ...next, seams: pruneSeams(next) };
}

export function clearShots(state: AppState): AppState {
  return { ...initialState(), status: state.status };
}

export function updateSeam(state: AppState, index: number, patch: Partial<SeamState>): AppState {
  const key = seamKeyAt(state, index);
  if (!key) return state;
  const current = state.seams[key] ?? freshSeam;
  return { ...state, seams: { ...state.seams, [key]: { ...current, ...patch } } };
}

export function updateBands(state: AppState, patch: Partial<BandState>): AppState {
  return { ...state, bands: { ...state.bands, ...patch } };
}

/**
 * Records a fresh header/footer measurement.
 *
 * A measurement never overwrites values the user has adjusted by hand; the UI
 * surfaces the difference instead and lets them adopt it deliberately.
 */
export function applyBandDetection(
  state: AppState,
  detected: { headerPx: number; footerPx: number },
): AppState {
  const bands = state.bands;
  if (bands.manuallyEdited) {
    return updateBands(state, {
      detectedHeaderPx: detected.headerPx,
      detectedFooterPx: detected.footerPx,
    });
  }
  return updateBands(state, {
    detectedHeaderPx: detected.headerPx,
    detectedFooterPx: detected.footerPx,
    headerPx: detected.headerPx,
    footerPx: detected.footerPx,
  });
}

export function bandsDifferFromDetection(bands: BandState): boolean {
  return bands.headerPx !== bands.detectedHeaderPx || bands.footerPx !== bands.detectedFooterPx;
}

/** Cuts actually handed to the layout: zeroed out while the band feature is off. */
export function effectiveCuts(bands: BandState): BandCuts {
  if (!bands.enabled) return { headerPx: 0, footerPx: 0, trimEnds: false };
  return { headerPx: bands.headerPx, footerPx: bands.footerPx, trimEnds: bands.trimEnds };
}

export function setStatus(state: AppState, status: Status | null): AppState {
  return { ...state, status };
}

export function setBusy(state: AppState, busy: Busy): AppState {
  return { ...state, busy };
}

export function setActiveSeam(state: AppState, index: number | null): AppState {
  if (index === null) return { ...state, activeSeam: null };
  if (index < 0 || index >= state.shots.length - 1) return state;
  return { ...state, activeSeam: index };
}

export function setDiffMode(state: AppState, diffMode: boolean): AppState {
  return { ...state, diffMode };
}

/** The width every shot is normalised to: the first shot's own width. */
export function baseWidth(state: AppState): number {
  return state.shots[0]?.naturalWidth ?? 0;
}

export function hasMixedWidths(state: AppState): boolean {
  const base = baseWidth(state);
  return state.shots.some((shot) => shot.naturalWidth !== base);
}

export type Listener = (state: AppState) => void;

export interface Store {
  getState(): AppState;
  set(next: AppState): void;
  update(fn: (state: AppState) => AppState): void;
  subscribe(listener: Listener): () => void;
}

export function createStore(initial: AppState = initialState()): Store {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    getState: () => state,
    set(next) {
      if (next === state) return;
      state = next;
      for (const listener of listeners) listener(state);
    },
    update(fn) {
      this.set(fn(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
