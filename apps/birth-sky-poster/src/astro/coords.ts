/**
 * Equatorial (RA/Dec) -> Horizontal (Alt/Az) conversion, and the azimuthal
 * projection that places a star on the circular chart.
 */

export interface HorizontalPosition {
  /** Altitude above the horizon, degrees. Negative = below horizon. */
  altDeg: number;
  /** Azimuth from North, clockwise through East, degrees [0, 360). */
  azDeg: number;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Converts equatorial coordinates to horizontal (alt/az) coordinates for an
 * observer at the given latitude, using the local sidereal time.
 *
 * The star's direction is resolved as a unit vector in the observer's
 * north/east/up frame and the azimuth is recovered with `atan2`. The textbook
 * `acos((sin d - sin a sin f) / (cos a cos f))` form is avoided deliberately:
 * `cos(latitude)` sits in its denominator, so at the poles the quotient becomes
 * 0/0 and every star in the sky collapses onto a single azimuth -- the chart
 * degenerates into one straight line of dots (FR-103.2). The vector form has no
 * division and stays well behaved everywhere (FR-103.3).
 *
 * @param raDeg Right ascension, degrees [0, 360).
 * @param decDeg Declination, degrees [-90, 90].
 * @param latDeg Observer latitude, degrees [-90, 90].
 * @param lstDeg Local sidereal time, degrees [0, 360).
 */
export function equatorialToHorizontal(
  raDeg: number,
  decDeg: number,
  latDeg: number,
  lstDeg: number,
): HorizontalPosition {
  let haDeg = lstDeg - raDeg;
  haDeg = ((haDeg + 540) % 360) - 180; // normalize to [-180, 180)

  const ha = haDeg * DEG2RAD;
  const dec = decDeg * DEG2RAD;
  const lat = latDeg * DEG2RAD;

  const sinDec = Math.sin(dec);
  const cosDec = Math.cos(dec);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinHa = Math.sin(ha);
  const cosHa = Math.cos(ha);

  const up = sinDec * sinLat + cosDec * cosLat * cosHa;
  const north = sinDec * cosLat - cosDec * sinLat * cosHa;
  const east = -cosDec * sinHa;

  const altDeg = Math.asin(clamp(up, -1, 1)) * RAD2DEG;
  // Exactly at the zenith the azimuth is mathematically undefined; atan2
  // returns a finite value there rather than throwing, which is all the
  // renderer needs since that point maps to the chart centre anyway.
  const azDeg = (Math.atan2(east, north) * RAD2DEG + 360) % 360;

  return { altDeg, azDeg };
}

/**
 * Projects a horizontal position onto a 2D chart of the given radius using an
 * azimuthal-equidistant projection centred on the zenith: the zenith (alt=90)
 * maps to the centre, the horizon (alt=0) maps to the outer edge. North is
 * placed at the top and East to the right, matching the view of an observer
 * lying on their back facing the zenith with their head to the north.
 *
 * Returns null if the position is below the horizon.
 */
export function projectToChart(
  pos: HorizontalPosition,
  radius: number,
): { x: number; y: number } | null {
  if (pos.altDeg < 0) return null;
  const r = radius * (1 - pos.altDeg / 90);
  const az = pos.azDeg * DEG2RAD;
  return {
    x: r * Math.sin(az),
    y: -r * Math.cos(az),
  };
}
