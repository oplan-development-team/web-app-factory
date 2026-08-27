import { fbm2D, valueNoise2D } from './random';
import { createCanvas, type CanvasLike } from './ctx2d';

const TILE_SIZE = 220;

/** キャッシュ上限。再抽選を繰り返してもメモリが単調増加しないようにする（FR-302.2）。 */
export const TEXTURE_CACHE_LIMIT = 16;

/**
 * タイル可能な綿紙の繊維テクスチャを焼く。
 *
 * 低周波の細長い筋（フェルト状の繊維構造）に、高周波の細かい粒を重ねたもの。
 * 中性グレー(128)を中心とした値で持たせることで `globalCompositeOperation = 'overlay'`
 * で合成でき、強度は alpha だけで調整できる（焼き直しが要らない）。
 */
export function generateFiberTextureTile(seed: number): CanvasLike {
  const { canvas, ctx } = createCanvas(TILE_SIZE, TILE_SIZE);
  const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  const data = imageData.data;

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const idx = (y * TILE_SIZE + x) * 4;
      const fiber = fbm2D(x * 0.012, y * 0.09, seed, 3) - 0.5;
      const grain = valueNoise2D(x * 0.9, y * 0.9, seed + 917) - 0.5;
      const value = Math.max(0, Math.min(255, 128 + fiber * 70 + grain * 34));
      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * シード単位のタイルキャッシュ。挿入順で古いものから捨てる（Map は挿入順を保つ）。
 * スライダー操作のたびに焼き直すと 220×220 の画素ループが毎フレーム走る。
 */
const cache = new Map<number, CanvasLike>();

export function getFiberTile(seed: number): CanvasLike {
  const hit = cache.get(seed);
  if (hit) {
    // 参照されたものを末尾へ移し、最近使ったものが残るようにする
    cache.delete(seed);
    cache.set(seed, hit);
    return hit;
  }

  const tile = generateFiberTextureTile(seed);
  cache.set(seed, tile);
  while (cache.size > TEXTURE_CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
  return tile;
}

export function fiberCacheSize(): number {
  return cache.size;
}

export function clearFiberCache(): void {
  cache.clear();
}
