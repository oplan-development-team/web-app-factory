import { clamp01 } from '../utils/color';

/** Rec.709 perceived luminance per pixel, flattened row-major, values 0..255. */
export function computeLuminanceMap(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    out[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return out;
}

/**
 * Ink density (0..1) for one tone-band role out of `plateCount` bands,
 * evenly spread across the luminance range with generous overlap between
 * neighbouring bands — this overlap is what produces mixed third-color
 * regions once plates are multiply-composited.
 */
export function toneBandDensity(
  luminance: Float32Array,
  plateCount: number,
  bandIndex: number,
): Float32Array {
  const target = ((bandIndex + 0.5) / plateCount) * 255;
  const halfWidth = (255 / plateCount) * 1.3;
  const out = new Float32Array(luminance.length);
  for (let i = 0; i < luminance.length; i++) {
    out[i] = clamp01(1 - Math.abs(luminance[i] - target) / halfWidth);
  }
  return out;
}
