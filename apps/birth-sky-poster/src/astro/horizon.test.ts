import { describe, expect, it } from 'vitest';
import { equatorialToHorizontal } from './coords';
import { clipPolylineToHorizon, clipSegmentToHorizon, type Observer } from './horizon';

const CHART_RADIUS = 322;

const observer: Observer = { latitude: 35.6762, lstDeg: 120, chartRadius: CHART_RADIUS };

function radius(point: { x: number; y: number }): number {
  return Math.hypot(point.x, point.y);
}

/** Finds a declination that is comfortably above the horizon for this observer. */
function altitudeOf(ra: number, dec: number): number {
  return equatorialToHorizontal(ra, dec, observer.latitude, observer.lstDeg).altDeg;
}

describe('clipSegmentToHorizon', () => {
  it('keeps a segment whose endpoints are both above the horizon', () => {
    const a = { ra: 120, dec: 40 };
    const b = { ra: 130, dec: 45 };
    expect(altitudeOf(a.ra, a.dec)).toBeGreaterThan(0);
    expect(altitudeOf(b.ra, b.dec)).toBeGreaterThan(0);

    const clipped = clipSegmentToHorizon(a, b, observer);

    expect(clipped).not.toBeNull();
    expect(radius(clipped!.a)).toBeLessThan(CHART_RADIUS);
    expect(radius(clipped!.b)).toBeLessThan(CHART_RADIUS);
  });

  it('drops a segment entirely below the horizon', () => {
    const a = { ra: 300, dec: -80 };
    const b = { ra: 310, dec: -75 };
    expect(altitudeOf(a.ra, a.dec)).toBeLessThan(0);
    expect(altitudeOf(b.ra, b.dec)).toBeLessThan(0);

    expect(clipSegmentToHorizon(a, b, observer)).toBeNull();
  });

  // The prototype dropped the whole segment in this case, so a constellation
  // rising over the horizon lost its outer limbs (FR-105.4).
  it('trims a segment that crosses the horizon rather than discarding it', () => {
    const above = { ra: 120, dec: 55 };
    const below = { ra: 120, dec: -70 };
    expect(altitudeOf(above.ra, above.dec)).toBeGreaterThan(0);
    expect(altitudeOf(below.ra, below.dec)).toBeLessThan(0);

    const clipped = clipSegmentToHorizon(above, below, observer);

    expect(clipped).not.toBeNull();
    expect(radius(clipped!.a)).toBeLessThan(CHART_RADIUS);
    // The trimmed end lands on the horizon circle itself.
    expect(radius(clipped!.b)).toBeCloseTo(CHART_RADIUS, 1);
  });

  it('trims the same way when the endpoints are given in the other order', () => {
    const above = { ra: 120, dec: 55 };
    const below = { ra: 120, dec: -70 };

    const forward = clipSegmentToHorizon(above, below, observer)!;
    const backward = clipSegmentToHorizon(below, above, observer)!;

    expect(backward.a.x).toBeCloseTo(forward.b.x, 3);
    expect(backward.a.y).toBeCloseTo(forward.b.y, 3);
    expect(backward.b.x).toBeCloseTo(forward.a.x, 3);
  });

  it('never emits a point outside the horizon circle', () => {
    for (let dec = -90; dec <= 90; dec += 5) {
      for (let ra = 0; ra < 360; ra += 30) {
        const clipped = clipSegmentToHorizon({ ra, dec }, { ra: ra + 20, dec: dec + 15 }, observer);
        if (clipped === null) continue;

        expect(radius(clipped.a)).toBeLessThanOrEqual(CHART_RADIUS + 1e-6);
        expect(radius(clipped.b)).toBeLessThanOrEqual(CHART_RADIUS + 1e-6);
      }
    }
  });

  it('takes the short way round when a segment wraps through RA 0', () => {
    const a = { ra: 355, dec: 60 };
    const b = { ra: 5, dec: 60 };

    const clipped = clipSegmentToHorizon(a, b, observer);

    // A 10-degree-wide figure must not be interpolated the 350-degree way,
    // which would sweep the midpoint across the whole sky.
    if (clipped !== null) {
      expect(Math.hypot(clipped.a.x - clipped.b.x, clipped.a.y - clipped.b.y)).toBeLessThan(
        CHART_RADIUS,
      );
    }
  });

  it('produces finite coordinates for a polar observer', () => {
    const polar: Observer = { latitude: 90, lstDeg: 45, chartRadius: CHART_RADIUS };

    const clipped = clipSegmentToHorizon({ ra: 10, dec: 30 }, { ra: 200, dec: -30 }, polar);

    expect(clipped).not.toBeNull();
    expect(Number.isFinite(clipped!.a.x)).toBe(true);
    expect(Number.isFinite(clipped!.b.y)).toBe(true);
  });
});

describe('clipPolylineToHorizon', () => {
  it('emits one segment per adjacent visible pair', () => {
    const points = [
      { ra: 110, dec: 40 },
      { ra: 120, dec: 45 },
      { ra: 130, dec: 50 },
    ];

    expect(clipPolylineToHorizon(points, observer)).toHaveLength(2);
  });

  it('returns nothing for a polyline with fewer than two points', () => {
    expect(clipPolylineToHorizon([], observer)).toEqual([]);
    expect(clipPolylineToHorizon([{ ra: 120, dec: 40 }], observer)).toEqual([]);
  });

  it('skips the invisible stretch of a polyline that dips below the horizon', () => {
    const points = [
      { ra: 120, dec: 60 },
      { ra: 300, dec: -85 },
      { ra: 305, dec: -85 },
      { ra: 120, dec: 55 },
    ];

    const segments = clipPolylineToHorizon(points, observer);

    // The middle pair is fully below the horizon and must not be drawn.
    expect(segments).toHaveLength(2);
  });
});
