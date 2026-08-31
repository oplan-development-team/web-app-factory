import { describe, expect, it } from 'vitest';
import { computeNormal, filmColorAt, hslToRgb, shadeCell, specularIntensity } from './color';

describe('filmColorAt', () => {
  it('starts at the teal anchor when t=0', () => {
    const [r, g, b] = filmColorAt(0);
    // teal: low red, high green/blue
    expect(r).toBeLessThan(g);
    expect(r).toBeLessThan(b);
  });

  it('wraps back to the teal anchor at t=1', () => {
    const a = filmColorAt(0);
    const b = filmColorAt(1);
    expect(a[0]).toBeCloseTo(b[0], 0);
    expect(a[1]).toBeCloseTo(b[1], 0);
    expect(a[2]).toBeCloseTo(b[2], 0);
  });

  it('passes through the magenta anchor around t=1/3', () => {
    const [r, g, b] = filmColorAt(1 / 3);
    // magenta: red and blue dominate, green is the low channel
    expect(g).toBeLessThan(r);
    expect(g).toBeLessThan(b);
  });

  it('passes through the gold anchor around t=2/3', () => {
    const [r, g, b] = filmColorAt(2 / 3);
    // gold: red and green dominate, blue is the low channel
    expect(b).toBeLessThan(r);
    expect(b).toBeLessThan(g);
  });

  it('is cyclic: filmColorAt(t) === filmColorAt(t + 1)', () => {
    const a = filmColorAt(0.2);
    const b = filmColorAt(1.2);
    expect(a[0]).toBeCloseTo(b[0], 3);
    expect(a[1]).toBeCloseTo(b[1], 3);
    expect(a[2]).toBeCloseTo(b[2], 3);
  });

  it('always returns byte-range RGB values', () => {
    for (let t = -3; t < 3; t += 0.13) {
      const [r, g, b] = filmColorAt(t);
      for (const c of [r, g, b]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('hslToRgb', () => {
  it('converts pure red correctly', () => {
    expect(hslToRgb(0, 1, 0.5)).toEqual([255, 0, 0]);
  });

  // Regression test: an earlier version of hp's normalization
  // (`((h % 360) + 360) / 60` instead of `(((h % 360) + 360) % 360) / 60`)
  // pushed every positive hue into the same HSL sector, so green/yellow/cyan
  // silently came out as red/magenta. Cover the full wheel, not just red,
  // since red alone happened to survive that bug by coincidence.
  it('converts each primary/secondary hue to the right RGB corner', () => {
    expect(hslToRgb(60, 1, 0.5)).toEqual([255, 255, 0]); // yellow
    expect(hslToRgb(120, 1, 0.5)).toEqual([0, 255, 0]); // green
    expect(hslToRgb(180, 1, 0.5)).toEqual([0, 255, 255]); // cyan
    expect(hslToRgb(240, 1, 0.5)).toEqual([0, 0, 255]); // blue
    expect(hslToRgb(300, 1, 0.5)).toEqual([255, 0, 255]); // magenta
  });

  it('converts black and white', () => {
    expect(hslToRgb(0, 0, 0)).toEqual([0, 0, 0]);
    expect(hslToRgb(0, 0, 1)).toEqual([255, 255, 255]);
  });
});

describe('computeNormal', () => {
  it('returns straight-up normal for a flat field', () => {
    const n = computeNormal(0, 0, 0, 0);
    expect(n.x).toBeCloseTo(0);
    expect(n.y).toBeCloseTo(0);
    expect(n.z).toBeCloseTo(1);
  });

  it('tilts away from a rising slope', () => {
    const n = computeNormal(0, 1, 0, 0); // right side higher
    expect(n.x).toBeLessThan(0);
  });

  it('always returns a unit vector', () => {
    const n = computeNormal(0.3, -0.4, 0.7, -0.2);
    const len = Math.hypot(n.x, n.y, n.z);
    expect(len).toBeCloseTo(1, 5);
  });
});

describe('specularIntensity', () => {
  it('is maximal when the normal faces the light directly', () => {
    const v = specularIntensity({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 });
    expect(v).toBeCloseTo(1);
  });

  it('is zero when facing away from the light', () => {
    const v = specularIntensity({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 });
    expect(v).toBe(0);
  });
});

describe('shadeCell', () => {
  it('returns valid RGB byte triples', () => {
    const [r, g, b] = shadeCell({
      height: 0.4,
      normal: { x: 0, y: 0, z: 1 },
      light: { x: 0.3, y: -0.4, z: 0.8 },
      phase: 0,
    });
    for (const c of [r, g, b]) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(255);
    }
  });
});
