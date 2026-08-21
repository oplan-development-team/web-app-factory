import { describe, expect, it } from 'vitest';
import { mixAmount } from './halftone';

const EDGE = 1.0;
const CORNER = 0.55;

describe('mixAmount', () => {
  it('is zero at lambda 0 for every position', () => {
    expect(mixAmount(0, EDGE)).toBe(0);
    expect(mixAmount(0, CORNER)).toBe(0);
  });

  it('reaches full lock at lambda 1 for every position', () => {
    expect(mixAmount(1, EDGE)).toBeCloseTo(1);
    expect(mixAmount(1, CORNER)).toBeCloseTo(1);
  });

  it('increases monotonically with lambda', () => {
    for (const weight of [EDGE, CORNER]) {
      let previous = -1;
      for (let lambda = 0; lambda <= 1.0001; lambda += 0.05) {
        const value = mixAmount(lambda, weight);
        expect(value).toBeGreaterThan(previous);
        previous = value;
      }
    }
  });

  it('keeps corners lagging behind edges in the middle of the range', () => {
    for (const lambda of [0.2, 0.35, 0.5, 0.8]) {
      expect(mixAmount(lambda, CORNER)).toBeLessThan(mixAmount(lambda, EDGE));
    }
  });

  it('stays within 0..1', () => {
    for (const weight of [EDGE, CORNER]) {
      for (let lambda = 0; lambda <= 1; lambda += 0.1) {
        const value = mixAmount(lambda, weight);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});
