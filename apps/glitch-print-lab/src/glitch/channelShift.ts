import { mulberry32 } from '../rng.ts';

export interface ChannelShiftParams {
  enabled: boolean;
  maxOffset: number;
  seed: number;
}

/**
 * Classic chromatic-aberration split: R and B channels are read from
 * offset coordinates while G stays put as the reference channel.
 */
export function applyChannelShift(imageData: ImageData, params: ChannelShiftParams): ImageData {
  if (!params.enabled || params.maxOffset <= 0) return imageData;

  const { width, height, data } = imageData;
  const out = new Uint8ClampedArray(data.length);
  const rng = mulberry32(params.seed ^ 0x51ed270b);

  const angleR = rng() * Math.PI * 2;
  const angleB = rng() * Math.PI * 2;
  const rDx = Math.round(Math.cos(angleR) * params.maxOffset);
  const rDy = Math.round(Math.sin(angleR) * params.maxOffset * 0.4);
  const bDx = Math.round(Math.cos(angleB) * params.maxOffset);
  const bDy = Math.round(Math.sin(angleB) * params.maxOffset * 0.4);

  const clamp = (v: number, max: number) => (v < 0 ? 0 : v >= max ? max - 1 : v);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dstIdx = (y * width + x) * 4;

      const rx = clamp(x + rDx, width);
      const ry = clamp(y + rDy, height);
      const rIdx = (ry * width + rx) * 4;

      const bx = clamp(x + bDx, width);
      const by = clamp(y + bDy, height);
      const bIdx = (by * width + bx) * 4;

      out[dstIdx] = data[rIdx] ?? 0;
      out[dstIdx + 1] = data[dstIdx + 1] ?? 0;
      out[dstIdx + 2] = data[bIdx + 2] ?? 0;
      out[dstIdx + 3] = data[dstIdx + 3] ?? 255;
    }
  }

  return new ImageData(out, width, height);
}
