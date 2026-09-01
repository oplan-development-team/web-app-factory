import { describe, expect, it } from 'vitest';

import { computeLayout, noCuts } from '../../src/core/layout';
import type { ShotSize } from '../../src/core/types';

const sizes = (...heights: readonly number[]): ShotSize[] =>
  heights.map((height) => ({ width: 100, height }));

describe('computeLayout', () => {
  it('returns an empty layout for no shots (E-01)', () => {
    const layout = computeLayout([], [], noCuts);
    expect(layout).toMatchObject({ width: 0, height: 0 });
    expect(layout.shots).toEqual([]);
    expect(layout.overlaps).toEqual([]);
  });

  it('passes a single shot through unchanged', () => {
    const layout = computeLayout(sizes(500), [], noCuts);
    expect(layout.width).toBe(100);
    expect(layout.height).toBe(500);
    expect(layout.shots[0]).toEqual({ cutTop: 0, cutBottom: 0, height: 500, y: 0 });
  });

  it('subtracts every overlap from the total height (AC-301)', () => {
    const layout = computeLayout(sizes(500, 400, 300), [120, 90], noCuts);
    expect(layout.height).toBe(500 + 400 + 300 - 120 - 90);
    expect(layout.shots.map((s) => s.y)).toEqual([0, 380, 690]);
  });

  it('uses the first shot width as the output width', () => {
    const layout = computeLayout([{ width: 320, height: 100 }, { width: 999, height: 100 }], [10], noCuts);
    expect(layout.width).toBe(320);
  });

  it('clamps an overlap that exceeds the pair maximum (AC-302)', () => {
    const layout = computeLayout(sizes(200, 200), [10_000], noCuts);
    expect(layout.overlaps[0]).toBe(layout.maxOverlaps[0]);
    expect(layout.height).toBeGreaterThan(0);
  });

  it('never lets the output shrink below the last shot (E-12)', () => {
    const layout = computeLayout(sizes(200, 300), [10_000], noCuts);
    expect(layout.height).toBeGreaterThanOrEqual(300);
  });

  it('clamps a negative overlap to zero', () => {
    const layout = computeLayout(sizes(200, 200), [-50], noCuts);
    expect(layout.overlaps[0]).toBe(0);
    expect(layout.height).toBe(400);
  });

  it('rounds fractional overlaps', () => {
    expect(computeLayout(sizes(200, 200), [42.7], noCuts).overlaps[0]).toBe(43);
  });

  it('treats a missing overlap entry as zero', () => {
    expect(computeLayout(sizes(200, 200), [], noCuts).height).toBe(400);
  });
});

describe('computeLayout with band cuts', () => {
  const cuts = { headerPx: 40, footerPx: 60, trimEnds: false };

  it('keeps the first header and the last footer by default (FR-205)', () => {
    const layout = computeLayout(sizes(500, 500, 500), [0, 0], cuts);
    expect(layout.shots.map((s) => [s.cutTop, s.cutBottom])).toEqual([
      [0, 60],
      [40, 60],
      [40, 0],
    ]);
    expect(layout.height).toBe(440 + 400 + 460);
  });

  it('cuts both ends as well when trimEnds is on (FR-206)', () => {
    const layout = computeLayout(sizes(500, 500), [0], { ...cuts, trimEnds: true });
    expect(layout.shots.map((s) => [s.cutTop, s.cutBottom])).toEqual([
      [40, 60],
      [40, 60],
    ]);
    expect(layout.height).toBe(800);
  });

  it('cuts nothing from a lone shot unless trimEnds is on', () => {
    expect(computeLayout(sizes(500), [], cuts).shots[0]).toMatchObject({ cutTop: 0, cutBottom: 0 });
    expect(computeLayout(sizes(500), [], { ...cuts, trimEnds: true }).shots[0]).toMatchObject({
      cutTop: 40,
      cutBottom: 60,
    });
  });

  it('recomputes the overlap ceiling from the cut heights', () => {
    const layout = computeLayout(sizes(500, 500), [1000], cuts);
    expect(layout.maxOverlaps[0]).toBe(Math.floor(Math.min(440, 460) * 0.95));
    expect(layout.overlaps[0]).toBe(layout.maxOverlaps[0]);
  });

  it('never cuts a shot down to nothing (E-06)', () => {
    const layout = computeLayout(sizes(30, 30), [0], { headerPx: 500, footerPx: 500, trimEnds: true });
    expect(layout.shots.every((s) => s.height >= 1)).toBe(true);
    expect(layout.height).toBeGreaterThan(0);
  });

  it('ignores negative cut values', () => {
    const layout = computeLayout(sizes(200, 200), [0], { headerPx: -10, footerPx: -10, trimEnds: true });
    expect(layout.shots[0]).toMatchObject({ cutTop: 0, cutBottom: 0 });
  });
});
