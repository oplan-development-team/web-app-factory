import { describe, expect, it } from 'vitest';

import {
  CANVAS_AREA_LIMIT,
  CANVAS_AREA_WARN_RATIO,
  assessOutputSize,
  formatPx,
  outputFileName,
} from '../../src/core/output';
import { ALIGNED_COST, GRADE_LABEL, alignmentRatio, gradeCost } from '../../src/core/quality';

describe('assessOutputSize', () => {
  it('accepts a comfortable size', () => {
    expect(assessOutputSize(1179, 5000)).toBe('ok');
  });

  it('warns just below the limit', () => {
    const height = Math.ceil((CANVAS_AREA_LIMIT * CANVAS_AREA_WARN_RATIO) / 1179);
    expect(assessOutputSize(1179, height)).toBe('near-limit');
  });

  it('rejects above the limit', () => {
    expect(assessOutputSize(4096, 4097)).toBe('over-limit');
  });

  it('treats the exact limit as acceptable', () => {
    expect(assessOutputSize(4096, 4096)).toBe('near-limit');
    expect(assessOutputSize(4096, 4096)).not.toBe('over-limit');
  });

  it('handles degenerate sizes', () => {
    expect(assessOutputSize(0, 0)).toBe('ok');
    expect(assessOutputSize(-10, -10)).toBe('ok');
  });
});

describe('outputFileName', () => {
  it('encodes the timestamp with zero padding', () => {
    expect(outputFileName(new Date(2026, 8, 1, 6, 7, 8))).toBe('shot-splice-20260901-060708.png');
  });

  it('handles a two-digit month and time', () => {
    expect(outputFileName(new Date(2026, 11, 25, 23, 59, 59))).toBe('shot-splice-20261225-235959.png');
  });
});

describe('formatPx', () => {
  it('groups thousands', () => {
    expect(formatPx(12345)).toBe('12,345');
    expect(formatPx(7)).toBe('7');
  });

  it('rounds fractions', () => {
    expect(formatPx(1000.6)).toBe('1,001');
  });
});

describe('gradeCost', () => {
  it('grades a perfect seam as aligned', () => {
    expect(gradeCost(0)).toBe('aligned');
    expect(gradeCost(ALIGNED_COST)).toBe('aligned');
  });

  it('grades a believable seam as close', () => {
    expect(gradeCost(ALIGNED_COST + 0.1)).toBe('close');
    expect(gradeCost(12)).toBe('close');
  });

  it('grades an implausible seam as drifting', () => {
    expect(gradeCost(12.1)).toBe('drifting');
    expect(gradeCost(200)).toBe('drifting');
  });

  it('grades a missing or infinite cost as unknown', () => {
    expect(gradeCost(null)).toBe('unknown');
    expect(gradeCost(Infinity)).toBe('unknown');
    expect(gradeCost(Number.NaN)).toBe('unknown');
  });

  it('has a label for every grade', () => {
    expect(Object.keys(GRADE_LABEL).sort()).toEqual(['aligned', 'close', 'drifting', 'unknown']);
  });
});

describe('alignmentRatio', () => {
  it('is 1 for a perfect match and 0 for no information', () => {
    expect(alignmentRatio(0)).toBe(1);
    expect(alignmentRatio(null)).toBe(0);
    expect(alignmentRatio(Infinity)).toBe(0);
  });

  it('decreases monotonically as the cost grows', () => {
    const a = alignmentRatio(3);
    const b = alignmentRatio(10);
    const c = alignmentRatio(20);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it('bottoms out at zero', () => {
    expect(alignmentRatio(1000)).toBe(0);
  });

  it('stays inside 0..1', () => {
    for (const cost of [0, 1, 5, 12, 24, 48]) {
      const ratio = alignmentRatio(cost);
      expect(ratio).toBeGreaterThanOrEqual(0);
      expect(ratio).toBeLessThanOrEqual(1);
    }
  });
});
