import type { Cut, Point } from './types';
import { WEDGE_RADIUS } from './types';
import { buildWedgeBoundary } from './wedgeBoundary';
import { interiorHolePolygon, isInteriorCut } from './cutShapes';

/** Rotate a point by `deg` degrees around the origin. */
export function rotatePoint(p: Point, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** Reflect a point across the local x-axis (the wedge's own 0° / "left" edge). */
export function flipY(p: Point): Point {
  return { x: p.x, y: -p.y };
}

/**
 * The 12 rigid transforms (6 rotations × plain/mirrored) that tile a single
 * 30° wedge into the full 360° snowflake: 6 plain copies rotated by 60°k,
 * and 6 mirrored copies (reflected across the wedge's own left edge, then
 * rotated by 60°(k+1)) filling the gaps in between.
 */
export function snowflakeTransforms(): Array<(p: Point) => Point> {
  const transforms: Array<(p: Point) => Point> = [];
  for (let k = 0; k < 6; k++) {
    transforms.push((p) => rotatePoint(p, 60 * k));
    transforms.push((p) => rotatePoint(flipY(p), 60 * (k + 1)));
  }
  return transforms;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Serializes a closed polygon/polyline to an SVG path subpath ("M ... L ... Z"). */
export function polygonToPathD(points: Point[]): string {
  if (points.length < 2) return '';
  const [first, ...rest] = points;
  const cmds = [`M ${round(first.x)},${round(first.y)}`, ...rest.map((p) => `L ${round(p.x)},${round(p.y)}`)];
  return `${cmds.join(' ')} Z`;
}

export interface WedgeGeometry {
  /** Closed boundary loop of a single 30° wedge, in wedge-local coordinates. */
  boundary: Point[];
  /** Closed polygons for interior holes within the wedge, wedge-local coordinates. */
  holes: Point[][];
}

export function buildWedgeGeometry(cuts: Cut[], radius: number = WEDGE_RADIUS): WedgeGeometry {
  return {
    boundary: buildWedgeBoundary(cuts, radius),
    holes: cuts.filter(isInteriorCut).map((cut) => interiorHolePolygon(cut)),
  };
}

/**
 * Assembles the full 360° snowflake as a single SVG path `d` string
 * (fill-rule evenodd): 12 tiled wedge-boundary copies (no area overlap,
 * so evenodd behaves as a clean union) plus 12 copies of every interior
 * hole (evenodd punches them out).
 */
export function assembleSnowflakePathD(cuts: Cut[], radius: number = WEDGE_RADIUS): string {
  const geo = buildWedgeGeometry(cuts, radius);
  const transforms = snowflakeTransforms();
  const parts: string[] = [];
  for (const t of transforms) {
    parts.push(polygonToPathD(geo.boundary.map(t)));
  }
  for (const hole of geo.holes) {
    for (const t of transforms) {
      parts.push(polygonToPathD(hole.map(t)));
    }
  }
  return parts.filter(Boolean).join(' ');
}

/**
 * Like assembleSnowflakePathD, but returns the 12 wedge-copy paths as separate
 * strings (each copy's boundary + only the holes belonging to that copy).
 * Used to stage the "open" bloom animation, where each of the 12 pieces can
 * be revealed independently while still being visually identical to the
 * single merged evenodd path used for export.
 */
export function assembleSnowflakePaths(cuts: Cut[], radius: number = WEDGE_RADIUS): string[] {
  const geo = buildWedgeGeometry(cuts, radius);
  const transforms = snowflakeTransforms();
  return transforms.map((t) => {
    const parts = [polygonToPathD(geo.boundary.map(t)), ...geo.holes.map((hole) => polygonToPathD(hole.map(t)))];
    return parts.filter(Boolean).join(' ');
  });
}

/** Single wedge outline + holes as an SVG path `d` (for the wedge editor view), evenodd. */
export function wedgePathD(cuts: Cut[], radius: number = WEDGE_RADIUS): string {
  const geo = buildWedgeGeometry(cuts, radius);
  const parts = [polygonToPathD(geo.boundary), ...geo.holes.map(polygonToPathD)];
  return parts.filter(Boolean).join(' ');
}
