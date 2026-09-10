import type { EdgeId, Point } from './types';
import { WEDGE_RADIUS } from './types';

const WEDGE_ANGLE_DEG = 30;
const WEDGE_ANGLE_RAD = (WEDGE_ANGLE_DEG * Math.PI) / 180;

export interface EdgeFrame {
  point: Point;
  /** unit vector along increasing u */
  tangent: Point;
  /** unit vector pointing into the wedge interior (where cuts remove paper) */
  normal: Point;
}

/** Total length (in local units) of an edge, for a given wedge radius. */
export function edgeLength(edge: EdgeId, radius: number = WEDGE_RADIUS): number {
  if (edge === 'arc') return radius * WEDGE_ANGLE_RAD;
  return radius;
}

function rotate(p: Point, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** Returns position + local tangent/inward-normal frame at distance u along the given edge. */
export function frameAt(edge: EdgeId, u: number, radius: number = WEDGE_RADIUS): EdgeFrame {
  if (edge === 'left') {
    return {
      point: { x: u, y: 0 },
      tangent: { x: 1, y: 0 },
      normal: { x: 0, y: 1 }, // rotate tangent +90°
    };
  }
  if (edge === 'right') {
    const tangent = rotate({ x: 1, y: 0 }, WEDGE_ANGLE_DEG);
    return {
      point: { x: u * tangent.x, y: u * tangent.y },
      tangent,
      normal: rotate(tangent, -90), // interior is the smaller-angle side
    };
  }
  // arc
  const theta = u / radius; // radians, 0..WEDGE_ANGLE_RAD
  const point = { x: radius * Math.cos(theta), y: radius * Math.sin(theta) };
  const tangent = { x: -Math.sin(theta), y: Math.cos(theta) };
  const normal = { x: -tangent.y, y: tangent.x }; // rotate +90° => points toward center
  return { point, tangent, normal };
}

/** True midpoint-frame point at distance u (exact for straight edges, true arc position for 'arc'). */
export function pointAt(edge: EdgeId, u: number, radius: number = WEDGE_RADIUS): Point {
  return frameAt(edge, u, radius).point;
}

/** Maps a local (du, dv) offset — measured from the frame at uCenter — to a global wedge-local point. */
export function localToGlobal(edge: EdgeId, uCenter: number, du: number, dv: number, radius: number = WEDGE_RADIUS): Point {
  const { point, tangent, normal } = frameAt(edge, uCenter, radius);
  return {
    x: point.x + tangent.x * du + normal.x * dv,
    y: point.y + tangent.y * du + normal.y * dv,
  };
}

/** Samples the true (uncut) edge curve between u0 and u1, inclusive of both ends. */
export function sampleEdge(edge: EdgeId, u0: number, u1: number, radius: number = WEDGE_RADIUS): Point[] {
  if (edge !== 'arc') {
    return [pointAt(edge, u0, radius), pointAt(edge, u1, radius)];
  }
  const span = u1 - u0;
  if (span <= 0) return [pointAt(edge, u0, radius)];
  const steps = Math.max(2, Math.ceil((span / (radius * WEDGE_ANGLE_RAD)) * 48));
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    pts.push(pointAt(edge, u0 + (span * i) / steps, radius));
  }
  return pts;
}

export const WEDGE_ANGLE = { deg: WEDGE_ANGLE_DEG, rad: WEDGE_ANGLE_RAD };

export function edgeStartPoint(edge: EdgeId, radius: number = WEDGE_RADIUS): Point {
  return pointAt(edge, 0, radius);
}

export function edgeEndPoint(edge: EdgeId, radius: number = WEDGE_RADIUS): Point {
  return pointAt(edge, edgeLength(edge, radius), radius);
}
