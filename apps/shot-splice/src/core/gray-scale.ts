import type { GrayImage } from './types';

/**
 * Averages a luminance buffer down to `targetWidth` columns **without touching
 * its height**.
 *
 * The height restriction is not an oversight, it is the point. The coarse
 * alignment pass needs cheap comparisons, and the tempting way to get them is
 * to shrink the image in both directions. Shrinking vertically averages
 * neighbouring rows together, which smears the razor-thin cost minimum that
 * marks a real seam across several offsets and lets the search settle on the
 * wrong one. Squashing horizontally costs the same amount of work and leaves
 * every row addressable at its original position.
 */
export function squashWidth(source: GrayImage, targetWidth: number): GrayImage {
  const width = Math.max(1, Math.floor(targetWidth));
  if (source.width <= width || source.width === 0) return source;

  const data = new Uint8ClampedArray(width * source.height);
  for (let y = 0; y < source.height; y += 1) {
    const srcRow = y * source.width;
    const dstRow = y * width;
    for (let x = 0; x < width; x += 1) {
      const from = Math.floor((x * source.width) / width);
      const to = Math.max(from + 1, Math.floor(((x + 1) * source.width) / width));
      let sum = 0;
      for (let sx = from; sx < to; sx += 1) sum += source.data[srcRow + sx] as number;
      data[dstRow + x] = sum / (to - from);
    }
  }
  return { data, width, height: source.height };
}
