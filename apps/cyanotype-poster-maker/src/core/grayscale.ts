/**
 * Converts RGBA image data into a contrast-adjusted luminance field
 * used as the input to the Floyd-Steinberg diffusion step.
 */
export function toLuminance(imageData: ImageData, contrast: number): Float32Array {
  const { data, width, height } = imageData;
  const out = new Float32Array(width * height);
  // Standard "Photoshop-style" contrast curve, contrast in -100..100.
  const c = Math.max(-100, Math.min(100, contrast));
  const factor = (259 * (c * 2.55 + 255)) / (255 * (259 - c * 2.55));

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const luminance = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const adjusted = factor * (luminance - 128) + 128;
    out[p] = Math.max(0, Math.min(255, adjusted));
  }
  return out;
}
