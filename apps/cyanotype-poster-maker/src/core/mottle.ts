import { fbm2D } from './random';

export type MottleSampler = (nx: number, ny: number) => number;

/**
 * 手引きの藍液の濃淡ムラ（FR-301）。
 * 正規化座標(0..1)に対して緩やかに揺れる 0..1 の場を返す。これでインクの
 * 不透明度を画素ごとに変調し、デジタルのベタ塗りが機械的に見えるのを避ける。
 */
export function createMottleSampler(seed: number): MottleSampler {
  return (nx, ny) => fbm2D(nx * 3.4, ny * 3.4, seed + 4021, 3);
}

/** ムラの強度 `strength`(0..1) を、インクの不透明度(0..1)へ落とす。 */
export function mottledAlpha(sample: number, strength: number): number {
  const alpha = 1 - strength * (1 - sample) * 0.62;
  return Math.max(0, Math.min(1, alpha));
}
