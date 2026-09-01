/**
 * Browsers cap how many pixels a single canvas may hold. Safari on iOS is the
 * tightest mainstream limit at roughly 16.7 megapixels, and it fails by
 * returning a blank canvas rather than throwing, so the app has to warn ahead
 * of time instead of discovering the problem in the saved file.
 */
export const CANVAS_AREA_LIMIT = 16_777_216;

/** Fraction of the limit at which the UI starts warning. */
export const CANVAS_AREA_WARN_RATIO = 0.85;

export type OutputRisk = 'ok' | 'near-limit' | 'over-limit';

export function assessOutputSize(width: number, height: number): OutputRisk {
  const area = Math.max(0, width) * Math.max(0, height);
  if (area > CANVAS_AREA_LIMIT) return 'over-limit';
  if (area >= CANVAS_AREA_LIMIT * CANVAS_AREA_WARN_RATIO) return 'near-limit';
  return 'ok';
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

/** `shot-splice-20260901-161230.png` — sortable and collision-free in practice. */
export function outputFileName(now: Date = new Date()): string {
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `shot-splice-${stamp}.png`;
}

export function formatPx(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}
