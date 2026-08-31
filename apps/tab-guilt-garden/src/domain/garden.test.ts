import { describe, expect, test } from 'vitest';
import { GHOST_TIMEOUT_MS } from './constants';
import {
  buryInto,
  createPlant,
  dedupeGraveyard,
  orderForDisplay,
  refreshOwn,
  removeBuried,
  sweepGhosts,
  toGraveyardEntry,
  upsertOwn,
} from './garden';
import type { GraveyardEntry, PlantRecord } from './types';

const T0 = 1_700_000_000_000;

function plant(id: string, overrides: Partial<PlantRecord> = {}): PlantRecord {
  return {
    id,
    name: '',
    note: '',
    species: 'flower',
    plantedAt: T0,
    lastFocusAt: T0,
    lastHeartbeatAt: T0,
    ...overrides,
  };
}

describe('createPlant', () => {
  test('starts fully alive at the current instant', () => {
    const p = createPlant('a', 'cactus', T0);
    expect(p).toMatchObject({
      id: 'a',
      species: 'cactus',
      plantedAt: T0,
      lastFocusAt: T0,
      lastHeartbeatAt: T0,
      name: '',
      note: '',
    });
  });
});

describe('toGraveyardEntry', () => {
  test('captures real (unscaled) neglect and lifespan at the moment of death', () => {
    const p = plant('a', { plantedAt: T0, lastFocusAt: T0 + 1000 });
    const g = toGraveyardEntry(p, T0 + 5000, 'closed');
    expect(g).toMatchObject({
      id: 'a',
      cause: 'closed',
      diedAt: T0 + 5000,
      neglectMsAtDeath: 4000,
      lifespanMs: 5000,
    });
  });

  test('clamps negative durations from a skewed clock (E-10)', () => {
    const g = toGraveyardEntry(plant('a'), T0 - 5000, 'ghost');
    expect(g.neglectMsAtDeath).toBe(0);
    expect(g.lifespanMs).toBe(0);
  });

  test('carries the epitaph text across', () => {
    const p = plant('a', { name: 'あとで読む', note: '本当に読む' });
    const g = toGraveyardEntry(p, T0, 'closed');
    expect(g.name).toBe('あとで読む');
    expect(g.note).toBe('本当に読む');
  });
});

describe('upsertOwn (FR-203)', () => {
  test('appends when the record is not present yet', () => {
    const out = upsertOwn([plant('other')], plant('me'));
    expect(out.map((p) => p.id)).toEqual(['other', 'me']);
  });

  test('replaces in place, preserving array position', () => {
    const before = [plant('a'), plant('me'), plant('b')];
    const out = upsertOwn(before, plant('me', { name: 'updated' }));
    expect(out.map((p) => p.id)).toEqual(['a', 'me', 'b']);
    expect(out[1]?.name).toBe('updated');
  });

  test('does not touch any other tab record (AC-203a)', () => {
    // Tab B is mid-edit; our tick must write back exactly what we read for it.
    const typing = plant('tabB', { name: 'いま入力中' });
    const out = upsertOwn([typing], plant('me'));
    expect(out.find((p) => p.id === 'tabB')).toBe(typing);
  });

  test('does not mutate the input array', () => {
    const before = [plant('me')];
    upsertOwn(before, plant('me', { name: 'x' }));
    expect(before[0]?.name).toBe('');
  });
});

describe('removeBuried (FR-206)', () => {
  const grave = (id: string): GraveyardEntry => ({
    id,
    name: '',
    note: '',
    species: 'flower',
    plantedAt: T0,
    diedAt: T0,
    cause: 'closed',
    neglectMsAtDeath: 0,
    lifespanMs: 0,
  });

  test('filters out plants that already have a tombstone', () => {
    const out = removeBuried([plant('a'), plant('b')], [grave('a')]);
    expect(out.map((p) => p.id)).toEqual(['b']);
  });

  test('returns the input untouched when nothing is buried', () => {
    const plants = [plant('a')];
    expect(removeBuried(plants, [])).toBe(plants);
  });
});

