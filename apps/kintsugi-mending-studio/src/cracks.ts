import type { CrackSegment, Point } from './types';
import { getContainPath, isInside } from './vessels';
import type { VesselSpec } from './vessels';

export const MAX_ORIGINS = 4;
const MAX_DEPTH = 4;

function polylineLength(pts: Point[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    d += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  }
  return d;
}

/**
 * Recursively grows a crack: a trunk crack splits into a handful of primary
 * directions from the impact point, each of which may spawn 1-2 child
 * branches at its end, decaying in length and gaining directional noise as
 * depth increases (trunk -> branch -> capillary hairline), approximating the
 * look of a real fracture without any physical simulation.
 */
function growBranch(
  containPath: Path2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  depth: number,
  originId: number,
  out: CrackSegment[],
): void {
  if (depth > MAX_DEPTH || length < 7) return;

  const steps = 3 + Math.floor(Math.random() * 3);
  const stepLen = length / steps;
  let cx = x;
  let cy = y;
  let cAngle = angle;
  const pts: Point[] = [{ x: cx, y: cy }];
  let hitBoundary = false;

  for (let s = 0; s < steps; s++) {
    cAngle += (Math.random() - 0.5) * (0.3 + depth * 0.12);
    const nx = cx + Math.cos(cAngle) * stepLen;
    const ny = cy + Math.sin(cAngle) * stepLen;
    if (!isInside(containPath, nx, ny)) {
      hitBoundary = true;
      break;
    }
    cx = nx;
    cy = ny;
    pts.push({ x: cx, y: cy });
  }

  if (pts.length < 2) return;

  out.push({
    points: pts,
    depth,
    originId,
    widthBase: Math.max(0.55, 3.4 - depth * 0.62),
    length: polylineLength(pts),
  });

  if (hitBoundary) return;

  const branchChance = depth === 0 ? 0.92 : Math.max(0.12, 0.62 - depth * 0.13);
  if (Math.random() < branchChance) {
    const numChildren = Math.random() < 0.32 ? 2 : 1;
    for (let c = 0; c < numChildren; c++) {
      const childAngle = cAngle + (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.95);
      const childLength = length * (0.5 + Math.random() * 0.22);
      growBranch(containPath, cx, cy, childAngle, childLength, depth + 1, originId, out);
    }
  }
}

/** Generates one full crack tree (3-5 primary directions) from an impact point. */
export function generateCrackTree(spec: VesselSpec, originId: number, origin: Point): CrackSegment[] {
  const containPath = getContainPath(spec);
  const segments: CrackSegment[] = [];
  const numPrimary = 3 + Math.floor(Math.random() * 3);
  const baseAngle = Math.random() * Math.PI * 2;

  for (let i = 0; i < numPrimary; i++) {
    const angle = baseAngle + (i / numPrimary) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
    const length = 60 + Math.random() * 55;
    growBranch(containPath, origin.x, origin.y, angle, length, 0, originId, segments);
  }
  return segments;
}

/** Returns the leading sub-polyline of `pts` covering fraction `t` (0..1) of its length. */
export function slicePolyline(pts: Point[], t: number): Point[] {
  if (pts.length === 0) return pts;
  if (t <= 0) return [pts[0]!];
  if (t >= 1) return pts;

  const total = polylineLength(pts);
  const target = total * t;
  let acc = 0;
  const result: Point[] = [pts[0]!];

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + segLen >= target) {
      const remain = target - acc;
      const ratio = segLen === 0 ? 0 : remain / segLen;
      result.push({ x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio });
      return result;
    }
    acc += segLen;
    result.push(b);
  }
  return pts;
}

/** Finds a point inside the vessel's exact silhouette nearest to `pt`,
 * nudging toward the vessel center if the (slightly larger) hit-test
 * silhouette allowed a click just outside the true fill region. */
export function clampInsideVessel(spec: VesselSpec, pt: Point, center: Point): Point {
  const containPath = getContainPath(spec);
  if (isInside(containPath, pt.x, pt.y)) return pt;
  let x = pt.x;
  let y = pt.y;
  for (let i = 0; i < 24; i++) {
    x += (center.x - x) * 0.12;
    y += (center.y - y) * 0.12;
    if (isInside(containPath, x, y)) return { x, y };
  }
  return center;
}
