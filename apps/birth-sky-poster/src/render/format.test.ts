import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDecimal,
  formatLat,
  formatLon,
  formatSiderealTime,
  formatUtcOffset,
  pad2,
} from './format';

describe('pad2', () => {
  it('pads to two digits and truncates fractions', () => {
    expect(pad2(0)).toBe('00');
    expect(pad2(7)).toBe('07');
    expect(pad2(7.9)).toBe('07');
    expect(pad2(42)).toBe('42');
  });
});

describe('formatSiderealTime', () => {
  it('converts degrees to hours at 15 degrees per hour', () => {
    expect(formatSiderealTime(0)).toBe('00:00:00');
    expect(formatSiderealTime(15)).toBe('01:00:00');
    expect(formatSiderealTime(180)).toBe('12:00:00');
  });

  it('renders minutes and seconds', () => {
    // 280.460618 deg is GMST at J2000.0 -> 18h 41m 50s.
    expect(formatSiderealTime(280.460618)).toBe('18:41:51');
  });

  // Rounding each component independently lets a value just under a boundary
  // print as ":60", which reads as a broken instrument on the poster.
  it('never emits a 60 in the minute or second field (FR-005.4)', () => {
    expect(formatSiderealTime(14.9999)).toBe('01:00:00');
    expect(formatSiderealTime(359.99999)).toBe('00:00:00');
    expect(formatSiderealTime(224.99999)).toBe('15:00:00');
  });

  it('wraps a full turn back to zero rather than printing 24', () => {
    expect(formatSiderealTime(360)).toBe('00:00:00');
  });

  it.each([0.0001, 12.5, 99.9999, 179.99999, 271.4562, 359.9])(
    'stays within range for %f degrees',
    (deg) => {
      const [h = '', m = '', s = ''] = formatSiderealTime(deg).split(':');

      expect(Number(h)).toBeLessThan(24);
      expect(Number(m)).toBeLessThan(60);
      expect(Number(s)).toBeLessThan(60);
    },
  );
});

describe('formatLat / formatLon', () => {
  it('renders degrees, minutes and seconds with a hemisphere suffix', () => {
    expect(formatLat(35.6762)).toBe(`35°40'34"N`);
    expect(formatLat(-33.8688)).toBe(`33°52'08"S`);
    expect(formatLon(139.6503)).toBe(`139°39'01"E`);
    expect(formatLon(-74.006)).toBe(`74°00'22"W`);
  });

  it('treats zero as the positive hemisphere', () => {
    expect(formatLat(0)).toBe(`0°00'00"N`);
    expect(formatLon(0)).toBe(`0°00'00"E`);
  });

  it('never emits a 60 in the minute or second field (FR-005.4)', () => {
    expect(formatLat(35.99999)).toBe(`36°00'00"N`);
    expect(formatLat(-0.99999)).toBe(`1°00'00"S`);
    expect(formatLon(120.0166666)).toBe(`120°01'00"E`);
  });

  it('handles the poles and the antimeridian', () => {
    expect(formatLat(90)).toBe(`90°00'00"N`);
    expect(formatLat(-90)).toBe(`90°00'00"S`);
    expect(formatLon(180)).toBe(`180°00'00"E`);
    expect(formatLon(-180)).toBe(`180°00'00"W`);
  });
});

describe('formatUtcOffset', () => {
  it('renders whole and fractional hour offsets', () => {
    expect(formatUtcOffset(9)).toBe('UTC+09:00');
    expect(formatUtcOffset(-3.5)).toBe('UTC-03:30');
    expect(formatUtcOffset(5.75)).toBe('UTC+05:45');
    expect(formatUtcOffset(0)).toBe('UTC+00:00');
  });

  it('renders the extremes of the accepted range', () => {
    expect(formatUtcOffset(14)).toBe('UTC+14:00');
    expect(formatUtcOffset(-12)).toBe('UTC-12:00');
  });

  it('never emits a 60 in the minute field (FR-005.4)', () => {
    expect(formatUtcOffset(9.999)).toBe('UTC+10:00');
    expect(formatUtcOffset(-0.9999)).toBe('UTC-01:00');
  });
});

describe('formatDate', () => {
  it('renders a dot-separated zero-padded date', () => {
    expect(formatDate(2026, 8, 21)).toBe('2026.08.21');
    expect(formatDate(1987, 12, 5)).toBe('1987.12.05');
  });

  it('pads years shorter than four digits', () => {
    expect(formatDate(42, 1, 1)).toBe('0042.01.01');
  });
});

describe('formatDecimal', () => {
  it('renders a fixed number of fraction digits', () => {
    expect(formatDecimal(35.6762)).toBe('35.6762');
    expect(formatDecimal(35.6762, 2)).toBe('35.68');
    expect(formatDecimal(-7, 1)).toBe('-7.0');
  });
});
