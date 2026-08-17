import { describe, expect, it } from 'vitest';
import {
  buildBodyPath,
  buildEyeBallPath,
  buildEyeFramePath,
  buildGridPath,
  computeLogoMask,
  countMaskedModules,
  eyeBallShape,
  eyeFrameShape,
  isMasked,
} from './paths';
import { generateMatrix, isDark, isInFinder } from './qr';
import type { LogoConfig } from './types';

const LOGO: LogoConfig = {
  dataUrl: 'data:image/png;base64,AA',
  name: 'logo.png',
  sizeRatio: 0.2,
  padding: 1,
  frame: 'rounded',
};

describe('computeLogoMask', () => {
  it('centres the mask and grows it by the padding on both sides', () => {
    const mask = computeLogoMask(25, LOGO);
    expect(mask).not.toBeNull();
    if (!mask) return;

    expect(mask.size).toBeCloseTo(25 * 0.2 + 2, 6);
    expect(mask.x).toBeCloseTo((25 - mask.size) / 2, 6);
    expect(mask.x + mask.size / 2).toBeCloseTo(12.5, 6);
  });

  it('returns null without a logo', () => {
    expect(computeLogoMask(25, null)).toBeNull();
  });
});

describe('isMasked', () => {
  // Deliberately not grid-aligned: real masks land on fractional coordinates.
  const mask = { x: 10.5, y: 10.5, size: 4 };

  it('masks a module that only partially overlaps the square', () => {
    expect(isMasked(mask, 10, 10)).toBe(true);
    expect(isMasked(mask, 14, 14)).toBe(true);
  });

  it('leaves modules outside the square alone', () => {
    expect(isMasked(mask, 9, 12)).toBe(false);
    expect(isMasked(mask, 15, 12)).toBe(false);
  });

  it('treats a shared edge as no overlap', () => {
    expect(isMasked({ x: 10, y: 10, size: 5 }, 9, 12)).toBe(false);
    expect(isMasked({ x: 10, y: 10, size: 5 }, 15, 12)).toBe(false);
  });

  it('masks nothing when there is no mask', () => {
    expect(isMasked(null, 0, 0)).toBe(false);
  });
});

describe('countMaskedModules', () => {
  it('counts every overlapping module', () => {
    expect(countMaskedModules(25, { x: 10.5, y: 10.5, size: 4 })).toBe(5 * 5);
  });

  it('counts an exactly grid-aligned mask without spilling over', () => {
    expect(countMaskedModules(25, { x: 10, y: 10, size: 5 })).toBe(5 * 5);
  });

  it('counts zero without a mask', () => {
    expect(countMaskedModules(25, null)).toBe(0);
  });
});

describe('buildGridPath', () => {
  const single = (row: number, col: number) => row === 0 && col === 0;

  it('draws a plain square for the square style', () => {
    expect(buildGridPath(1, single, 'square', 0)).toBe('M0 0H1V1H0V0Z');
  });

  it('draws a full circle for an isolated module in fluid style', () => {
    expect(buildGridPath(1, single, 'fluid', 0)).toBe(buildGridPath(1, single, 'dot', 0));
  });

  it('leaves the shared edge of two neighbours square in fluid style', () => {
    const pair = (row: number, col: number) => row === 0 && (col === 0 || col === 1);
    const d = buildGridPath(2, pair, 'fluid', 0);
    // Four outer corners across the pair, none on the seam.
    expect(d.match(/A/g)).toHaveLength(4);
  });

  it('applies the offset to every module', () => {
    expect(buildGridPath(1, single, 'square', 4)).toBe('M4 4H5V5H4V4Z');
  });

  it('returns an empty string when nothing is drawn', () => {
    expect(buildGridPath(5, () => false, 'square', 0)).toBe('');
  });
});

describe('buildBodyPath', () => {
  it('omits every finder module and every masked module', () => {
    const result = generateMatrix('https://example.com/scan-me', 'H');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { matrix } = result;
    const mask = computeLogoMask(matrix.size, LOGO);
    const d = buildBodyPath(matrix, 'square', mask, 0);

    let expected = 0;
    for (let row = 0; row < matrix.size; row += 1) {
      for (let col = 0; col < matrix.size; col += 1) {
        if (isDark(matrix, row, col) && !isInFinder(matrix.size, row, col) && !isMasked(mask, row, col)) {
          expected += 1;
        }
      }
    }

    expect(d.match(/M/g) ?? []).toHaveLength(expected);
    expect(expected).toBeGreaterThan(0);
  });
});

describe('finder paths', () => {
  it('emits an outer and an inner outline for each of the three finders', () => {
    const d = buildEyeFramePath(25, 'square', 0);
    expect(d.match(/M/g)).toHaveLength(6);
  });

  it('emits one shape per finder centre', () => {
    const d = buildEyeBallPath(25, 'circle', 0);
    expect(d.match(/M/g)).toHaveLength(3);
  });

  it('mirrors the leaf orientation away from the top-left finder', () => {
    expect(eyeBallShape(0, 0, 'leaf', 0)).not.toBe(eyeBallShape(0, 0, 'leaf', 1));
    expect(eyeBallShape(0, 0, 'leaf', 1)).toBe(eyeBallShape(0, 0, 'leaf', 2));
  });

  it('does not mirror the non-leaf styles', () => {
    expect(eyeFrameShape(0, 0, 'rounded', 0)).toBe(eyeFrameShape(0, 0, 'rounded', 1));
  });
});
