import { equatorialToHorizontal, projectToChart } from './coords';
import { clipPolylineToHorizon, type ClippedSegment, type Observer } from './horizon';
import { greenwichSiderealDeg, julianDate, localSiderealDeg, toUtcMillis } from './time';
import type { ConstellationRecord, PosterInputs, StarRecord } from '../types';

export interface ProjectedStar {
  star: StarRecord;
  x: number;
  y: number;
  altDeg: number;
}

export type ProjectedSegment = ClippedSegment;

export interface ComputedSky {
  utcMillis: number;
  jd: number;
  gstDeg: number;
  lstDeg: number;
  stars: ProjectedStar[];
  segments: ProjectedSegment[];
}

/**
 * Projects the whole catalogue for one observation. Stars below the horizon
 * are dropped here rather than at render time, so the SVG only ever carries
 * nodes that are actually visible.
 */
export function computeSky(
  inputs: PosterInputs,
  chartRadius: number,
  allStars: readonly StarRecord[],
  allConstellations: readonly ConstellationRecord[],
): ComputedSky {
  const utcMillis = toUtcMillis(inputs);
  const jd = julianDate(utcMillis);
  const gstDeg = greenwichSiderealDeg(jd);
  const lstDeg = localSiderealDeg(gstDeg, inputs.longitude);

  const observer: Observer = { latitude: inputs.latitude, lstDeg, chartRadius };

  const stars: ProjectedStar[] = [];
  for (const star of allStars) {
    const horiz = equatorialToHorizontal(star.ra, star.dec, inputs.latitude, lstDeg);
    const pt = projectToChart(horiz, chartRadius);
    if (pt === null) continue;
    stars.push({ star, x: pt.x, y: pt.y, altDeg: horiz.altDeg });
  }

  const segments: ProjectedSegment[] = [];
  if (inputs.showConstellations) {
    for (const constellation of allConstellations) {
      for (const line of constellation.lines) {
        const points = line.map(([ra, dec]) => ({ ra, dec }));
        segments.push(...clipPolylineToHorizon(points, observer));
      }
    }
  }

  return { utcMillis, jd, gstDeg, lstDeg, stars, segments };
}

/**
 * Visual radius (chart units) of a star's dot given its magnitude. Brighter
 * (lower magnitude) stars are drawn larger, mirroring how a printed star atlas
 * encodes brightness as dot size.
 */
export function starDotRadius(mag: number): number {
  const clamped = Math.min(Math.max(mag, -1.5), 4.5);
  return Math.max(0.55, 4.1 - clamped * 0.72);
}
