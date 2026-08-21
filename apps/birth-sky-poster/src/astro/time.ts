/**
 * Time conversion helpers: local wall-clock + numeric UTC offset -> Julian
 * Date -> Greenwich / Local Sidereal Time.
 *
 * These are the standard low-precision formulas used throughout amateur
 * astronomy software (e.g. Meeus, "Astronomical Algorithms"). No
 * precession/nutation correction is applied, matching the simplified scope
 * of this prototype.
 */

export interface LocalDateTimeInput {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  /** Hours east of UTC. Local time = UTC + utcOffsetHours. */
  utcOffsetHours: number;
}

const MS_PER_DAY = 86_400_000;
/** Julian Date of the Unix epoch (1970-01-01T00:00:00Z). */
const UNIX_EPOCH_JD = 2_440_587.5;

/**
 * Converts the given local wall-clock time + UTC offset into the UTC
 * instant expressed as milliseconds since the Unix epoch.
 */
export function toUtcMillis(input: LocalDateTimeInput): number {
  const wallClockAsUtcMillis = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    0,
  );
  return wallClockAsUtcMillis - input.utcOffsetHours * 3_600_000;
}

/** Julian Date for a given UTC instant. */
export function julianDate(utcMillis: number): number {
  return utcMillis / MS_PER_DAY + UNIX_EPOCH_JD;
}

/**
 * Greenwich Mean Sidereal Time in degrees [0, 360) for the given Julian
 * Date. Standard IAU 1982 approximation.
 */
export function greenwichSiderealDeg(jd: number): number {
  const T = (jd - 2_451_545.0) / 36_525;
  let gmst =
    280.46061837 +
    360.98564736629 * (jd - 2_451_545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38_710_000;
  gmst %= 360;
  if (gmst < 0) gmst += 360;
  return gmst;
}

/** Local Sidereal Time in degrees [0, 360) given longitude east of Greenwich (degrees). */
export function localSiderealDeg(gmstDeg: number, longitudeDeg: number): number {
  let lst = gmstDeg + longitudeDeg;
  lst %= 360;
  if (lst < 0) lst += 360;
  return lst;
}

/** Formats sidereal degrees as HH:MM:SS. */
export function formatSiderealTime(deg: number): string {
  const totalHours = deg / 15;
  const h = Math.floor(totalHours);
  const mFloat = (totalHours - h) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
