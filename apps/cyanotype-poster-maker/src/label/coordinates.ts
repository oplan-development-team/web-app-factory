/**
 * 座標の検証と整形（FR-405）。
 *
 * 範囲外・非数値は伏字へ落とす。ラベルは自由入力を受けるので、
 * 「89.9999°N」と「891.2°N」が同じ体裁で並ぶと標本票としての信用が壊れる。
 */

export const LAT_LIMIT = 90;
export const LON_LIMIT = 180;

export const BLANK_COORDINATE = '--.----°';

function parse(value: string, limit: number): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  if (Math.abs(num) > limit) return null;
  return num;
}

export function parseLatitude(value: string): number | null {
  return parse(value, LAT_LIMIT);
}

export function parseLongitude(value: string): number | null {
  return parse(value, LON_LIMIT);
}

export function formatLatitude(value: string): string {
  const num = parseLatitude(value);
  if (num === null) return BLANK_COORDINATE;
  return `${Math.abs(num).toFixed(4)}°${num >= 0 ? 'N' : 'S'}`;
}

export function formatLongitude(value: string): string {
  const num = parseLongitude(value);
  if (num === null) return BLANK_COORDINATE;
  return `${Math.abs(num).toFixed(4)}°${num >= 0 ? 'E' : 'W'}`;
}

export function formatCoordinatePair(lat: string, lon: string): string {
  return `${formatLatitude(lat)}, ${formatLongitude(lon)}`;
}

/** 取得した座標を入力欄へ入れる形式（小数第4位、FR-404.3）。 */
export function formatCoordinate(value: number): string {
  return value.toFixed(4);
}
