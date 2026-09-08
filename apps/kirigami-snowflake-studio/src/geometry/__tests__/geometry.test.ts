import { describe, expect, it } from 'vitest';
import { WEDGE_RADIUS } from '../types';
import type { Cut, TriangleCut } from '../types';
import { buildWedgeBoundary } from '../wedgeBoundary';
import { assembleSnowflakePathD, flipY, rotatePoint, wedgePathD } from '../assemble';
import { validatePlacement } from '../validation';
import { edgeCutZone } from '../cutShapes';

describe('rotatePoint / flipY', () => {
  it('rotates (1,0) by 90deg to (0,1)', () => {
    const p = rotatePoint({ x: 1, y: 0 }, 90);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(1, 6);
  });

  it('flipY negates y only', () => {
    expect(flipY({ x: 3, y: 5 })).toEqual({ x: 3, y: -5 });
  });
});

describe('buildWedgeBoundary (no cuts)', () => {
  it('starts and ends at the wedge apex (0,0)', () => {
    const boundary = buildWedgeBoundary([], WEDGE_RADIUS);
    expect(boundary[0].x).toBeCloseTo(0, 3);
    expect(boundary[0].y).toBeCloseTo(0, 3);
    const last = boundary[boundary.length - 1];
    // last point should be very close to apex too (loop closes via Z)
    expect(Math.hypot(last.x, last.y)).toBeLessThan(5);
  });

  it('never exceeds the wedge radius', () => {
    const boundary = buildWedgeBoundary([], WEDGE_RADIUS);
    for (const p of boundary) {
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(WEDGE_RADIUS + 0.5);
    }
  });

  it('includes sampled arc points between the two corners', () => {
    const boundary = buildWedgeBoundary([], WEDGE_RADIUS);
    // more than just the 3 corner points because the arc is sampled finely
    expect(boundary.length).toBeGreaterThan(10);
  });
});

describe('edge triangle notch indents the boundary', () => {
  const notch: TriangleCut = {
    id: 'n1',
    kind: 'triangle',
    placement: 'edge',
    edge: 'left',
    u: 130,
    width: 20,
    depth: 15,
  };

  it('produces a boundary point pushed inward (positive y) near u=130', () => {
    const boundary = buildWedgeBoundary([notch], WEDGE_RADIUS);
    const near = boundary.find((p) => Math.abs(p.x - 130) < 1 && p.y > 10);
    expect(near).toBeDefined();
    expect(near!.y).toBeCloseTo(15, 1);
  });
});

describe('wedgePathD / assembleSnowflakePathD', () => {
  it('produces a non-empty single wedge path with no NaN', () => {
    const d = wedgePathD([]);
    expect(d).toMatch(/^M/);
    expect(d).not.toMatch(/NaN/);
  });

  it('assembles 12 tiled wedge subpaths for the full snowflake', () => {
    const d = assembleSnowflakePathD([]);
    const moveCount = (d.match(/M /g) || []).length;
    expect(moveCount).toBe(12);
    expect(d).not.toMatch(/NaN/);
  });

  it('adds extra subpaths (12 per hole) when an interior hole cut is present', () => {
    const cuts: Cut[] = [
      { id: 'h1', kind: 'semicircle', placement: 'interior', x: 150, y: 60, radius: 10 },
    ];
    const withHole = assembleSnowflakePathD(cuts);
    const moveCount = (withHole.match(/M /g) || []).length;
    expect(moveCount).toBe(24);
  });
});

describe('validatePlacement', () => {
  it('rejects an edge cut that overlaps an existing one on the same edge', () => {
    const existing: Cut[] = [
      { id: 'a', kind: 'triangle', placement: 'edge', edge: 'left', u: 100, width: 20, depth: 10 },
    ];
    const candidate: Cut = { id: 'b', kind: 'triangle', placement: 'edge', edge: 'left', u: 105, width: 20, depth: 10 };
    expect(validatePlacement(candidate, existing).ok).toBe(false);
  });

  it('accepts a far-away edge cut on the same edge', () => {
    const existing: Cut[] = [
      { id: 'a', kind: 'triangle', placement: 'edge', edge: 'left', u: 40, width: 10, depth: 8 },
    ];
    const candidate: Cut = { id: 'b', kind: 'triangle', placement: 'edge', edge: 'left', u: 200, width: 10, depth: 8 };
    expect(validatePlacement(candidate, existing).ok).toBe(true);
  });

  it('rejects an interior hole placed too close to an edge', () => {
    const candidate: Cut = { id: 'c', kind: 'semicircle', placement: 'interior', x: 5, y: 2, radius: 6 };
    expect(validatePlacement(candidate, []).ok).toBe(false);
  });

  it('accepts an interior hole placed safely inside the wedge', () => {
    const candidate: Cut = { id: 'c', kind: 'semicircle', placement: 'interior', x: 140, y: 40, radius: 8 };
    expect(validatePlacement(candidate, []).ok).toBe(true);
  });

  it('rejects two interior holes placed on top of each other', () => {
    const existing: Cut[] = [{ id: 'a', kind: 'semicircle', placement: 'interior', x: 140, y: 40, radius: 8 }];
    const candidate: Cut = { id: 'b', kind: 'semicircle', placement: 'interior', x: 142, y: 42, radius: 8 };
    expect(validatePlacement(candidate, existing).ok).toBe(false);
  });
});

describe('edgeCutZone', () => {
  it('returns null for interior cuts', () => {
    const cut: Cut = { id: 'x', kind: 'triangle', placement: 'interior', x: 0, y: 0, width: 10, depth: 5 };
    expect(edgeCutZone(cut)).toBeNull();
  });

  it('computes symmetric zone around u for a wave cut range', () => {
    const cut: Cut = { id: 'w', kind: 'wave', placement: 'edge', edge: 'arc', uStart: 50, uEnd: 90, amplitude: 5, count: 4 };
    const zone = edgeCutZone(cut);
    expect(zone).toEqual({ edge: 'arc', uStart: 50, uEnd: 90 });
  });
});
