import { mulberry32 } from '../rng.ts';

export interface ScanlineParams {
  enabled: boolean;
  /** 0-100, fraction of rows replaced. */
  density: number;
  mode: 'noise' | 'duplicate';
  seed: number;
}

/** VHS-style degradation: periodically wipes rows with static noise or a duplicate of another row. */
export function applyScanlineReplace(imageData: ImageData, params: ScanlineParams): ImageData {
  if (!params.enabled || params.density <= 0) return imageData;

  const { width, height, data } = imageData;
  const out = new Uint8ClampedArray(data);
  const rng = mulberry32(params.seed ^ 0x27d4eb2f);
  const probability = Math.min(100, Math.max(0, params.density)) / 100;

  for (let y = 0; y < height; y++) {
    if (rng() > probability) continue;
    const rowOffset = y * width * 4;

    if (params.mode === 'noise') {
      for (let x = 0; x < width; x++) {
        const v = Math.floor(rng() * 255);
        const idx = rowOffset + x * 4;
        out[idx] = v;
        out[idx + 1] = v;
        out[idx + 2] = v;
        out[idx + 3] = 255;
      }
    } else {
      const srcRow = Math.floor(rng() * height);
      const srcOffset = srcRow * width * 4;
      for (let x = 0; x < width * 4; x++) {
        out[rowOffset + x] = data[srcOffset + x] ?? 0;
      }
    }
  }

  return new ImageData(out, width, height);
}
