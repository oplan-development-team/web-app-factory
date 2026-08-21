/**
 * Numeric formatting for the poster's instrument readouts.
 *
 * Every sexagesimal value here rounds *once*, at the smallest unit, and then
 * decomposes. Rounding each component on its own (the prototype's approach)
 * lets a value just below a boundary print as `23:59:60` or `35°59'60"N`,
 * which on a chart that advertises measurement precision reads as a fault.
 */

export function pad2(n: number): string {
  return Math.trunc(n).toString().padStart(2, '0');
}

function pad4(n: number): string {
  return Math.trunc(n).toString().padStart(4, '0');
}

interface Sexagesimal {
  major: number;
  minutes: number;
  seconds: number;
}

/**
 * Splits a fractional quantity into major/minute/second parts, rounding to the
 * nearest second before decomposing so no component can carry to 60.
 *
 * @param wrapAt When given, the major component wraps modulo this value
 *   (24 for a clock, none for an angle).
 */
function toSexagesimal(value: number, wrapAt?: number): Sexagesimal {
  const totalSeconds = Math.round(value * 3600);
  const major = Math.floor(totalSeconds / 3600);
  return {
    major: wrapAt === undefined ? major : ((major % wrapAt) + wrapAt) % wrapAt,
    minutes: Math.floor(totalSeconds / 60) % 60,
    seconds: totalSeconds % 60,
  };
}

export function formatClock(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** Formats sidereal degrees as HH:MM:SS, wrapping a full turn back to 00. */
export function formatSiderealTime(deg: number): string {
  const { major, minutes, seconds } = toSexagesimal(deg / 15, 24);
  return `${pad2(major)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export function formatUtcOffset(hours: number): string {
  const sign = hours >= 0 ? '+' : '-';
  const totalMinutes = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `UTC${sign}${pad2(h)}:${pad2(m)}`;
}

export function formatDate(year: number, month: number, day: number): string {
  return `${pad4(year)}.${pad2(month)}.${pad2(day)}`;
}

/** Formats a signed decimal-degree latitude as e.g. `35°40'34"N`. */
export function formatLat(deg: number): string {
  return formatDms(deg, 'N', 'S');
}

/** Formats a signed decimal-degree longitude as e.g. `139°39'01"E`. */
export function formatLon(deg: number): string {
  return formatDms(deg, 'E', 'W');
}

function formatDms(deg: number, posLabel: string, negLabel: string): string {
  const label = deg >= 0 ? posLabel : negLabel;
  const { major, minutes, seconds } = toSexagesimal(Math.abs(deg));
  return `${major}°${pad2(minutes)}'${pad2(seconds)}"${label}`;
}

export function formatDecimal(deg: number, digits = 4): string {
  return deg.toFixed(digits);
}
