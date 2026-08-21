import { equatorialToHorizontal, projectToChart } from './coords';

/** A point on the celestial sphere, in J2000 equatorial degrees. */
export interface SkyPoint {
  ra: number;
  dec: number;
}

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ClippedSegment {
  a: ChartPoint;
  b: ChartPoint;
}

/** Observer state needed to place a sky point on the chart. */
export interface Observer {
  latitude: number;
  lstDeg: number;
  chartRadius: number;
}

/**
 * Altitude tolerance for the horizon crossing search, in degrees. At the
 * chart's scale (322 units for 90 degrees) this is well under a tenth of a
 * pixel, so tightening it further would change nothing visible.
 */
const ALTITUDE_TOLERANCE_DEG = 0.01;
const MAX_BISECTIONS = 40;

function altitudeAt(point: SkyPoint, observer: Observer): number {
  return equatorialToHorizontal(point.ra, point.dec, observer.latitude, observer.lstDeg).altDeg;
}

/** Linear interpolation between two sky points, taking the shorter way in RA. */
function interpolate(a: SkyPoint, b: SkyPoint, t: number): SkyPoint {
  let deltaRa = b.ra - a.ra;
  // Constellation figures never span more than half the sky, so a difference
  // over 180 degrees always means the segment wraps through RA 0 rather than
  // taking the long way round the sphere.
  if (deltaRa > 180) deltaRa -= 360;
  if (deltaRa < -180) deltaRa += 360;

  return {
    ra: ((a.ra + deltaRa * t) % 360 + 360) % 360,
    dec: a.dec + (b.dec - a.dec) * t,
  };
}

/**
 * Finds the point where the great-circle-ish path from `inside` (above the
 * horizon) to `outside` (below it) crosses altitude zero, by bisection.
 *
 * Altitude varies monotonically along a short segment that crosses the horizon
 * exactly once, which is the only case this is called for.
 */
function findHorizonCrossing(inside: SkyPoint, outside: SkyPoint, observer: Observer): SkyPoint {
  let lo = 0;
  let hi = 1;
  let mid = inside;

  for (let i = 0; i < MAX_BISECTIONS; i++) {
    const t = (lo + hi) / 2;
    mid = interpolate(inside, outside, t);
    const alt = altitudeAt(mid, observer);

    if (Math.abs(alt) <= ALTITUDE_TOLERANCE_DEG) return mid;
    if (alt > 0) lo = t;
    else hi = t;
  }

  return mid;
}

/**
 * Projects one constellation-figure segment onto the chart, trimmed at the
 * horizon.
 *
 * The prototype only drew a segment when *both* endpoints were above the
 * horizon, so a constellation halfway risen -- the common case for anything
 * near the edge of the chart -- lost its outer limbs entirely. Clipping keeps
 * the visible part and cuts it exactly at the horizon circle (FR-105).
 *
 * Returns null when the whole segment is below the horizon.
 */
export function clipSegmentToHorizon(
  a: SkyPoint,
  b: SkyPoint,
  observer: Observer,
): ClippedSegment | null {
  const altA = altitudeAt(a, observer);
  const altB = altitudeAt(b, observer);

  if (altA < 0 && altB < 0) return null;

  const visibleA = altA >= 0 ? a : findHorizonCrossing(b, a, observer);
  const visibleB = altB >= 0 ? b : findHorizonCrossing(a, b, observer);

  const pointA = projectPoint(visibleA, observer);
  const pointB = projectPoint(visibleB, observer);
  if (pointA === null || pointB === null) return null;

  return { a: pointA, b: pointB };
}

/**
 * Projects a sky point onto the chart. Points that land a hair below the
 * horizon after bisection are pinned to the horizon circle rather than
 * discarded, so a clipped line always reaches the edge cleanly.
 */
function projectPoint(point: SkyPoint, observer: Observer): ChartPoint | null {
  const horiz = equatorialToHorizontal(
    point.ra,
    point.dec,
    observer.latitude,
    observer.lstDeg,
  );
  const clamped = {
    altDeg: horiz.altDeg < 0 ? 0 : horiz.altDeg,
    azDeg: horiz.azDeg,
  };
  return projectToChart(clamped, observer.chartRadius);
}

/** Projects a whole polyline, yielding the visible, horizon-trimmed segments. */
export function clipPolylineToHorizon(
  points: readonly SkyPoint[],
  observer: Observer,
): ClippedSegment[] {
  const segments: ClippedSegment[] = [];

  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a === undefined || b === undefined) continue;

    const clipped = clipSegmentToHorizon(a, b, observer);
    if (clipped !== null) segments.push(clipped);
  }

  return segments;
}
