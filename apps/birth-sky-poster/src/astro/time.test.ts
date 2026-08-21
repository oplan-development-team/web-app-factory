import { describe, expect, it } from 'vitest';
import { greenwichSiderealDeg, julianDate, localSiderealDeg, toUtcMillis } from './time';

describe('toUtcMillis', () => {
  it('subtracts the offset to recover the UTC instant', () => {
    const millis = toUtcMillis({
      year: 2026,
      month: 8,
      day: 21,
      hour: 9,
      minute: 0,
      utcOffsetHours: 9,
    });

    expect(new Date(millis).toISOString()).toBe('2026-08-21T00:00:00.000Z');
  });

  it('handles a negative offset', () => {
    const millis = toUtcMillis({
      year: 2026,
      month: 1,
      day: 1,
      hour: 19,
      minute: 30,
      utcOffsetHours: -5,
    });

    expect(new Date(millis).toISOString()).toBe('2026-01-02T00:30:00.000Z');
  });

  it('handles a fractional offset such as UTC+05:45', () => {
    const millis = toUtcMillis({
      year: 2026,
      month: 3,
      day: 10,
      hour: 12,
      minute: 0,
      utcOffsetHours: 5.75,
    });

    expect(new Date(millis).toISOString()).toBe('2026-03-10T06:15:00.000Z');
  });

  it('rolls over the date when the offset crosses midnight', () => {
    const millis = toUtcMillis({
      year: 2026,
      month: 8,
      day: 21,
      hour: 1,
      minute: 0,
      utcOffsetHours: 9,
    });

    expect(new Date(millis).toISOString()).toBe('2026-08-20T16:00:00.000Z');
  });

  // Date.UTC maps years 0-99 onto 1900-1999 unless the year is set explicitly,
  // which would silently shift a 1950s birthday by a century.
  it('treats two-digit years literally, not as 19xx', () => {
    const millis = toUtcMillis({
      year: 55,
      month: 6,
      day: 1,
      hour: 0,
      minute: 0,
      utcOffsetHours: 0,
    });

    expect(new Date(millis).getUTCFullYear()).toBe(55);
  });

  it('accepts a leap day', () => {
    const millis = toUtcMillis({
      year: 2024,
      month: 2,
      day: 29,
      hour: 12,
      minute: 0,
      utcOffsetHours: 0,
    });

    expect(new Date(millis).toISOString()).toBe('2024-02-29T12:00:00.000Z');
  });
});

describe('julianDate', () => {
  it('returns the J2000.0 epoch for 2000-01-01T12:00Z', () => {
    expect(julianDate(Date.UTC(2000, 0, 1, 12, 0, 0))).toBe(2_451_545.0);
  });

  it('returns 2440587.5 for the Unix epoch', () => {
    expect(julianDate(0)).toBe(2_440_587.5);
  });

  it('advances by exactly one per day', () => {
    const day0 = julianDate(Date.UTC(2026, 7, 21, 0, 0, 0));
    const day1 = julianDate(Date.UTC(2026, 7, 22, 0, 0, 0));

    expect(day1 - day0).toBeCloseTo(1, 10);
  });
});

describe('greenwichSiderealDeg', () => {
  it('matches the published GMST at the J2000.0 epoch', () => {
    // 280.46061837 deg = 18h 41m 50.5s, the standard reference value.
    expect(greenwichSiderealDeg(2_451_545.0)).toBeCloseTo(280.46061837, 6);
  });

  it('advances by roughly 360.9856 degrees per solar day', () => {
    const a = greenwichSiderealDeg(2_460_000.5);
    const b = greenwichSiderealDeg(2_460_001.5);

    expect(((b - a + 360) % 360) - 0.98564736629).toBeCloseTo(0, 6);
  });

  it('always returns a value normalised to [0, 360)', () => {
    for (const jd of [2_400_000.5, 2_451_545.0, 2_460_000.0, 2_500_000.0, 1_721_060.0]) {
      const gmst = greenwichSiderealDeg(jd);

      expect(gmst).toBeGreaterThanOrEqual(0);
      expect(gmst).toBeLessThan(360);
    }
  });

  it('stays normalised for dates far before the epoch', () => {
    const gmst = greenwichSiderealDeg(julianDate(Date.UTC(1900, 0, 1)));

    expect(gmst).toBeGreaterThanOrEqual(0);
    expect(gmst).toBeLessThan(360);
  });
});

describe('localSiderealDeg', () => {
  it('adds an eastern longitude', () => {
    expect(localSiderealDeg(100, 39.6503)).toBeCloseTo(139.6503, 9);
  });

  it('wraps past a full turn', () => {
    expect(localSiderealDeg(350, 20)).toBeCloseTo(10, 9);
  });

  it('wraps a western longitude back into range', () => {
    expect(localSiderealDeg(10, -74.006)).toBeCloseTo(295.994, 9);
  });

  it('handles the antimeridian', () => {
    expect(localSiderealDeg(0, 180)).toBeCloseTo(180, 9);
    expect(localSiderealDeg(0, -180)).toBeCloseTo(180, 9);
  });

  it('always returns a value normalised to [0, 360)', () => {
    for (const gmst of [0, 123.456, 359.999]) {
      for (const lon of [-180, -74, 0, 39.65, 180]) {
        const lst = localSiderealDeg(gmst, lon);

        expect(lst).toBeGreaterThanOrEqual(0);
        expect(lst).toBeLessThan(360);
      }
    }
  });
});

describe('end-to-end sidereal chain', () => {
  // Cross-check against an independently known value: local sidereal time in
  // Greenwich at 2026-08-21T00:00Z. GMST advances 360.98565 deg per day from
  // the J2000.0 anchor, so this pins the whole toUtcMillis -> JD -> GMST path.
  it('produces a consistent LST for a known instant', () => {
    const millis = toUtcMillis({
      year: 2026,
      month: 8,
      day: 21,
      hour: 9,
      minute: 0,
      utcOffsetHours: 9,
    });
    const jd = julianDate(millis);
    const gmst = greenwichSiderealDeg(jd);

    expect(jd).toBeCloseTo(2_461_273.5, 6);

    const days = jd - 2_451_545.0;
    const expected = ((280.46061837 + 360.98564736629 * days) % 360 + 360) % 360;
    expect(gmst).toBeCloseTo(expected, 3);

    expect(localSiderealDeg(gmst, 139.6503)).toBeCloseTo((gmst + 139.6503) % 360, 9);
  });
});
