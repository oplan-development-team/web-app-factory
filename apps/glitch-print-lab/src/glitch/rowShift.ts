import { mulberry32 } from '../rng.ts';

export interface RowShiftParams {
  enabled: boolean;
  maxShift: number;
  bandHeight: number;
  mode: 'random' | 'wave';
  seed: number;
}

/** Shifts horizontal bands of pixels left/right, wrapping at the edges. */
export function applyRowShift(imageData: ImageData, params: RowShiftParams): ImageData {
  if (!params.enabled || params.maxShift <= 0) return imageData;

  const { width, height, data } = imageData;
  const out = new Uint8ClampedArray(data.length);
  const rng = mulberry32(params.seed ^ 0x9e3779b9);
  const bandHeight = Math.max(1, Math.round(params.bandHeight));

  for (let bandStart = 0; bandStart < height; bandStart += bandHeight) {
    let shift: number;
    if (params.mode === 'wave') {
      const phase = bandStart / bandHeight;
      shift = Math.round(Math.sin(phase * 0.8 + params.seed * 0.001) * params.maxShift);
    } else {
      shift = Math.round((rng() * 2 - 1) * params.maxShift);
    }
    const bandEnd = Math.min(height, bandStart + bandHeight);
    for (let y = bandStart; y < bandEnd; y++) {
      const rowOffset = y * width * 4;
      for (let x = 0; x < width; x++) {
        const srcX = ((x - shift) % width + width) % width;
        const srcIdx = rowOffset + srcX * 4;
        const dstIdx = rowOffset + x * 4;
        out[dstIdx] = data[srcIdx] ?? 0;
        out[dstIdx + 1] = data[srcIdx + 1] ?? 0;
        out[dstIdx + 2] = data[srcIdx + 2] ?? 0;
        out[dstIdx + 3] = data[srcIdx + 3] ?? 255;
      }
    }
  }

  return new ImageData(out, width, height);
}
