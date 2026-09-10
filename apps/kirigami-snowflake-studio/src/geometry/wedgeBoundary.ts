import type { Cut, EdgeId, Point } from './types';
import { WEDGE_RADIUS } from './types';
import { edgeLength, sampleEdge } from './edge';
import { edgeCutProfile, edgeCutZone, isEdgeCut } from './cutShapes';

const EPS = 0.01;

function dedupe(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - p.x) > EPS || Math.abs(prev.y - p.y) > EPS) {
      out.push(p);
    }
  }
  return out;
}

/** Builds the true-curve + cut-indented polyline for one edge, from u=0 to u=edgeLength, forward order. */
export function buildEdgePolyline(edge: EdgeId, cuts: Cut[], radius: number = WEDGE_RADIUS): Point[] {
  const length = edgeLength(edge, radius);
  const zones = cuts
    .filter(isEdgeCut)
    .map((cut) => ({ cut, zone: edgeCutZone(cut) }))
    .filter((z): z is { cut: Cut; zone: { edge: EdgeId; uStart: number; uEnd: number } } => !!z.zone && z.zone.edge === edge)
    .sort((a, b) => a.zone.uStart - b.zone.uStart);

  const points: Point[] = [];
  let current = 0;
  for (const { cut, zone } of zones) {
    const segEnd = Math.max(current, Math.min(zone.uStart, length));
    if (segEnd > current) {
      points.push(...sampleEdge(edge, current, segEnd, radius));
    }
    points.push(...edgeCutProfile(cut, radius));
    current = Math.max(current, zone.uEnd);
  }
  if (current < length) {
    points.push(...sampleEdge(edge, current, length, radius));
  } else if (points.length === 0) {
    points.push(...sampleEdge(edge, 0, length, radius));
  }
  return dedupe(points);
}

/** Full closed wedge boundary loop (center → left edge → arc → right edge → center), wedge-local coords. */
export function buildWedgeBoundary(cuts: Cut[], radius: number = WEDGE_RADIUS): Point[] {
  const leftPts = buildEdgePolyline('left', cuts, radius);
  const arcPts = buildEdgePolyline('arc', cuts, radius);
  const rightPts = buildEdgePolyline('right', cuts, radius).slice().reverse();

  const boundary = [...leftPts, ...arcPts.slice(1), ...rightPts.slice(1)];
  return dedupe(boundary);
}
