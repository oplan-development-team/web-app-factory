import { describe, expect, it } from 'vitest';
import { toroidalDistance, wrapCoord, wrapDelta } from '../toroidal';

describe('wrapCoord', () => {
  it('wraps values into [0, 1)', () => {
    expect(wrapCoord(1.25)).toBeCloseTo(0.25);
    expect(wrapCoord(-0.25)).toBeCloseTo(0.75);
    expect(wrapCoord(0.5)).toBeCloseTo(0.5);
  });
});

describe('wrapDelta', () => {
  it('returns the shortest signed delta across the seam', () => {
    expect(wrapDelta(0.05, 0.95)).toBeCloseTo(0.1);
    expect(wrapDelta(0.95, 0.05)).toBeCloseTo(-0.1);
    expect(wrapDelta(0.5, 0.5)).toBeCloseTo(0);
  });
});

describe('toroidalDistance', () => {
  it('measures distance through the wrap when shorter than the direct path', () => {
    // Two points near opposite edges are actually close through the seam.
    const wrapped = toroidalDistance(0.02, 0.5, 0.98, 0.5);
    expect(wrapped).toBeCloseTo(0.04, 5);
  });

  it('matches direct euclidean distance for nearby interior points', () => {
    const d = toroidalDistance(0.3, 0.3, 0.35, 0.3);
    expect(d).toBeCloseTo(0.05, 5);
  });

  it('is zero for coincident points, including across the seam', () => {
    expect(toroidalDistance(0, 0.5, 1, 0.5)).toBeCloseTo(0, 5);
  });
});
