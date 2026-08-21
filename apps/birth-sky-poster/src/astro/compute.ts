import { equatorialToHorizontal, projectToChart } from './coords';
import { greenwichSiderealDeg, julianDate, localSiderealDeg, toUtcMillis } from './time';
import type { ConstellationRecord, PosterInputs, StarRecord } from '../types';

export interface ProjectedStar {
  star: StarRecord;
  x: number;
  y: number;
  altDeg: number;
}

export interface ProjectedSegment {
  a: { x: number; y: number };
  b: { x: number; y: number };
}

export interface ComputedSky {
  utcMillis: number;
  jd: number;
  gstDeg: number;
  lstDeg: number;
  stars: ProjectedStar[];
  segments: ProjectedSegment[];
}

/** Point radius (chart units) for stars, projected onto a chart of the given radius. */
export function computeSky(
  inputs: PosterInputs,
  chartRadius: number,
  allStars: StarRecord[],
  allConstellations: ConstellationRecord[],
): ComputedSky {
  const utcMillis = toUtcMillis(inputs);
  const jd = julianDate(utcMillis);
  const gstDeg = greenwichSiderealDeg(jd);
  const lstDeg = localSiderealDeg(gstDeg, inputs.longitude);

  const byId = new Map<string, ProjectedStar>();
  const stars: ProjectedStar[] = [];

  for (const star of allStars) {
    const horiz = equatorialToHorizontal(star.ra, star.dec, inputs.latitude, lstDeg);
    const pt = projectToChart(horiz, chartRadius);
    if (!pt) continue;
    const projected: ProjectedStar = { star, x: pt.x, y: pt.y, altDeg: horiz.altDeg };
    stars.push(projected);
    byId.set(star.id, projected);
  }

  const segments: ProjectedSegment[] = [];
  if (inputs.showConstellations) {
    for (const con of allConstellations) {
      for (const [aId, bId] of con.segments) {
        const a = byId.get(aId);
        const b = byId.get(bId);
        if (!a || !b) continue;
        segments.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } });
      }
    }
  }

  return { utcMillis, jd, gstDeg, lstDeg, stars, segments };
}

/** Visual radius (chart units) of a star's dot given its magnitude. Brighter (lower mag) = larger. */
export function starDotRadius(mag: number): number {
  const clamped = Math.min(Math.max(mag, -1.5), 4.5);
  return Math.max(0.55, 4.1 - clamped * 0.72);
}
