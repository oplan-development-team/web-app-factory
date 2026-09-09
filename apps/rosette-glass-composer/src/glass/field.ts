import type { PlacedPoint } from '../types.ts';
import { isInside, sectorIndexForPoint, type TemplateGeometry } from '../templates.ts';
import { fbm2D } from './noise.ts';

export interface GridMask {
  gridW: number;
  gridH: number;
  inside: Uint8Array;
  sector: Int8Array;
}

export interface FieldResult {
  gridW: number;
  gridH: number;
  cellId: Int16Array; // -1 = no glass at this cell
}

/** Choose a grid resolution proportional to canvas size but capped for perf. */
export function gridSizeFor(canvasW: number, canvasH: number, cellPx = 3): { gridW: number; gridH: number } {
  return {
    gridW: Math.max(8, Math.round(canvasW / cellPx)),
    gridH: Math.max(8, Math.round(canvasH / cellPx)),
  };
}

/** Precomputed once per template change: which grid cells fall inside the window, and their rose sector. */
export function buildGridMask(
  geom: TemplateGeometry,
  canvasW: number,
  canvasH: number,
  gridW: number,
  gridH: number,
): GridMask {
  const inside = new Uint8Array(gridW * gridH);
  const sector = new Int8Array(gridW * gridH);
  const scaleX = canvasW / gridW;
  const scaleY = canvasH / gridH;

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const idx = gy * gridW + gx;
      const px = (gx + 0.5) * scaleX;
      const py = (gy + 0.5) * scaleY;
      if (isInside(geom, px, py)) {
        inside[idx] = 1;
        sector[idx] = geom.kind === 'rose' ? sectorIndexForPoint(px, py, geom) : 0;
      }
    }
  }
  return { gridW, gridH, inside, sector };
}

/** Recomputed on every point/irregularity change: nearest-point ownership per grid cell. */
export function computeField(
  points: PlacedPoint[],
  geom: TemplateGeometry,
  mask: GridMask,
  canvasW: number,
  canvasH: number,
  irregularity: number,
  seed = 1,
): FieldResult {
  const { gridW, gridH, inside, sector } = mask;
  const cellId = new Int16Array(gridW * gridH).fill(-1);
  if (points.length === 0) return { gridW, gridH, cellId };

  const bySector = new Map<number, number[]>();
  points.forEach((p, i) => {
    const s = geom.kind === 'rose' ? sectorIndexForPoint(p.x, p.y, geom) : 0;
    const arr = bySector.get(s);
    if (arr) arr.push(i);
    else bySector.set(s, [i]);
  });

  const scaleX = canvasW / gridW;
  const scaleY = canvasH / gridH;
  const warpFreq = 0.012;
  const warpAmp = irregularity * 46;

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const idx = gy * gridW + gx;
      if (!inside[idx]) continue;
      const candidates = bySector.get(sector[idx]!);
      if (!candidates || candidates.length === 0) continue;

      const px = (gx + 0.5) * scaleX;
      const py = (gy + 0.5) * scaleY;
      const wx = px + (fbm2D(px * warpFreq, py * warpFreq, seed) - 0.5) * 2 * warpAmp;
      const wy = py + (fbm2D(px * warpFreq + 91.3, py * warpFreq + 17.7, seed + 7) - 0.5) * 2 * warpAmp;

      let best = -1;
      let bestD = Infinity;
      for (const ci of candidates) {
        const p = points[ci]!;
        const dx = wx - p.x;
        const dy = wy - p.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = ci;
        }
      }
      cellId[idx] = best;
    }
  }

  return { gridW, gridH, cellId };
}

/**
 * Builds a Path2D made of short segments along every grid-cell boundary
 * where cell ownership changes (a crude, orthogonal marching-squares).
 * Stroked with round joins/caps this reads as an irregular, hand-cut lead
 * line -- the domain-warp already applied in computeField gives it its
 * organic waviness.
 */
export function buildCellBoundaryPath(field: FieldResult, canvasW: number, canvasH: number): Path2D {
  const { gridW, gridH, cellId } = field;
  const scaleX = canvasW / gridW;
  const scaleY = canvasH / gridH;
  const path = new Path2D();

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const idx = gy * gridW + gx;
      const here = cellId[idx]!;

      // Right neighbour
      if (gx + 1 < gridW) {
        const right = cellId[idx + 1]!;
        if (here !== right && (here >= 0 || right >= 0)) {
          const x = (gx + 1) * scaleX;
          path.moveTo(x, gy * scaleY);
          path.lineTo(x, (gy + 1) * scaleY);
        }
      }
      // Bottom neighbour
      if (gy + 1 < gridH) {
        const bottom = cellId[idx + gridW]!;
        if (here !== bottom && (here >= 0 || bottom >= 0)) {
          const y = (gy + 1) * scaleY;
          path.moveTo(gx * scaleX, y);
          path.lineTo((gx + 1) * scaleX, y);
        }
      }
    }
  }
  return path;
}
