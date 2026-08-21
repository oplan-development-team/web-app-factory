/** Equatorial (RA/Dec) -> Horizontal (Alt/Az) conversion, and the azimuthal
 * projection used to place a star on the circular chart. */

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
 * @param raDeg Right ascension, degrees [0, 360).
 * @param decDeg Declination, degrees [-90, 90].
 * @param latDeg Observer latitude, degrees.
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

  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const alt = Math.asin(clamp(sinAlt, -1, 1));

  const cosAz =
    (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat) || 1e-12);
  let az = Math.acos(clamp(cosAz, -1, 1));
  if (Math.sin(ha) > 0) az = 2 * Math.PI - az;

  return {
    altDeg: alt * RAD2DEG,
    azDeg: az * RAD2DEG,
  };
}

/**
 * Projects a horizontal position onto a 2D chart of the given radius using
 * an azimuthal-equidistant projection centered on the zenith: the zenith
 * (alt=90) maps to the center, the horizon (alt=0) maps to the outer edge.
 * North is placed at the top, East to the right (matching the view of an
 * observer lying on their back facing the zenith with head to the north).
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
