import type { GrayImage } from '../../src/core/types';

/**
 * Deterministic 32-bit PRNG (mulberry32). Tests must be reproducible: a flaky
 * alignment fixture would be indistinguishable from a real regression.
 */
export function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random luminance noise. Every row is distinct, so a seam only matches at one offset. */
export function noiseImage(width: number, height: number, seed: number): GrayImage {
  const rand = makeRandom(seed);
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.floor(rand() * 256);
  return { data, width, height };
}

export function solidImage(width: number, height: number, value: number): GrayImage {
  const data = new Uint8ClampedArray(width * height);
  data.fill(value);
  return { data, width, height };
}

/** Copies rows [y, y + height) out of `src`. */
export function sliceRows(src: GrayImage, y: number, height: number): GrayImage {
  const data = new Uint8ClampedArray(src.width * height);
  data.set(src.data.subarray(y * src.width, (y + height) * src.width));
  return { data, width: src.width, height };
}

/** Stacks images vertically. All inputs must share a width. */
export function stackRows(...parts: readonly GrayImage[]): GrayImage {
  const width = parts[0]?.width ?? 0;
  const height = parts.reduce((sum, p) => sum + p.height, 0);
  const data = new Uint8ClampedArray(width * height);
  let offset = 0;
  for (const part of parts) {
    data.set(part.data, offset);
    offset += part.data.length;
  }
  return { data, width, height };
}

/**
 * Builds a pair of shots that genuinely share `overlap` rows: the tail of the
 * upper image and the head of the lower image are the exact same bytes.
 */
export function overlappingPair(
  width: number,
  upperHeight: number,
  lowerHeight: number,
  overlap: number,
  seed: number,
): { upper: GrayImage; lower: GrayImage } {
  const source = noiseImage(width, upperHeight + lowerHeight - overlap, seed);
  return {
    upper: sliceRows(source, 0, upperHeight),
    lower: sliceRows(source, upperHeight - overlap, lowerHeight),
  };
}

/** Prepends/appends identical bands to every image, simulating a fixed header/footer. */
export function withFixedBands(
  images: readonly GrayImage[],
  header: GrayImage | null,
  footer: GrayImage | null,
): GrayImage[] {
  return images.map((img) => {
    const parts: GrayImage[] = [];
    if (header) parts.push(header);
    parts.push(img);
    if (footer) parts.push(footer);
    return stackRows(...parts);
  });
}
