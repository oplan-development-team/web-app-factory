export function pad2(n: number): string {
  return Math.trunc(n).toString().padStart(2, '0');
}

export function formatClock(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function formatUtcOffset(hours: number): string {
  const sign = hours >= 0 ? '+' : '-';
  const abs = Math.abs(hours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `UTC${sign}${pad2(h)}:${pad2(m)}`;
}

export function formatDate(year: number, month: number, day: number): string {
  return `${year}.${pad2(month)}.${pad2(day)}`;
}

/** Formats a signed decimal-degree latitude as e.g. "35°40'12\"N". */
export function formatLat(deg: number): string {
  return formatDms(deg, 'N', 'S');
}

/** Formats a signed decimal-degree longitude as e.g. "139°45'09\"E". */
export function formatLon(deg: number): string {
  return formatDms(deg, 'E', 'W');
}

function formatDms(deg: number, posLabel: string, negLabel: string): string {
  const label = deg >= 0 ? posLabel : negLabel;
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const minFloat = (abs - d) * 60;
  const m = Math.floor(minFloat);
  const s = Math.round((minFloat - m) * 60);
  return `${d}°${pad2(m)}'${pad2(s)}"${label}`;
}

export function formatDecimal(deg: number, digits = 4): string {
  return deg.toFixed(digits);
}