describe('buryInto (AC-204a / AC-205a)', () => {
  const entry = (id: string): GraveyardEntry => toGraveyardEntry(plant(id), T0, 'ghost');

  test('adds new tombstones and reports them', () => {
    const { graveyard, added } = buryInto([], [entry('a'), entry('b')]);
    expect(graveyard).toHaveLength(2);
    expect(added.map((g) => g.id)).toEqual(['a', 'b']);
  });

  test('ignores an id that is already buried (two tabs sweeping the same ghost)', () => {
    const first = buryInto([], [entry('ghost')]);
    const second = buryInto(first.graveyard, [entry('ghost')]);
    expect(second.graveyard).toHaveLength(1);
    expect(second.added).toEqual([]);
    // Unchanged input is returned as-is so callers can skip a redundant write.
    expect(second.graveyard).toBe(first.graveyard);
  });

  test('deduplicates within a single batch', () => {
    const { graveyard } = buryInto([], [entry('dup'), entry('dup')]);
    expect(graveyard).toHaveLength(1);
  });

  test('a double pagehide+beforeunload burial yields one tombstone (E-07)', () => {
    const own = plant('me');
    let g: GraveyardEntry[] = [];
    for (let i = 0; i < 2; i += 1) {
      g = buryInto(g, [toGraveyardEntry(own, T0 + i, 'closed')]).graveyard;
    }
    expect(g).toHaveLength(1);
  });

  test('is a no-op for an empty batch', () => {
    const g = [entry('a')];
    expect(buryInto(g, []).graveyard).toBe(g);
  });
});

describe('dedupeGraveyard', () => {
  const entry = (id: string, diedAt: number): GraveyardEntry =>
    toGraveyardEntry(plant(id), diedAt, 'closed');

  test('keeps the first occurrence of each id', () => {
    const out = dedupeGraveyard([entry('a', T0), entry('a', T0 + 5), entry('b', T0)]);
    expect(out.map((g) => g.id)).toEqual(['a', 'b']);
    expect(out[0]?.diedAt).toBe(T0);
  });

  test('leaves an already-unique list intact', () => {
    const list = [entry('a', T0), entry('b', T0)];
    expect(dedupeGraveyard(list)).toHaveLength(2);
  });
});

describe('sweepGhosts (FR-204)', () => {
  test('buries another tab whose heartbeat went silent past the timeout', () => {
    const stale = plant('other', { lastHeartbeatAt: T0 });
    const { survivors, ghosts } = sweepGhosts(
      [plant('me'), stale],
      'me',
      T0 + GHOST_TIMEOUT_MS + 1,
    );
    expect(ghosts.map((p) => p.id)).toEqual(['other']);
    expect(survivors.map((p) => p.id)).toEqual(['me']);
  });

  test('keeps a tab that is exactly at the timeout boundary', () => {
    const { ghosts } = sweepGhosts(
      [plant('other', { lastHeartbeatAt: T0 })],
      'me',
      T0 + GHOST_TIMEOUT_MS,
    );
    expect(ghosts).toEqual([]);
  });

  test('never ghosts the caller itself even with an ancient heartbeat (AC-204b)', () => {
    const { survivors, ghosts } = sweepGhosts(
      [plant('me', { lastHeartbeatAt: T0 })],
      'me',
      T0 + GHOST_TIMEOUT_MS * 100,
    );
    expect(ghosts).toEqual([]);
    expect(survivors.map((p) => p.id)).toEqual(['me']);
  });

  test('keeps healthy peers', () => {
    const { ghosts } = sweepGhosts(
      [plant('a', { lastHeartbeatAt: T0 + 900 })],
      'me',
      T0 + 1000,
    );
    expect(ghosts).toEqual([]);
  });
});

describe('refreshOwn', () => {
  test('always advances the heartbeat', () => {
    const out = refreshOwn(plant('me'), T0 + 5000, false);
    expect(out.lastHeartbeatAt).toBe(T0 + 5000);
  });

  test('freezes lastFocusAt while unfocused, so neglect accumulates', () => {
    const out = refreshOwn(plant('me'), T0 + 5000, false);
    expect(out.lastFocusAt).toBe(T0);
  });

  test('advances lastFocusAt while focused, so the plant stays healthy', () => {
    const out = refreshOwn(plant('me'), T0 + 5000, true);
    expect(out.lastFocusAt).toBe(T0 + 5000);
  });

  test('does not mutate the input', () => {
    const own = plant('me');
    refreshOwn(own, T0 + 1, true);
    expect(own.lastHeartbeatAt).toBe(T0);
  });
});

describe('orderForDisplay', () => {
  test('puts the caller first, then oldest first', () => {
    const out = orderForDisplay(
      [
        plant('b', { plantedAt: T0 + 200 }),
        plant('a', { plantedAt: T0 + 100 }),
        plant('me', { plantedAt: T0 + 999 }),
      ],
      'me',
    );
    expect(out.map((p) => p.id)).toEqual(['me', 'a', 'b']);
  });

  test('does not mutate the input array', () => {
    const before = [plant('b'), plant('me')];
    orderForDisplay(before, 'me');
    expect(before.map((p) => p.id)).toEqual(['b', 'me']);
  });

  test('handles a garden with no self record', () => {
    const out = orderForDisplay([plant('b', { plantedAt: T0 + 5 }), plant('a')], 'missing');
    expect(out.map((p) => p.id)).toEqual(['a', 'b']);
  });
});
