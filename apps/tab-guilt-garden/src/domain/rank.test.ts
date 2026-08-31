import { describe, expect, test } from 'vitest';
import { emptyLedger } from './ledger';
import { rankFor, rankProgress, RANKS } from './rank';
import type { LifetimeLedger } from './types';

function ledgerWith(totalBuried: number): LifetimeLedger {
  return { ...emptyLedger(), totalBuried };
}

describe('RANKS table', () => {
  test('thresholds are strictly ascending and start at zero', () => {
    expect(RANKS[0]?.threshold).toBe(0);
    for (let i = 1; i < RANKS.length; i += 1) {
      expect(RANKS[i]!.threshold).toBeGreaterThan(RANKS[i - 1]!.threshold);
    }
  });

  test('every rank has a distinct id and a label', () => {
    expect(new Set(RANKS.map((r) => r.id)).size).toBe(RANKS.length);
    for (const r of RANKS) expect(r.label.length).toBeGreaterThan(0);
  });
});

describe('rankFor', () => {
  test.each([
    [0, '無垢'],
    [1, '軽犯罪'],
    [2, '軽犯罪'],
    [3, '常習犯'],
    [5, '常習犯'],
    [6, '重罪人'],
    [10, '重罪人'],
    [11, '庭の破壊神'],
    [999, '庭の破壊神'],
  ])('%i burials -> %s', (buried, label) => {
    expect(rankFor(buried).label).toBe(label);
  });

  test('treats a negative count as innocent rather than throwing', () => {
    expect(rankFor(-5).label).toBe('無垢');
  });
});

describe('rankProgress', () => {
  test('reports progress toward the next rank', () => {
    const p = rankProgress(ledgerWith(2));
    expect(p.current.label).toBe('軽犯罪');
    expect(p.next?.label).toBe('常習犯');
    expect(p.remaining).toBe(1);
    expect(p.ratio).toBeCloseTo(0.5, 5);
    expect(p.isMax).toBe(false);
  });

  test('is zero-progress immediately after promotion', () => {
    const p = rankProgress(ledgerWith(3));
    expect(p.current.label).toBe('常習犯');
    expect(p.ratio).toBe(0);
    expect(p.remaining).toBe(3);
  });

  test('flags the top rank instead of pinning a full bar (AC-401a)', () => {
    const p = rankProgress(ledgerWith(11));
    expect(p.isMax).toBe(true);
    expect(p.next).toBeNull();
    expect(p.remaining).toBe(0);
    expect(p.ratio).toBe(1);
  });

  test('stays at max well past the final threshold', () => {
    expect(rankProgress(ledgerWith(500)).isMax).toBe(true);
  });

  test('ratio always stays within 0..1', () => {
    for (let n = 0; n <= 20; n += 1) {
      const r = rankProgress(ledgerWith(n)).ratio;
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  test('rank never regresses as burials accumulate', () => {
    let lastIndex = -1;
    for (let n = 0; n <= 30; n += 1) {
      const idx = RANKS.findIndex((r) => r.id === rankProgress(ledgerWith(n)).current.id);
      expect(idx).toBeGreaterThanOrEqual(lastIndex);
      lastIndex = idx;
    }
  });
});
