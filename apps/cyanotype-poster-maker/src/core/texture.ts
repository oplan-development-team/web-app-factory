import { fbm2D, valueNoise2D } from './random';

const TILE_SIZE = 220;

/**
 * Bakes a tileable cotton-paper fiber texture: elongated low-frequency
 * streaks (the felted fiber structure) plus a fine high-frequency grain
 * on top. Encoded as a neutral-gray (128) centered map so it can be
 * composited with `globalCompositeOperation = 'overlay'` — alpha then
 * controls strength without needing to regenerate the bake.
 */
export function generateFiberTextureTile(seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  const data = imageData.data;

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const idx = (y * TILE_SIZE + x) * 4;
      const fiber = fbm2D(x * 0.012, y * 0.09, seed, 3) - 0.5;
      const grain = valueNoise2D(x * 0.9, y * 0.9, seed + 917) - 0.5;
      const value = 128 + fiber * 70 + grain * 34;
      const v = Math.max(0, Math.min(255, value));
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function createFiberPattern(ctx: CanvasRenderingContext2D, seed: number): CanvasPattern | null {
  const tile = generateFiberTextureTile(seed);
  return ctx.createPattern(tile, 'repeat');
}
