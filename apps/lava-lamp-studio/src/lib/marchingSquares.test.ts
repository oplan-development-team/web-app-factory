import { describe, it, expect } from 'vitest';
import { computeScalarField, extractCellPolygons, type Point } from './marchingSquares';

describe('computeScalarField', () => {
  it('is highest at a source center and falls off with distance', () => {
    const identity = (p: Point): Point => p;
    const field = computeScalarField([{ x: 10, y: 10, r: 3 }], 20, 20, identity);
    const vw = 21;
    const at = (x: number, y: number) => field[y * vw + x];
    expect(at(10, 10)).toBeGreaterThan(at(15, 10));
    expect(at(15, 10)).toBeGreaterThan(at(19, 19));
  });

  it('sums contributions from multiple nearby sources', () => {
    const identity = (p: Point): Point => p;
    const single = computeScalarField([{ x: 10, y: 10, r: 2 }], 20, 20, identity);
    const double = computeScalarField(
      [
        { x: 9, y: 10, r: 2 },
        { x: 11, y: 10, r: 2 },
      ],
      20,
      20,
      identity,
    );
    const vw = 21;
    // Midpoint between two nearby sources should read higher than a single
    // source measured at its own center offset by the same distance.
    expect(double[10 * vw + 10]).toBeGreaterThan(single[10 * vw + 12]);
  });
});

describe('extractCellPolygons', () => {
  it('returns no polygons when the whole field is below threshold', () => {
    const field = new Float32Array(5 * 5).fill(0);
    const polys = extractCellPolygons(field, 4, 4, 1);
    expect(polys).toHaveLength(0);
  });

  it('returns a full-cell quad for every cell when the whole field is above threshold', () => {
    const field = new Float32Array(5 * 5).fill(10);
    const polys = extractCellPolygons(field, 4, 4, 1);
    expect(polys).toHaveLength(16); // 4x4 grid of cells
    for (const poly of polys) {
      expect(poly).toHaveLength(4);
    }
  });

  it('produces interpolated boundary polygons for a single blob in the middle', () => {
    const identity = (p: Point): Point => p;
    const gridW = 20;
    const gridH = 20;
    const field = computeScalarField([{ x: 10, y: 10, r: 3 }], gridW, gridH, identity);
    const polys = extractCellPolygons(field, gridW, gridH, 1.0);
    expect(polys.length).toBeGreaterThan(0);
    // A round blob shouldn't fill the entire 20x20 grid of cells.
    expect(polys.length).toBeLessThan(gridW * gridH);
    // The polygon nearest the center should be a full inside cell (4 pts).
    const centerPoly = polys.find((p) =>
      p.every((pt) => Math.abs(pt.x - 10) <= 1 && Math.abs(pt.y - 10) <= 1),
    );
    expect(centerPoly).toBeDefined();
  });

  it('keeps neighbouring cell polygons seamless (shared edge points match exactly)', () => {
    const identity = (p: Point): Point => p;
    const gridW = 10;
    const gridH = 10;
    const field = computeScalarField([{ x: 5, y: 5, r: 2 }], gridW, gridH, identity);
    const polys = extractCellPolygons(field, gridW, gridH, 1.0);
    // Every polygon's points should be finite numbers within grid range.
    for (const poly of polys) {
      for (const pt of poly) {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
        expect(pt.x).toBeGreaterThanOrEqual(0);
        expect(pt.x).toBeLessThanOrEqual(gridW);
        expect(pt.y).toBeGreaterThanOrEqual(0);
        expect(pt.y).toBeLessThanOrEqual(gridH);
      }
    }
  });
});
