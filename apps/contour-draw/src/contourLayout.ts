import type { Point } from './types.ts';

export const MAX_ELEVATION_M = 1000;

/** Mechanically derives a fictional elevation (in meters) from a threshold level. */
export function elevationOf(level: number, numLevels: number): number {
  const raw = (level / numLevels) * MAX_ELEVATION_M;
  return Math.round(raw / 10) * 10;
}

export interface LabelPlacement {
  x: number;
  y: number;
  angle: number;
  text: string;
}

export interface ContourLayout {
  /** Point sequences to actually stroke, with gaps cut out where labels sit. */
  segments: Point[][];
  labels: LabelPlacement[];
}

function cumulativeLength(points: Point[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    cum.push(cum[i - 1]! + Math.hypot(cur.x - prev.x, cur.y - prev.y));
  }
  return cum;
}

function pointAt(points: Point[], cum: number[], target: number): { point: Point; angle: number } {
  const total = cum[cum.length - 1]!;
  const t = Math.max(0, Math.min(total, target));
  let i = 1;
  while (i < cum.length && cum[i]! < t) i++;
  i = Math.min(i, points.length - 1);
  const p0 = points[i - 1]!;
  const p1 = points[i]!;
  const segLen = cum[i]! - cum[i - 1]!;
  const localT = segLen > 1e-6 ? (t - cum[i - 1]!) / segLen : 0;
  return {
    point: { x: p0.x + (p1.x - p0.x) * localT, y: p0.y + (p1.y - p0.y) * localT },
    angle: Math.atan2(p1.y - p0.y, p1.x - p0.x),
  };
}

/**
 * Lays out an index-line polyline in *pixel space*: decides where to break
 * the stroke for elevation labels (spaced along the line's arc length) and
 * returns both the drawable stroke segments and the label placements.
 */
export function layoutIndexPolyline(points: Point[], labelText: string, spacingPx: number, gapHalfWidthPx: number): ContourLayout {
  if (points.length < 2) return { segments: [points], labels: [] };
  const cum = cumulativeLength(points);
  const total = cum[cum.length - 1]!;

  if (total < spacingPx * 0.6) {
    // Too short for a legible label — draw uninterrupted.
    return { segments: [points], labels: [] };
  }

  const anchors: number[] = [];
  let pos = spacingPx * 0.5;
  while (pos < total - spacingPx * 0.15) {
    anchors.push(pos);
    pos += spacingPx;
  }
  if (anchors.length === 0) anchors.push(total / 2);

  const ranges = anchors.map((a) => [Math.max(0, a - gapHalfWidthPx), Math.min(total, a + gapHalfWidthPx)] as const);
  const labels: LabelPlacement[] = anchors.map((a) => {
    const { point, angle } = pointAt(points, cum, a);
    // Keep label text upright (avoid upside-down reading).
    const upright = angle > Math.PI / 2 || angle < -Math.PI / 2 ? angle + Math.PI : angle;
    return { x: point.x, y: point.y, angle: upright, text: labelText };
  });

  // Build stroke segments by walking the point list and cutting out gaps.
  const segments: Point[][] = [];
  let current: Point[] = [];
  let rangeIdx = 0;

  const pushPoint = (p: Point) => current.push(p);
  const flush = () => {
    if (current.length >= 2) segments.push(current);
    current = [];
  };

  for (let i = 0; i < points.length; i++) {
    const d = cum[i]!;
    while (rangeIdx < ranges.length && d > ranges[rangeIdx]![1]) rangeIdx++;
    const range = ranges[rangeIdx];
    if (range && d >= range[0] && d <= range[1]) {
      // inside a gap: cut here
      flush();
      continue;
    }
    pushPoint(points[i]!);
  }
  flush();

  return { segments: segments.length > 0 ? segments : [points], labels };
}
