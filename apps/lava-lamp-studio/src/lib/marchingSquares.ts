/**
 * Metaball scalar field + marching squares contour extraction.
 *
 * Pure logic, no Canvas — callers turn the returned polygons into a
 * Path2D/fill themselves. Two steps:
 *
 * 1. `computeScalarField` samples the classic inverse-square metaball
 *    potential (sum of r_i^2 / distance^2) at every grid VERTEX. Vertices
 *    are shared between neighbouring cells so contours line up exactly
 *    with no visible seams between cells.
 * 2. `extractCellPolygons` walks every grid cell and, using the standard
 *    marching-squares corner/edge classification, returns the polygon of
 *    the region that is "inside" the iso-surface (>= threshold) for that
 *    cell. Filling every cell's polygon with the same solid colour
 *    reconstructs one smooth blob — this is marching squares implemented
 *    at cell granularity rather than stitched into a single global
 *    contour, which sidesteps the topology-tracking edge cases of
 *    multi-blob merge/split (droplets merging/separating) while still
 *    being the same core algorithm (corner classification + linear edge
 *    interpolation).
 */

export interface Point {
  x: number;
  y: number;
}

export interface MetaballSource {
  x: number;
  y: number;
  r: number;
}

/**
 * Computes the metaball scalar field at every vertex of a (gridW+1) x
 * (gridH+1) lattice covering [0,gridW] x [0,gridH] in grid-cell units.
 * `toGridSpace` converts a source's world coordinates into that same
 * grid-cell unit space.
 */
export function computeScalarField(
  sources: MetaballSource[],
  gridW: number,
  gridH: number,
  toGridSpace: (p: Point) => Point,
): Float32Array {
  const vw = gridW + 1;
  const vh = gridH + 1;
  const field = new Float32Array(vw * vh);
  const gSources = sources.map((s) => {
    const p = toGridSpace({ x: s.x, y: s.y });
    const gr = toGridSpace({ x: s.x + s.r, y: s.y });
    const rGrid = gr.x - p.x;
    return { x: p.x, y: p.y, r2: Math.max(rGrid * rGrid, 1e-6) };
  });

  for (let gy = 0; gy < vh; gy++) {
    for (let gx = 0; gx < vw; gx++) {
      let sum = 0;
      for (const s of gSources) {
        const dx = gx - s.x;
        const dy = gy - s.y;
        const d2 = dx * dx + dy * dy;
        sum += s.r2 / Math.max(d2, 0.35);
      }
      field[gy * vw + gx] = sum;
    }
  }
  return field;
}

function lerpEdge(threshold: number, va: number, vb: number, pa: Point, pb: Point): Point {
  const denom = vb - va;
  const t = Math.abs(denom) < 1e-6 ? 0.5 : (threshold - va) / denom;
  const ct = Math.min(Math.max(t, 0), 1);
  return { x: pa.x + (pb.x - pa.x) * ct, y: pa.y + (pb.y - pa.y) * ct };
}

/**
 * Returns one polygon per grid cell describing the "inside" (>= threshold)
 * region of that cell. Empty cells are omitted. Coordinates are in grid
 * cell units (0..gridW, 0..gridH); scale by cell pixel size to render.
 */
export function extractCellPolygons(
  field: Float32Array,
  gridW: number,
  gridH: number,
  threshold: number,
): Point[][] {
  const vw = gridW + 1;
  const polygons: Point[][] = [];

  for (let cy = 0; cy < gridH; cy++) {
    for (let cx = 0; cx < gridW; cx++) {
      const tl = field[cy * vw + cx];
      const tr = field[cy * vw + cx + 1];
      const br = field[(cy + 1) * vw + cx + 1];
      const bl = field[(cy + 1) * vw + cx];

      const insideTL = tl >= threshold;
      const insideTR = tr >= threshold;
      const insideBR = br >= threshold;
      const insideBL = bl >= threshold;

      if (!insideTL && !insideTR && !insideBR && !insideBL) continue;

      const pTL: Point = { x: cx, y: cy };
      const pTR: Point = { x: cx + 1, y: cy };
      const pBR: Point = { x: cx + 1, y: cy + 1 };
      const pBL: Point = { x: cx, y: cy + 1 };

      const poly: Point[] = [];
      if (insideTL) poly.push(pTL);
      if (insideTL !== insideTR) poly.push(lerpEdge(threshold, tl, tr, pTL, pTR));
      if (insideTR) poly.push(pTR);
      if (insideTR !== insideBR) poly.push(lerpEdge(threshold, tr, br, pTR, pBR));
      if (insideBR) poly.push(pBR);
      if (insideBR !== insideBL) poly.push(lerpEdge(threshold, br, bl, pBR, pBL));
      if (insideBL) poly.push(pBL);
      if (insideBL !== insideTL) poly.push(lerpEdge(threshold, bl, tl, pBL, pTL));

      if (poly.length >= 3) polygons.push(poly);
    }
  }

  return polygons;
}
