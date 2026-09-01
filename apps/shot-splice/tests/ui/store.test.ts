import { describe, expect, it, vi } from 'vitest';

import {
  MAX_SHOTS,
  type Shot,
  addShots,
  applyBandDetection,
  bandsDifferFromDetection,
  baseWidth,
  clearShots,
  createStore,
  effectiveCuts,
  hasMixedWidths,
  initialState,
  moveShot,
  removeShot,
  seamList,
  setActiveSeam,
  setBusy,
  setDiffMode,
  setStatus,
  updateBands,
  updateSeam,
} from '../../src/ui/store';

function shot(id: string, width = 100, height = 400): Shot {
  return {
    id,
    name: `${id}.png`,
    source: {} as CanvasImageSource,
    naturalWidth: width,
    naturalHeight: height,
    averageColor: { r: 0, g: 0, b: 0 },
  };
}

function withShots(...ids: readonly string[]) {
  return addShots(initialState(), ids.map((id) => shot(id))).state;
}

describe('addShots', () => {
  it('appends in order', () => {
    const state = withShots('a', 'b', 'c');
    expect(state.shots.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('rejects everything beyond the cap (E-02)', () => {
    const many = Array.from({ length: MAX_SHOTS + 3 }, (_, i) => shot(`s${i}`));
    const result = addShots(initialState(), many);
    expect(result.state.shots).toHaveLength(MAX_SHOTS);
    expect(result.rejected).toHaveLength(3);
  });

  it('returns the same state when there is no room left', () => {
    const full = addShots(initialState(), Array.from({ length: MAX_SHOTS }, (_, i) => shot(`s${i}`))).state;
    const result = addShots(full, [shot('extra')]);
    expect(result.state).toBe(full);
    expect(result.rejected.map((s) => s.id)).toEqual(['extra']);
  });
});

describe('seam identity', () => {
  it('produces one seam fewer than there are shots', () => {
    expect(seamList(withShots('a', 'b', 'c'))).toHaveLength(2);
    expect(seamList(withShots('a'))).toHaveLength(0);
    expect(seamList(initialState())).toHaveLength(0);
  });

  it('keeps measurements for pairs that survive a removal', () => {
    let state = withShots('a', 'b', 'c', 'd');
    state = updateSeam(state, 0, { overlapPx: 111, cost: 0, matched: true });
    state = updateSeam(state, 2, { overlapPx: 222, cost: 0, matched: true });
    state = removeShot(state, 'c');
    // a|b survived; c|d is gone and b|d is new.
    const seams = seamList(state);
    expect(seams[0]?.overlapPx).toBe(111);
    expect(seams[1]?.overlapPx).toBe(0);
    expect(seams[1]?.cost).toBeNull();
  });

  it('keeps measurements for pairs that survive a reorder', () => {
    let state = withShots('a', 'b', 'c');
    state = updateSeam(state, 1, { overlapPx: 77 });
    // Move 'a' to the end: b|c stays adjacent and keeps its measurement.
    state = moveShot(state, 0, 2);
    expect(state.shots.map((s) => s.id)).toEqual(['b', 'c', 'a']);
    expect(seamList(state)[0]?.overlapPx).toBe(77);
    expect(seamList(state)[1]?.overlapPx).toBe(0);
  });

  it('forgets measurements for pairs that no longer exist', () => {
    let state = withShots('a', 'b');
    state = updateSeam(state, 0, { overlapPx: 50 });
    state = removeShot(state, 'b');
    expect(Object.keys(state.seams)).toHaveLength(0);
  });

  it('ignores an update for a seam index that does not exist', () => {
    const state = withShots('a', 'b');
    expect(updateSeam(state, 9, { overlapPx: 10 })).toBe(state);
  });
});

describe('removeShot', () => {
  it('returns the same state for an unknown id', () => {
    const state = withShots('a', 'b');
    expect(removeShot(state, 'zz')).toBe(state);
  });

  it('closes the adjustment sheet', () => {
    const state = setActiveSeam(withShots('a', 'b', 'c'), 1);
    expect(removeShot(state, 'a').activeSeam).toBeNull();
  });
});

describe('moveShot', () => {
  it('moves forward and backward', () => {
    const state = withShots('a', 'b', 'c');
    expect(moveShot(state, 2, 0).shots.map((s) => s.id)).toEqual(['c', 'a', 'b']);
    expect(moveShot(state, 0, 1).shots.map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });

  it('clamps an out-of-range destination', () => {
    const state = withShots('a', 'b', 'c');
    expect(moveShot(state, 0, 99).shots.map((s) => s.id)).toEqual(['b', 'c', 'a']);
    expect(moveShot(state, 2, -5).shots.map((s) => s.id)).toEqual(['c', 'a', 'b']);
  });

  it('ignores a no-op or an invalid source (E-10)', () => {
    const state = withShots('a', 'b');
    expect(moveShot(state, 1, 1)).toBe(state);
    expect(moveShot(state, 5, 0)).toBe(state);
    expect(moveShot(state, -1, 0)).toBe(state);
  });
});

describe('clearShots', () => {
  it('empties everything but keeps the status message visible', () => {
    let state = withShots('a', 'b');
    state = setStatus(state, { tone: 'info', message: 'こんにちは' });
    const cleared = clearShots(state);
    expect(cleared.shots).toHaveLength(0);
    expect(cleared.seams).toEqual({});
    expect(cleared.status?.message).toBe('こんにちは');
  });
});

describe('band state', () => {
  it('adopts a detection when the user has not intervened', () => {
    const state = applyBandDetection(withShots('a', 'b'), { headerPx: 88, footerPx: 132 });
    expect(state.bands).toMatchObject({
      headerPx: 88,
      footerPx: 132,
      detectedHeaderPx: 88,
      detectedFooterPx: 132,
    });
  });

  it('never overwrites a hand-adjusted value (FR-207)', () => {
    let state = applyBandDetection(withShots('a', 'b'), { headerPx: 88, footerPx: 132 });
    state = updateBands(state, { headerPx: 60, manuallyEdited: true });
    state = applyBandDetection(state, { headerPx: 90, footerPx: 140 });
    expect(state.bands.headerPx).toBe(60);
    expect(state.bands.detectedHeaderPx).toBe(90);
    expect(bandsDifferFromDetection(state.bands)).toBe(true);
  });

  it('reports agreement when the applied values match the detection', () => {
    const state = applyBandDetection(withShots('a', 'b'), { headerPx: 10, footerPx: 20 });
    expect(bandsDifferFromDetection(state.bands)).toBe(false);
  });

  it('zeroes the cuts while the feature is switched off', () => {
    let state = applyBandDetection(withShots('a', 'b'), { headerPx: 88, footerPx: 132 });
    expect(effectiveCuts(state.bands)).toEqual({ headerPx: 88, footerPx: 132, trimEnds: false });
    state = updateBands(state, { enabled: false });
    expect(effectiveCuts(state.bands)).toEqual({ headerPx: 0, footerPx: 0, trimEnds: false });
  });
});

describe('derived helpers', () => {
  it('reports the base width and mixed widths', () => {
    const uniform = withShots('a', 'b');
    expect(baseWidth(uniform)).toBe(100);
    expect(hasMixedWidths(uniform)).toBe(false);

    const mixed = addShots(uniform, [shot('c', 250)]).state;
    expect(hasMixedWidths(mixed)).toBe(true);
    expect(baseWidth(mixed)).toBe(100);
  });

  it('returns zero width with no shots (E-01)', () => {
    expect(baseWidth(initialState())).toBe(0);
    expect(hasMixedWidths(initialState())).toBe(false);
  });
});

describe('ui flags', () => {
  it('validates the active seam index', () => {
    const state = withShots('a', 'b', 'c');
    expect(setActiveSeam(state, 1).activeSeam).toBe(1);
    expect(setActiveSeam(state, 5)).toBe(state);
    expect(setActiveSeam(state, -1)).toBe(state);
    expect(setActiveSeam(setActiveSeam(state, 1), null).activeSeam).toBeNull();
  });

  it('carries diff mode, status and busy state', () => {
    let state = initialState();
    state = setDiffMode(state, true);
    state = setBusy(state, { kind: 'detecting', done: 1, total: 3 });
    state = setStatus(state, { tone: 'error', message: 'だめ' });
    expect(state.diffMode).toBe(true);
    expect(state.busy).toEqual({ kind: 'detecting', done: 1, total: 3 });
    expect(state.status).toEqual({ tone: 'error', message: 'だめ' });
  });
});

describe('createStore', () => {
  it('notifies subscribers on change and stops after unsubscribe', () => {
    const store = createStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);

    store.update((s) => setDiffMode(s, true));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().diffMode).toBe(true);

    off();
    store.update((s) => setDiffMode(s, false));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('skips notification when the state object is unchanged', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.update((s) => s);
    expect(listener).not.toHaveBeenCalled();
  });

  it('never mutates the previous state object', () => {
    const store = createStore();
    const before = store.getState();
    store.update((s) => addShots(s, [shot('a')]).state);
    expect(before.shots).toHaveLength(0);
    expect(store.getState().shots).toHaveLength(1);
  });
});
