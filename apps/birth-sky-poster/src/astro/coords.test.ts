import { describe, expect, it } from 'vitest';
import { equatorialToHorizontal, projectToChart } from './coords';

/** Right ascension of Polaris (J2000), in degrees. */
const POLARIS_RA = (2 + 31.8 / 60) * 15;
const POLARIS_DEC = 89 + 16 / 60;

describe('equatorialToHorizontal', () => {
  it('places a star on the meridian at its full culmination altitude', () => {
    // A star at dec 0 with hour angle 0, seen from the equator, is at the zenith.
    const { altDeg } = equatorialToHorizontal(100, 0, 0, 100);

    expect(altDeg).toBeCloseTo(90, 6);
  });

  it('puts the celestial pole due north at an altitude equal to the latitude', () => {
    const { altDeg, azDeg } = equatorialToHorizontal(0, 90, 35.6762, 210);

    expect(altDeg).toBeCloseTo(35.6762, 6);
    expect(azDeg).toBeCloseTo(0, 6);
  });

  it('keeps Polaris near the observer latitude at every hour angle', () => {
    for (const lst of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const { altDeg } = equatorialToHorizontal(POLARIS_RA, POLARIS_DEC, 35.6762, lst);

      // Polaris sits 0.74 deg off the true pole, so it circles within that band.
      expect(Math.abs(altDeg - 35.6762)).toBeLessThan(0.8);
    }
  });

  it('mirrors altitude between an observer and their antipode', () => {
    const north = equatorialToHorizontal(80, 20, 40, 150);
    const south = equatorialToHorizontal(80, -20, -40, 150);

    expect(south.altDeg).toBeCloseTo(north.altDeg, 9);
  });

  it('measures azimuth clockwise from north through east', () => {
    // Hour angle 90 deg east of the meridian at the equator -> due east.
    const east = equatorialToHorizontal(0, 0, 0, 270);
    expect(east.azDeg).toBeCloseTo(90, 6);

    const west = equatorialToHorizontal(0, 0, 0, 90);
    expect(west.azDeg).toBeCloseTo(270, 6);
  });

  it('always returns azimuth normalised to [0, 360)', () => {
    for (let lst = 0; lst < 360; lst += 7) {
      const { azDeg } = equatorialToHorizontal(123, -40, 51.5, lst);

      expect(azDeg).toBeGreaterThanOrEqual(0);
      expect(azDeg).toBeLessThan(360);
    }
  });

  // The acos-and-divide form the prototype used has cos(latitude) in the
  // denominator. At the poles that term vanishes, the numerator vanishes with
  // it, and every star collapses onto a single azimuth -- the whole chart
  // degenerates into one straight line of dots.
  it('spreads azimuth across the compass at the north pole (FR-103.2)', () => {
    const azimuths = [0, 90, 180, 270].map(
      (lst) => equatorialToHorizontal(0, 45, 90, lst).azDeg,
    );

    expect(new Set(azimuths.map((a) => a.toFixed(3))).size).toBe(4);
  });

  it('spreads azimuth across the compass at the south pole (FR-103.2)', () => {
    const azimuths = [0, 90, 180, 270].map(
      (lst) => equatorialToHorizontal(0, -45, -90, lst).azDeg,
    );

    expect(new Set(azimuths.map((a) => a.toFixed(3))).size).toBe(4);
  });

  it('reports the pole altitude correctly for a polar observer', () => {
    expect(equatorialToHorizontal(0, 45, 90, 123).altDeg).toBeCloseTo(45, 6);
    expect(equatorialToHorizontal(0, -45, -90, 123).altDeg).toBeCloseTo(45, 6);
  });

  it('never produces NaN or Infinity for any input (FR-103.3)', () => {
    const latitudes = [-90, -89.9999, -45, 0, 45, 89.9999, 90];
    const declinations = [-90, -45, 0, 45, 90];

    for (const lat of latitudes) {
      for (const dec of declinations) {
        for (const lst of [0, 1, 90, 179.9999, 180, 359.9999]) {
          const { altDeg, azDeg } = equatorialToHorizontal(0, dec, lat, lst);

          expect(Number.isFinite(altDeg)).toBe(true);
          expect(Number.isFinite(azDeg)).toBe(true);
        }
      }
    }
  });

  it('clamps altitude to the physical range', () => {
    for (const lat of [-90, 0, 90]) {
      for (const dec of [-90, 90]) {
        const { altDeg } = equatorialToHorizontal(0, dec, lat, 0);

        expect(altDeg).toBeGreaterThanOrEqual(-90);
        expect(altDeg).toBeLessThanOrEqual(90);
      }
    }
  });
});

describe('projectToChart', () => {
  it('maps the zenith to the centre regardless of azimuth', () => {
    for (const azDeg of [0, 90, 137, 270]) {
      const pt = projectToChart({ altDeg: 90, azDeg }, 300);

      expect(pt?.x).toBeCloseTo(0, 9);
      expect(pt?.y).toBeCloseTo(0, 9);
    }
  });

  it('maps the horizon to the outer edge', () => {
    const north = projectToChart({ altDeg: 0, azDeg: 0 }, 300);

    expect(north?.x).toBeCloseTo(0, 9);
    expect(north?.y).toBeCloseTo(-300, 9);
  });

  it('places north up and east right', () => {
    const east = projectToChart({ altDeg: 0, azDeg: 90 }, 300);
    expect(east?.x).toBeCloseTo(300, 9);
    expect(east?.y).toBeCloseTo(0, 9);

    const south = projectToChart({ altDeg: 0, azDeg: 180 }, 300);
    expect(south?.y).toBeCloseTo(300, 9);

    const west = projectToChart({ altDeg: 0, azDeg: 270 }, 300);
    expect(west?.x).toBeCloseTo(-300, 9);
  });

  it('scales radius linearly with the zenith distance', () => {
    const halfway = projectToChart({ altDeg: 45, azDeg: 90 }, 300);

    expect(halfway?.x).toBeCloseTo(150, 9);
  });

  it('rejects positions below the horizon', () => {
    expect(projectToChart({ altDeg: -0.001, azDeg: 0 }, 300)).toBeNull();
    expect(projectToChart({ altDeg: -45, azDeg: 0 }, 300)).toBeNull();
  });
});
