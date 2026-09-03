import { describe, expect, it } from 'vitest';

import { MIN_OVERLAP_PX, detectOverlapGray } from '../../src/core/alignment';
import { squashWidth } from '../../src/core/gray-scale';
import type { GrayImage } from '../../src/core/types';
import { noiseImage, overlappingPair, solidImage } from '../helpers/gray-fixtures';

/**
 * Mirrors what the imaging layer hands the detector in the browser: a
 * width-squashed (but full-height) pair for the coarse pass and the
 * full-resolution pair for the fine pass.
 */
function detect(upper: GrayImage, lower: GrayImage, coarseWidth = 32) {
  return detectOverlapGray({
    coarseUpper: squashWidth(upper, coarseWidth),
    coarseLower: squashWidth(lower, coarseWidth),
    fineUpper: upper,
    fineLower: lower,
  });
}

describe('detectOverlapGray', () => {
  it('recovers a known overlap exactly (AC-101)', () => {
    const { upper, lower } = overlappingPair(64, 400, 400, 137, 11);
    const result = detect(upper, lower);
    expect(result.overlapPx).toBe(137);
    expect(result.cost).toBe(0);
    expect(result.matched).toBe(true);
  });

  it('recovers a large overlap that forces row sampling in the coarse pass (AC-104)', () => {
    // 1200 shared rows means the coarse pass samples ~256 of them. An
    // implementation that averaged rows together instead of sampling them
    // would blur the single-pixel cost spike and miss the exact offset.
    const { upper, lower } = overlappingPair(48, 2000, 2000, 1200, 12);
    const result = detect(upper, lower);
    expect(result.overlapPx).toBe(1200);
    expect(result.cost).toBe(0);
  });

  it('recovers a small overlap just above the minimum', () => {
    const { upper, lower } = overlappingPair(64, 300, 300, MIN_OVERLAP_PX + 1, 13);
    expect(detect(upper, lower).overlapPx).toBe(MIN_OVERLAP_PX + 1);
  });

  it('recovers overlaps at several sizes', () => {
    for (const overlap of [20, 55, 199, 640]) {
      const { upper, lower } = overlappingPair(40, 800, 800, overlap, overlap);
      expect(detect(upper, lower).overlapPx).toBe(overlap);
    }
  });

  it('reports no match for unrelated images (AC-102)', () => {
    const upper = noiseImage(64, 400, 21);
    const lower = noiseImage(64, 400, 22);
    const result = detect(upper, lower);
    expect(result.matched).toBe(false);
    expect(result.cost).toBeGreaterThan(12);
  });

  it('never proposes an overlap beyond the search ceiling for identical images (AC-103)', () => {
    const image = noiseImage(64, 300, 31);
    const result = detect(image, image);
    expect(result.overlapPx).toBeLessThanOrEqual(result.maxOverlapPx);
    expect(result.maxOverlapPx).toBe(Math.floor(300 * 0.95));
    expect(Number.isFinite(result.cost)).toBe(true);
  });

  it('handles images too short to overlap without throwing (AC-106)', () => {
    const upper = noiseImage(8, 4, 41);
    const lower = noiseImage(8, 4, 42);
    const result = detect(upper, lower, 8);
    expect(result.overlapPx).toBe(0);
    expect(result.matched).toBe(false);
    expect(result.maxOverlapPx).toBe(0);
  });

  it('handles a zero-height image', () => {
    const upper = noiseImage(8, 0, 43);
    const lower = noiseImage(8, 10, 44);
    const result = detect(upper, lower, 8);
    expect(result.overlapPx).toBe(0);
    expect(result.matched).toBe(false);
  });

  it('matches a flat solid pair at the search ceiling rather than failing (E-07)', () => {
    const upper = solidImage(32, 200, 255);
    const lower = solidImage(32, 200, 255);
    const result = detect(upper, lower);
    expect(result.cost).toBe(0);
    expect(result.overlapPx).toBeLessThanOrEqual(result.maxOverlapPx);
  });

  it('respects an explicit overlap ceiling', () => {
    const { upper, lower } = overlappingPair(64, 400, 400, 137, 51);
    const result = detectOverlapGray({
      coarseUpper: squashWidth(upper, 32),
      coarseLower: squashWidth(lower, 32),
      fineUpper: upper,
      fineLower: lower,
      maxOverlapPx: 100,
    });
    expect(result.maxOverlapPx).toBe(100);
    expect(result.overlapPx).toBeLessThanOrEqual(100);
  });

  it('is unaffected by the shots having different heights', () => {
    const { upper, lower } = overlappingPair(64, 250, 900, 90, 61);
    expect(detect(upper, lower).overlapPx).toBe(90);
  });
});

describe('squashWidth', () => {
  it('preserves height exactly (the coarse pass must never downscale rows)', () => {
    const source = noiseImage(200, 137, 71);
    const squashed = squashWidth(source, 20);
    expect(squashed.height).toBe(137);
    expect(squashed.width).toBe(20);
  });

  it('returns the source untouched when it is already narrow enough', () => {
    const source = noiseImage(10, 20, 72);
    expect(squashWidth(source, 40)).toBe(source);
  });

  it('averages the pixels that fall into each output column', () => {
    const data = new Uint8ClampedArray([0, 100, 200, 40]);
    const source: GrayImage = { data, width: 4, height: 1 };
    const squashed = squashWidth(source, 2);
    expect(Array.from(squashed.data)).toEqual([50, 120]);
  });

  it('handles a zero-width source', () => {
    const source: GrayImage = { data: new Uint8ClampedArray(0), width: 0, height: 0 };
    expect(squashWidth(source, 8)).toBe(source);
  });
});
