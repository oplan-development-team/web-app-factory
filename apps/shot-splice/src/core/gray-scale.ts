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
/**
 * Returns the rows left after removing `cutTop` rows from the top and
 * `cutBottom` from the bottom.
 *
 * Band cuts are applied here, on the luminance buffer, rather than by
 * re-rasterising the source image. Each shot is rasterised exactly once; every
 * later change to the header/footer settings is then a pure slice, which keeps
 * dragging the cut controls responsive.
 */
export function cropGray(source: GrayImage, cutTop: number, cutBottom: number): GrayImage {
  const top = Math.max(0, Math.min(Math.round(cutTop), source.height));
  const bottom = Math.max(0, Math.min(Math.round(cutBottom), source.height - top));
  const height = source.height - top - bottom;
  if (height <= 0) return { data: new Uint8ClampedArray(0), width: source.width, height: 0 };
  if (top === 0 && bottom === 0) return source;
  const start = top * source.width;
  return {
    data: source.data.slice(start, start + height * source.width),
    width: source.width,
    height,
  };
}

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
