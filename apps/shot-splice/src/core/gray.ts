import type { GrayImage } from './types';

/** Default cap on how many rows a single coarse-pass comparison inspects. */
export const DEFAULT_ROW_SAMPLES = 256;

/**
 * Picks up to `budget` row offsets, spread evenly across a band of `height` rows.
 *
 * This is the *only* sanctioned way to make the coarse alignment pass cheaper.
 * Downscaling the band vertically (averaging neighbouring rows together) would
 * be faster still, but it smears the single-pixel cost spike that marks a true
 * seam across its neighbours — the exact bug that shipped in the
 * `shot-splice-grid` prototype. Sampling keeps every inspected row at full
 * vertical fidelity: shift the band by one row and the sampled rows line up
 * against different content, so the spike survives.
 */
export function rowIndices(height: number, budget = DEFAULT_ROW_SAMPLES): number[] {
  if (height <= 0) return [];
  const count = Math.max(1, Math.min(height, Math.floor(budget)));
  if (count >= height) return Array.from({ length: height }, (_, i) => i);
  const indices: number[] = [];
  for (let i = 0; i < count; i += 1) {
    indices.push(Math.floor((i * height) / count));
  }
  return indices;
}

/**
 * Mean absolute luminance difference between the last `h` rows of `upper` and
 * the first `h` rows of `lower`. Lower is a better match; a pixel-perfect seam
 * returns exactly 0.
 *
 * Returns Infinity when the band cannot exist, so callers can compare costs
 * without special-casing impossible candidates.
 */
export function seamCost(
  upper: GrayImage,
  lower: GrayImage,
  h: number,
  rowBudget = Number.POSITIVE_INFINITY,
): number {
  if (h <= 0 || h > upper.height || h > lower.height) return Infinity;

  const width = Math.min(upper.width, lower.width);
  if (width <= 0) return Infinity;

  const rows = rowIndices(h, rowBudget);
  const upperFirstRow = upper.height - h;

  let sum = 0;
  for (const row of rows) {
    const upperOffset = (upperFirstRow + row) * upper.width;
    const lowerOffset = row * lower.width;
    for (let x = 0; x < width; x += 1) {
      sum += Math.abs((upper.data[upperOffset + x] as number) - (lower.data[lowerOffset + x] as number));
    }
  }
  return sum / (rows.length * width);
}

/**
 * Mean absolute luminance difference between row `ya` of `a` and row `yb` of `b`.
 * Used by the fixed-band detector, which walks rows rather than bands.
 */
export function rowCost(a: GrayImage, b: GrayImage, ya: number, yb: number): number {
  const width = Math.min(a.width, b.width);
  if (width <= 0) return Infinity;
  if (ya < 0 || yb < 0 || ya >= a.height || yb >= b.height) return Infinity;

  const aOffset = ya * a.width;
  const bOffset = yb * b.width;
  let sum = 0;
  for (let x = 0; x < width; x += 1) {
    sum += Math.abs((a.data[aOffset + x] as number) - (b.data[bOffset + x] as number));
  }
  return sum / width;
}
