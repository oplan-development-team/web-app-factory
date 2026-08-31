// Minimal marching-squares implementation: extracts zero-contour line
// segments from a scalar field sampled on a regular grid. Used to turn the
// Chladni node lines into vector line segments for SVG export.

import { fieldValue, inDomain, type PlateShape } from './chladni';

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface GridPoint {
  x: number;
  y: number;
  z: number;
  active: boolean;
}

function lerpEdge(a: GridPoint, b: GridPoint): [number, number] {
  const t = a.z === b.z ? 0.5 : a.z / (a.z - b.z);
  return [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t];
}

/**
 * Extract zero-level contour segments of the plate displacement field.
 * Coordinates are returned in the same normalized [-1, 1] plate space used
 * by the simulation.
 */
export function extractNodeLines(
  n: number,
  m: number,
  shape: PlateShape,
  resolution = 140
): Segment[] {
  const segments: Segment[] = [];
  const step = 2 / resolution;
  const grid: GridPoint[][] = [];

  for (let j = 0; j <= resolution; j++) {
    const row: GridPoint[] = [];
    const y = -1 + j * step;
    for (let i = 0; i <= resolution; i++) {
      const x = -1 + i * step;
      const active = inDomain(shape, x, y);
      row.push({ x, y, z: active ? fieldValue(n, m, x, y) : 0, active });
    }
    grid.push(row);
  }

  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const tl = grid[j][i];
      const tr = grid[j][i + 1];
      const br = grid[j + 1][i + 1];
      const bl = grid[j + 1][i];
      if (!(tl.active && tr.active && br.active && bl.active)) continue;

      let caseIndex = 0;
      if (tl.z > 0) caseIndex |= 8;
      if (tr.z > 0) caseIndex |= 4;
      if (br.z > 0) caseIndex |= 2;
      if (bl.z > 0) caseIndex |= 1;
      if (caseIndex === 0 || caseIndex === 15) continue;

      const top = () => lerpEdge(tl, tr);
      const right = () => lerpEdge(tr, br);
      const bottom = () => lerpEdge(bl, br);
      const left = () => lerpEdge(tl, bl);

      const push = (a: [number, number], b: [number, number]) => {
        segments.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
      };

      switch (caseIndex) {
        case 1:
        case 14:
          push(left(), bottom());
          break;
        case 2:
        case 13:
          push(bottom(), right());
          break;
        case 3:
        case 12:
          push(left(), right());
          break;
        case 4:
        case 11:
          push(top(), right());
          break;
        case 5:
          push(left(), top());
          push(bottom(), right());
          break;
        case 6:
        case 9:
          push(top(), bottom());
          break;
        case 7:
        case 8:
          push(left(), top());
          break;
        case 10:
          push(top(), right());
          push(left(), bottom());
          break;
        default:
          break;
      }
    }
  }

  return segments;
}
