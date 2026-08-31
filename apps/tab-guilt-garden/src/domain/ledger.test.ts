import { describe, expect, test } from 'vitest';
import {
  emptyLedger,
  normalizeLedger,
  recordAlive,
  recordBuried,
  recordBurn,
  recordNeglect,
  recordPlanted,
  withUnlocked,
} from './ledger';
import type { GraveyardEntry, LifetimeLedger } from './types';

const T0 = 1_700_000_000_000;

function grave(overrides: Partial<GraveyardEntry> = {}): GraveyardEntry {
  return {
    id: 'g1',
    name: '',
    note: '',
    species: 'flower',
    plantedAt: T0,
    diedAt: T0 + 1000,
    cause: 'closed',
    neglectMsAtDeath: 1000,
    lifespanMs: 1000,
    ...overrides,
  };
}

describe('emptyLedger', () => {
  test('starts every total at zero', () => {
    expect(emptyLedger()).toEqual({
      totalPlanted: 0,
      totalBuried: 0,
      longestNeglectMs: 0,
      longestLifespanMs: 0,
      peakAlive: 0,
      burnCount: 0,
      firstPlantedAt: null,
      unlocked: [],
    });
  });
});

describe('normalizeLedger', () => {
  test('returns an empty ledger for non-objects', () => {
    for (const bad of [null, undefined, 'x', 42, [], [1, 2]]) {
      expect(normalizeLedger(bad)).toEqual(emptyLedger());
    }
  });

  test('repairs negative, NaN and wrong-typed fields', () => {
    const repaired = normalizeLedger({
      totalPlanted: -5,
      totalBuried: Number.NaN,
      longestNeglectMs: 'nope',
      longestLifespanMs: Infinity,
      peakAlive: 3.7,
      burnCount: null,
      firstPlantedAt: 'soon',
      unlocked: ['a', 7, 'a', 'b'],
    });
    expect(repaired.totalPlanted).toBe(0);
    expect(repaired.totalBuried).toBe(0);
    expect(repaired.longestNeglectMs).toBe(0);
    expect(repaired.longestLifespanMs).toBe(0);
    expect(repaired.peakAlive).toBe(3);
    expect(repaired.burnCount).toBe(0);
    expect(repaired.firstPlantedAt).toBeNull();
    expect(repaired.unlocked).toEqual(['a', 'b']);
  });

  test('preserves a well-formed ledger round-trip', () => {
    const l: LifetimeLedger = {
      ...emptyLedger(),
      totalPlanted: 4,
      totalBuried: 2,
      longestNeglectMs: 900,
      firstPlantedAt: T0,
      unlocked: ['first-sprout'],
    };
    expect(normalizeLedger(JSON.parse(JSON.stringify(l)))).toEqual(l);
  });
});

describe('recordPlanted', () => {
  test('increments the lifetime count and stamps the first planting', () => {
    const l = recordPlanted(emptyLedger(), T0);
    expect(l.totalPlanted).toBe(1);
    expect(l.firstPlantedAt).toBe(T0);
  });

  test('never overwrites the original first planting', () => {
    const l = recordPlanted(recordPlanted(emptyLedger(), T0), T0 + 999_999);
    expect(l.totalPlanted).toBe(2);
    expect(l.firstPlantedAt).toBe(T0);
  });

  test('does not mutate its input', () => {
    const base = emptyLedger();
    recordPlanted(base, T0);
    expect(base.totalPlanted).toBe(0);
  });
});

describe('recordBuried', () => {
  test('is a no-op for an empty burial batch', () => {
    const base = emptyLedger();
    expect(recordBuried(base, [])).toBe(base);
  });

  test('counts every entry in the batch', () => {
    const l = recordBuried(emptyLedger(), [grave(), grave({ id: 'g2' })]);
    expect(l.totalBuried).toBe(2);
  });

  test('raises the neglect and lifespan records to the batch maximum', () => {
    const l = recordBuried(emptyLedger(), [
      grave({ neglectMsAtDeath: 500, lifespanMs: 100 }),
      grave({ id: 'g2', neglectMsAtDeath: 8000, lifespanMs: 60_000 }),
    ]);
    expect(l.longestNeglectMs).toBe(8000);
    expect(l.longestLifespanMs).toBe(60_000);
  });

  test('never lowers an existing record', () => {
    const high: LifetimeLedger = {
      ...emptyLedger(),
      longestNeglectMs: 99_999,
      longestLifespanMs: 99_999,
    };
    const l = recordBuried(high, [grave({ neglectMsAtDeath: 1, lifespanMs: 1 })]);
    expect(l.longestNeglectMs).toBe(99_999);
    expect(l.longestLifespanMs).toBe(99_999);
  });

  test('ignores negative durations from a skewed clock', () => {
    const l = recordBuried(emptyLedger(), [
      grave({ neglectMsAtDeath: -100, lifespanMs: -100 }),
    ]);
    expect(l.longestNeglectMs).toBe(0);
    expect(l.longestLifespanMs).toBe(0);
  });
});

