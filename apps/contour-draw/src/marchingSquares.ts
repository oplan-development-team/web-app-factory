import type { ContourPolyline, Point } from './types.ts';

interface Segment {
  a: Point;
  b: Point;
}

function lerp(v1: number, v2: number, threshold: number): number {
  const denom = v2 - v1;
  if (Math.abs(denom) < 1e-9) return 0.5;
  const t = (threshold - v1) / denom;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Self-contained marching squares implementation. Walks every cell of the
 * grid, classifies it against `threshold` using the 16-case lookup, and
 * emits boundary line segments in grid-index space (fractional cell units).
 * Saddle cells (cases 5 & 10) are resolved using the average corner value.
 */
function extractSegments(field: Float32Array, nx: number, ny: number, threshold: number): Segment[] {
  const segments: Segment[] = [];

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = field[j * nx + i] ?? 0; // top-left
      const b = field[j * nx + i + 1] ?? 0; // top-right
      const c = field[(j + 1) * nx + i + 1] ?? 0; // bottom-right
      const d = field[(j + 1) * nx + i] ?? 0; // bottom-left

      const idx = (a >= threshold ? 1 : 0) | (b >= threshold ? 2 : 0) | (c >= threshold ? 4 : 0) | (d >= threshold ? 8 : 0);
      if (idx === 0 || idx === 15) continue;

      const top: Point = { x: i + lerp(a, b, threshold), y: j };
      const right: Point = { x: i + 1, y: j + lerp(b, c, threshold) };
      const bottom: Point = { x: i + lerp(d, c, threshold), y: j + 1 };
      const left: Point = { x: i, y: j + lerp(a, d, threshold) };
      const centerHigh = (a + b + c + d) / 4 >= threshold;

      switch (idx) {
        case 1:
        case 14:
          segments.push({ a: left, b: top });
          break;
        case 2:
        case 13:
          segments.push({ a: top, b: right });
          break;
        case 3:
        case 12:
          segments.push({ a: left, b: right });
          break;
        case 4:
        case 11:
          segments.push({ a: right, b: bottom });
          break;
        case 6:
        case 9:
          segments.push({ a: top, b: bottom });
          break;
        case 7:
        case 8:
          segments.push({ a: left, b: bottom });
          break;
        case 5:
          if (centerHigh) {
            segments.push({ a: top, b: right }, { a: left, b: bottom });
          } else {
            segments.push({ a: left, b: top }, { a: right, b: bottom });
          }
          break;
        case 10:
          if (centerHigh) {
            segments.push({ a: left, b: top }, { a: right, b: bottom });
          } else {
            segments.push({ a: top, b: right }, { a: left, b: bottom });
          }
          break;
      }
    }
  }

  return segments;
}

function key(p: Point): string {
  return `${Math.round(p.x * 4096)}:${Math.round(p.y * 4096)}`;
}

/** Joins loose boundary segments into continuous polylines (open or closed). */
function stitchSegments(segments: Segment[]): { points: Point[]; closed: boolean }[] {
  const endpointIndex = new Map<string, { seg: Segment; end: 0 | 1 }[]>();
  const used = new Set<Segment>();

  const addEndpoint = (seg: Segment, pt: Point, end: 0 | 1): void => {
    const k = key(pt);
    const list = endpointIndex.get(k);
    if (list) list.push({ seg, end });
    else endpointIndex.set(k, [{ seg, end }]);
  };

  for (const seg of segments) {
    if (seg.a.x === seg.b.x && seg.a.y === seg.b.y) continue;
    addEndpoint(seg, seg.a, 0);
    addEndpoint(seg, seg.b, 1);
  }

  const polylines: { points: Point[]; closed: boolean }[] = [];

  for (const start of segments) {
    if (used.has(start)) continue;
    used.add(start);
    const points: Point[] = [start.a, start.b];
    let closed = false;

    // extend forward from the tail
    let guard = 0;
    for (;;) {
      if (++guard > segments.length + 2) break;
      const tail = points[points.length - 1]!;
      const candidates = endpointIndex.get(key(tail)) ?? [];
      const next = candidates.find((c) => !used.has(c.seg));
      if (!next) break;
      used.add(next.seg);
      const nextPoint = next.end === 0 ? next.seg.b : next.seg.a;
      if (key(nextPoint) === key(points[0]!)) {
        closed = true;
        break;
      }
      points.push(nextPoint);
    }

    // extend backward from the head (only if not already closed)
    if (!closed) {
      guard = 0;
      for (;;) {
        if (++guard > segments.length + 2) break;
        const head = points[0]!;
        const candidates = endpointIndex.get(key(head)) ?? [];
        const next = candidates.find((c) => !used.has(c.seg));
        if (!next) break;
        used.add(next.seg);
        const prevPoint = next.end === 0 ? next.seg.b : next.seg.a;
        points.unshift(prevPoint);
      }
    }

    polylines.push({ points, closed });
  }

  return polylines;
}

/**
 * Computes contour polylines for a single threshold level. Coordinates are
 * normalized to [0, 1] x [0, 1] regardless of grid resolution.
 */
export function traceContour(field: Float32Array, nx: number, ny: number, threshold: number, level: number, isIndex: boolean): ContourPolyline[] {
  const segments = extractSegments(field, nx, ny, threshold);
  if (segments.length === 0) return [];
  const stitched = stitchSegments(segments);
  const sx = 1 / (nx - 1);
  const sy = 1 / (ny - 1);

  return stitched
    .filter((p) => p.points.length >= 2)
    .map((p) => ({
      level,
      isIndex,
      closed: p.closed,
      points: p.points.map((pt) => ({ x: pt.x * sx, y: pt.y * sy })),
    }));
}

/**
 * Computes contour polylines for all threshold levels between 0 and 1,
 * marking every 5th level as an "index" (计曲线) contour.
 */
export function traceAllContours(field: Float32Array, nx: number, ny: number, numLevels: number): ContourPolyline[] {
  const result: ContourPolyline[] = [];
  for (let level = 1; level < numLevels; level++) {
    const threshold = level / numLevels;
    const isIndex = level % 5 === 0;
    result.push(...traceContour(field, nx, ny, threshold, level, isIndex));
  }
  return result;
}
