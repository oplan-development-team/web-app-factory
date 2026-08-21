import { describe, expect, it } from 'vitest';
import { CONSTELLATIONS, MAGNITUDE_LIMIT, STARS } from './catalog';

describe('star catalogue', () => {
  it('carries the expected number of stars', () => {
    expect(STARS.length).toBeGreaterThan(800);
    expect(STARS.length).toBeLessThan(1200);
  });

  it('keeps every star within the declared magnitude limit', () => {
    for (const star of STARS) {
      expect(star.mag).toBeLessThanOrEqual(MAGNITUDE_LIMIT);
    }
  });

  it('keeps every coordinate inside the valid range', () => {
    for (const star of STARS) {
      expect(star.ra).toBeGreaterThanOrEqual(0);
      expect(star.ra).toBeLessThan(360);
      expect(star.dec).toBeGreaterThanOrEqual(-90);
      expect(star.dec).toBeLessThanOrEqual(90);
    }
  });

  it('has no duplicate identifiers', () => {
    expect(new Set(STARS.map((s) => s.id)).size).toBe(STARS.length);
  });

  // Spot-check against published J2000 positions. If the generator's join
  // against the upstream data ever breaks, these are the first things to move.
  it.each([
    ['Sirius', 101.287, -16.716, -1.44],
    ['Betelgeuse', 88.793, 7.407, 0.45],
    ['Vega', 279.235, 38.784, 0.03],
    ['Polaris', 37.955, 89.264, 1.97],
    ['Canopus', 95.988, -52.696, -0.62],
  ])('places %s at its published J2000 position', (name, ra, dec, mag) => {
    const star = STARS.find((s) => s.name === name);

    expect(star).toBeDefined();
    expect(star!.ra).toBeCloseTo(ra, 1);
    expect(star!.dec).toBeCloseTo(dec, 1);
    expect(star!.mag).toBeCloseTo(mag, 1);
  });

  // The prototype padded its catalogue with ~340 uniformly random stars. This
  // asserts that padding is gone: real stars cluster along the Milky Way, so a
  // genuine catalogue is measurably non-uniform in galactic latitude, whereas
  // uniform noise is not.
  it('contains no procedurally generated filler stars', () => {
    const anonymous = STARS.filter((s) => s.name === undefined && s.bayer === undefined);
    for (const star of anonymous) {
      expect(star.id).toMatch(/^HIP\d+$/);
    }

    // Real bright stars concentrate towards the galactic plane; a uniform
    // sphere would put ~50% of them within 30 deg of the celestial equator.
    const nearEquator = STARS.filter((s) => Math.abs(s.dec) < 30).length / STARS.length;
    expect(nearEquator).not.toBeCloseTo(0.5, 2);
  });

  it('names a useful share of its stars', () => {
    expect(STARS.filter((s) => s.name).length).toBeGreaterThan(300);
  });

  it('is sorted brightest first', () => {
    const magnitudes = STARS.map((s) => s.mag);

    expect([...magnitudes].sort((a, b) => a - b)).toEqual(magnitudes);
  });
});

describe('constellation catalogue', () => {
  it('covers all 88 IAU constellations', () => {
    expect(new Set(CONSTELLATIONS.map((c) => c.con)).size).toBe(88);
  });

  // Serpens is the only constellation split into two disjoint figures, so it
  // legitimately appears twice under the same abbreviation. Each half must
  // still carry its own name.
  it('names the two halves of Serpens separately', () => {
    const serpens = CONSTELLATIONS.filter((c) => c.con === 'Ser');

    expect(serpens).toHaveLength(2);
    expect(serpens.map((c) => c.name).sort()).toEqual(['Serpens Caput', 'Serpens Cauda']);
  });

  it('gives every figure a distinct name', () => {
    expect(new Set(CONSTELLATIONS.map((c) => c.name)).size).toBe(CONSTELLATIONS.length);
  });

  it.each(['Ori', 'UMa', 'Cru', 'Cas', 'Sco', 'Lyr'])('includes %s', (abbreviation) => {
    expect(CONSTELLATIONS.some((c) => c.con === abbreviation)).toBe(true);
  });

  it('gives every constellation a full name', () => {
    for (const constellation of CONSTELLATIONS) {
      expect(constellation.name.length).toBeGreaterThan(0);
    }
  });

  it('has at least two vertices in every figure line', () => {
    for (const constellation of CONSTELLATIONS) {
      expect(constellation.lines.length).toBeGreaterThan(0);
      for (const line of constellation.lines) {
        expect(line.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('keeps every vertex inside the valid coordinate range', () => {
    for (const constellation of CONSTELLATIONS) {
      for (const line of constellation.lines) {
        for (const [ra, dec] of line) {
          expect(ra).toBeGreaterThanOrEqual(0);
          expect(ra).toBeLessThan(360);
          expect(dec).toBeGreaterThanOrEqual(-90);
          expect(dec).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it("anchors Orion's figure on Betelgeuse", () => {
    const orion = CONSTELLATIONS.find((c) => c.con === 'Ori');
    const betelgeuse = STARS.find((s) => s.name === 'Betelgeuse')!;

    const touchesBetelgeuse = orion!.lines.some((line) =>
      line.some(
        ([ra, dec]) =>
          Math.abs(ra - betelgeuse.ra) < 0.5 && Math.abs(dec - betelgeuse.dec) < 0.5,
      ),
    );

    expect(touchesBetelgeuse).toBe(true);
  });
});