describe('recordNeglect', () => {
  test('raises the record for a still-living plant', () => {
    expect(recordNeglect(emptyLedger(), 4200).longestNeglectMs).toBe(4200);
  });

  test('returns the same object when nothing improves (cheap no-op)', () => {
    const l = recordNeglect(emptyLedger(), 4200);
    expect(recordNeglect(l, 100)).toBe(l);
  });

  test('clamps negatives', () => {
    expect(recordNeglect(emptyLedger(), -50).longestNeglectMs).toBe(0);
  });
});

describe('recordAlive', () => {
  test('tracks the peak simultaneous tab count', () => {
    let l = recordAlive(emptyLedger(), 3);
    expect(l.peakAlive).toBe(3);
    l = recordAlive(l, 7);
    expect(l.peakAlive).toBe(7);
  });

  test('never drops when the count falls again', () => {
    const l = recordAlive(recordAlive(emptyLedger(), 7), 1);
    expect(l.peakAlive).toBe(7);
  });
});

describe('recordBurn', () => {
  test('counts burns without touching any other total (AC-400a)', () => {
    const before: LifetimeLedger = {
      ...emptyLedger(),
      totalPlanted: 9,
      totalBuried: 4,
      longestNeglectMs: 1234,
    };
    const after = recordBurn(before);
    expect(after.burnCount).toBe(1);
    expect(after.totalPlanted).toBe(9);
    expect(after.totalBuried).toBe(4);
    expect(after.longestNeglectMs).toBe(1234);
  });
});

describe('withUnlocked', () => {
  test('adds new ids', () => {
    expect(withUnlocked(emptyLedger(), ['a', 'b']).unlocked).toEqual(['a', 'b']);
  });

  test('is idempotent and returns the same object when nothing is new (AC-402a)', () => {
    const l = withUnlocked(emptyLedger(), ['a']);
    expect(withUnlocked(l, ['a'])).toBe(l);
    expect(withUnlocked(l, [])).toBe(l);
  });

  test('unlocking is irreversible across merges', () => {
    const l = withUnlocked(withUnlocked(emptyLedger(), ['a']), ['b']);
    expect(l.unlocked).toEqual(['a', 'b']);
  });
});

describe('monotonicity invariant (AC-400b)', () => {
  test('no sequence of operations ever lowers a lifetime total', () => {
    let l = emptyLedger();
    const snapshots: LifetimeLedger[] = [l];
    const ops: Array<(x: LifetimeLedger) => LifetimeLedger> = [
      (x) => recordPlanted(x, T0),
      (x) => recordBuried(x, [grave({ neglectMsAtDeath: 5000, lifespanMs: 7000 })]),
      (x) => recordAlive(x, 5),
      (x) => recordNeglect(x, 3000),
      (x) => recordBurn(x),
      (x) => recordBuried(x, [grave({ neglectMsAtDeath: 10, lifespanMs: 10 })]),
      (x) => recordAlive(x, 2),
      (x) => withUnlocked(x, ['z']),
    ];
    for (const op of ops) {
      l = op(l);
      snapshots.push(l);
    }
    for (let i = 1; i < snapshots.length; i += 1) {
      const prev = snapshots[i - 1] as LifetimeLedger;
      const cur = snapshots[i] as LifetimeLedger;
      expect(cur.totalPlanted).toBeGreaterThanOrEqual(prev.totalPlanted);
      expect(cur.totalBuried).toBeGreaterThanOrEqual(prev.totalBuried);
      expect(cur.longestNeglectMs).toBeGreaterThanOrEqual(prev.longestNeglectMs);
      expect(cur.longestLifespanMs).toBeGreaterThanOrEqual(prev.longestLifespanMs);
      expect(cur.peakAlive).toBeGreaterThanOrEqual(prev.peakAlive);
      expect(cur.unlocked.length).toBeGreaterThanOrEqual(prev.unlocked.length);
    }
  });
});
