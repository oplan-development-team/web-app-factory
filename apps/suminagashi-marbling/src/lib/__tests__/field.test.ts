import { describe, expect, it } from 'vitest';
import {
  applyCombStamp,
  applySwirlStamp,
  clampMagnitude,
  commitDelta,
  createField,
  sampleFieldBilinear,
  subtractDelta,
  zeroField,
} from '../field';

describe('sampleFieldBilinear', () => {
  it('returns zero for a freshly created field', () => {
    const field = createField(16);
    const [dx, dy] = sampleFieldBilinear(field, 0.3, 0.7);
    expect(dx).toBe(0);
    expect(dy).toBe(0);
  });

  it('wraps sampling across the toroidal boundary without throwing', () => {
    const field = createField(16);
    expect(() => sampleFieldBilinear(field, -0.2, 1.4)).not.toThrow();
  });
});

describe('clampMagnitude', () => {
  it('leaves small vectors untouched', () => {
    const [x, y] = clampMagnitude(0.01, 0.01, 0.5);
    expect(x).toBeCloseTo(0.01);
    expect(y).toBeCloseTo(0.01);
  });

  it('scales down vectors past the max magnitude', () => {
    const [x, y] = clampMagnitude(1, 0, 0.5);
    expect(x).toBeCloseTo(0.5);
    expect(y).toBeCloseTo(0);
  });
});

describe('comb/swirl stamps + commit/subtract', () => {
  it('a comb stamp perturbs the field near the stroke and commit/subtract round-trips to zero', () => {
    const field = createField(16);
    const delta = zeroField(16);
    applyCombStamp(delta, 16, 0.5, 0.5, 1, 0, 'medium', 0.05);

    const hasNonZero = delta.some((v) => v !== 0);
    expect(hasNonZero).toBe(true);

    commitDelta(field, delta);
    const committedHasNonZero = field.data.some((v) => v !== 0);
    expect(committedHasNonZero).toBe(true);

    subtractDelta(field, delta);
    const allZero = field.data.every((v) => v === 0);
    expect(allZero).toBe(true);
  });

  it('a swirl stamp adds a rotational contribution near its center', () => {
    const delta = zeroField(16);
    applySwirlStamp(delta, 16, 0.5, 0.5, 0, 1, 0.05);
    const hasNonZero = delta.some((v) => v !== 0);
    expect(hasNonZero).toBe(true);
  });
});
