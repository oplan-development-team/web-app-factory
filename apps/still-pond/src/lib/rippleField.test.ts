import { describe, expect, it } from 'vitest';
import {
  buildRippleOctaves,
  computeHeightField,
  heightFieldToNormalRGBA,
  sampleRippleHeight,
} from './rippleField';

describe('buildRippleOctaves', () => {
  it('is deterministic for the same seed', () => {
    expect(buildRippleOctaves(42)).toEqual(buildRippleOctaves(42));
  });

  it('produces different octaves for different seeds', () => {
    expect(buildRippleOctaves(1)).not.toEqual(buildRippleOctaves(2));
  });

  it('returns the requested number of octaves', () => {
    expect(buildRippleOctaves(1, 6)).toHaveLength(6);
  });
});

describe('computeHeightField', () => {
  it('returns a size*size field', () => {
    const field = computeHeightField(8, 1);
    expect(field.length).toBe(64);
  });

  it('is deterministic for the same seed', () => {
    expect(computeHeightField(8, 7)).toEqual(computeHeightField(8, 7));
  });

  it('differs for different seeds', () => {
    expect(computeHeightField(8, 1)).not.toEqual(computeHeightField(8, 2));
  });
});

describe('sampleRippleHeight', () => {
  it('returns 0 for an empty octave list', () => {
    expect(sampleRippleHeight([], 0.3, 0.7)).toBe(0);
  });
});

describe('heightFieldToNormalRGBA', () => {
  it('encodes a flat field as the straight-up normal (128, 128, 255) everywhere', () => {
    const size = 4;
    const flat = new Float64Array(size * size);
    const rgba = heightFieldToNormalRGBA(flat, size);
    for (let i = 0; i < size * size; i++) {
      expect(rgba[i * 4]).toBe(128);
      expect(rgba[i * 4 + 1]).toBe(128);
      expect(rgba[i * 4 + 2]).toBe(255);
      expect(rgba[i * 4 + 3]).toBe(255);
    }
  });

  it('produces a buffer of size*size*4 bytes', () => {
    const size = 5;
    const rgba = heightFieldToNormalRGBA(new Float64Array(size * size), size);
    expect(rgba.length).toBe(size * size * 4);
  });

  it('keeps every channel within the valid 0-255 byte range', () => {
    const size = 6;
    const field = computeHeightField(size, 3);
    const rgba = heightFieldToNormalRGBA(field, size);
    for (const channel of rgba) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(255);
    }
  });

  it('produces varying normals for a non-flat field (visible ripple shading)', () => {
    const size = 8;
    const field = computeHeightField(size, 9);
    const rgba = heightFieldToNormalRGBA(field, size);
    const redChannels = new Set<number>();
    for (let i = 0; i < size * size; i++) {
      redChannels.add(rgba[i * 4] as number);
    }
    expect(redChannels.size).toBeGreaterThan(1);
  });
});
