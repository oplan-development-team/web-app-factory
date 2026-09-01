import { describe, expect, it } from 'vitest';

import { rowIndices, seamCost } from '../../src/core/gray';
import { noiseImage, overlappingPair, sliceRows, solidImage } from '../helpers/gray-fixtures';

describe('rowIndices', () => {
  it('returns every row when the band fits within the sample budget', () => {
    expect(rowIndices(5, 16)).toEqual([0, 1, 2, 3, 4]);
  });

  it('spreads samples evenly across the band when the budget is exceeded', () => {
    const indices = rowIndices(100, 4);
    expect(indices).toHaveLength(4);
    expect(indices[0]).toBe(0);
    expect(indices.every((v, i) => i === 0 || v > (indices[i - 1] as number))).toBe(true);
    expect(indices.every((v) => v >= 0 && v < 100)).toBe(true);
  });

  it('returns an empty list for a zero-height band', () => {
    expect(rowIndices(0, 16)).toEqual([]);
  });

  it('never returns fewer than one row for a non-empty band', () => {
    expect(rowIndices(50, 0)).toEqual([0]);
  });
});

describe('seamCost', () => {
  it('is zero for a genuinely shared band', () => {
    const { upper, lower } = overlappingPair(24, 60, 60, 20, 1);
    expect(seamCost(upper, lower, 20)).toBe(0);
  });

  it('is zero for a shared band even when only a few rows are sampled', () => {
    const { upper, lower } = overlappingPair(24, 200, 200, 120, 2);
    expect(seamCost(upper, lower, 120, 8)).toBe(0);
  });

  it('rises sharply when the band is off by a single row', () => {
    const { upper, lower } = overlappingPair(24, 200, 200, 120, 3);
    expect(seamCost(upper, lower, 119)).toBeGreaterThan(40);
    expect(seamCost(upper, lower, 121)).toBeGreaterThan(40);
  });

  it('measures the mean absolute difference', () => {
    const upper = solidImage(4, 4, 100);
    const lower = solidImage(4, 4, 130);
    expect(seamCost(upper, lower, 4)).toBeCloseTo(30, 6);
  });

  it('returns Infinity when the band cannot exist', () => {
    const a = noiseImage(4, 4, 4);
    const b = noiseImage(4, 4, 5);
    expect(seamCost(a, b, 0)).toBe(Infinity);
    expect(seamCost(a, b, 5)).toBe(Infinity);
    expect(seamCost(a, b, -1)).toBe(Infinity);
  });

  it('compares only the shared width when widths differ', () => {
    const wide = solidImage(8, 4, 50);
    const narrow = sliceRows(solidImage(4, 4, 50), 0, 4);
    expect(seamCost(wide, narrow, 4)).toBe(0);
  });
});
