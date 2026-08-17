import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  convertPaint,
  gradientVector,
  normalizeHex,
  paintToCss,
  relativeLuminance,
  worstContrast,
} from './color';
import type { Paint } from './types';

describe('normalizeHex', () => {
  it('expands three-digit shorthand', () => {
    expect(normalizeHex('#f0a')).toBe('#ff00aa');
  });

  it('accepts input without a leading hash and normalises case', () => {
    expect(normalizeHex('AABBCC')).toBe('#aabbcc');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeHex('  #123456 ')).toBe('#123456');
  });

  it('rejects anything that is not a hex colour', () => {
    expect(normalizeHex('rebeccapurple')).toBeNull();
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('')).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('anchors black at 0 and white at 1', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });
});

describe('contrastRatio', () => {
  it('returns 21 for black against white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBeCloseTo(
      contrastRatio('#fedcba', '#123456'),
      10,
    );
  });

  it('returns 1 for identical colours', () => {
    expect(contrastRatio('#808080', '#808080')).toBeCloseTo(1, 10);
  });
});

describe('worstContrast', () => {
  it('uses the weakest stop of a gradient, not the average', () => {
    const foreground: Paint = { kind: 'linear', from: '#000000', to: '#eeeeee', angle: 0 };
    const background: Paint = { kind: 'solid', color: '#ffffff' };
    expect(worstContrast(foreground, background)).toBeCloseTo(
      contrastRatio('#eeeeee', '#ffffff'),
      6,
    );
  });
});

describe('gradientVector', () => {
  it('runs left to right at 0 degrees', () => {
    const v = gradientVector(0);
    expect(v.x1).toBeCloseTo(0, 6);
    expect(v.x2).toBeCloseTo(1, 6);
    expect(v.y1).toBeCloseTo(0.5, 6);
    expect(v.y2).toBeCloseTo(0.5, 6);
  });

  it('runs top to bottom at 90 degrees', () => {
    const v = gradientVector(90);
    expect(v.y1).toBeCloseTo(0, 6);
    expect(v.y2).toBeCloseTo(1, 6);
    expect(v.x1).toBeCloseTo(0.5, 6);
  });
});

describe('convertPaint', () => {
  it('carries the solid colour into both gradient stops', () => {
    expect(convertPaint({ kind: 'solid', color: '#ff0000' }, 'linear')).toEqual({
      kind: 'linear',
      from: '#ff0000',
      to: '#ff0000',
      angle: 135,
    });
  });

  it('keeps the first stop when collapsing to solid', () => {
    const linear: Paint = { kind: 'linear', from: '#111111', to: '#222222', angle: 20 };
    expect(convertPaint(linear, 'solid')).toEqual({ kind: 'solid', color: '#111111' });
  });

  it('preserves both stops between gradient kinds', () => {
    const linear: Paint = { kind: 'linear', from: '#111111', to: '#222222', angle: 20 };
    expect(convertPaint(linear, 'radial')).toEqual({
      kind: 'radial',
      from: '#111111',
      to: '#222222',
    });
  });

  it('is a no-op when the mode already matches', () => {
    const paint: Paint = { kind: 'solid', color: '#abcdef' };
    expect(convertPaint(paint, 'solid')).toBe(paint);
  });
});

describe('paintToCss', () => {
  it('maps a transparent background to the transparent keyword', () => {
    expect(paintToCss(null)).toBe('transparent');
  });

  it('offsets the angle by 90 degrees to match CSS conventions', () => {
    expect(paintToCss({ kind: 'linear', from: '#000000', to: '#ffffff', angle: 0 })).toBe(
      'linear-gradient(90deg, #000000, #ffffff)',
    );
  });
});
