import {
  AFFINITY_WEIGHT,
  BUCKET_AFFINITY,
  FAMILIES,
  RARITIES,
  RARITY_WEIGHT,
} from "./constants.ts";
import type { Family, Rarity, Rng, Specimen, TiltBucket } from "./types.ts";

/**
 * 抽選ロジック（FR-030〜033）。
 *
 * 傾きは系統を「決める」のではなく、確率を歪めるだけである（SPEC 1.1）。
 * 完全決定にすると 4 方向を順に試して終わりになり、完全ランダムにすると
 * 端末を傾ける意味が消える。バイアスにすることで
 * 「たてに構えるとながれが出やすい」という体感的な学習が成立する。
 *
 * 乱数源は必ず引数で受け取る。モジュール内で Math.random を呼ばない（NFR-008.3）。
 */

/** 傾き区分に対する 4 系統の重み。合計は 1。 */
export function familyWeights(bucket: TiltBucket | null): Record<Family, number> {
  if (bucket === null) {
    // 姿勢が取れなかった場合は均等（FR-030.3）
    const even = 1 / FAMILIES.length;
    return { FLOW: even, GRID: even, RADIAL: even, NOISE: even };
  }
  const affinity = BUCKET_AFFINITY[bucket];
  const rest = (1 - AFFINITY_WEIGHT) / (FAMILIES.length - 1);
  return {
    FLOW: affinity === "FLOW" ? AFFINITY_WEIGHT : rest,
    GRID: affinity === "GRID" ? AFFINITY_WEIGHT : rest,
    RADIAL: affinity === "RADIAL" ? AFFINITY_WEIGHT : rest,
    NOISE: affinity === "NOISE" ? AFFINITY_WEIGHT : rest,
  };
}

/**
 * 重み付き累積比較。丸め誤差で最後の要素を取りこぼさないよう、
 * ループを抜けた場合は末尾を返す（AC-07）。
 */
function pickWeighted<T extends string>(
  order: readonly T[],
  weights: Readonly<Record<T, number>>,
  rng: Rng,
): T {
  const roll = rng();
  let cumulative = 0;
  for (const item of order) {
    cumulative += weights[item];
    if (roll < cumulative) return item;
  }
  const last = order[order.length - 1];
  if (last === undefined) {
    throw new Error("pickWeighted: 候補が空");
  }
  return last;
}

/** 傾き区分に応じて系統を重み付き抽選する（FR-030）。 */
export function pickFamily(bucket: TiltBucket | null, rng: Rng): Family {
  return pickWeighted(FAMILIES, familyWeights(bucket), rng);
}

/** レア度を重み付き抽選する（FR-031）。 */
export function pickRarity(rng: Rng): Rarity {
  return pickWeighted(RARITIES, RARITY_WEIGHT, rng);
}

/**
 * 1 回の抽選。
 * 乱数の消費順は 系統 → レア度 → シード の固定順で、テストがこの順序に依存している。
 */
export function drawSpecimen(
  bucket: TiltBucket | null,
  rng: Rng,
  fromSensor: boolean,
): Specimen {
  const family = pickFamily(bucket, rng);
  const rarity = pickRarity(rng);
  const seed = Math.floor(rng() * 2 ** 32) >>> 0;
  return { family, rarity, seed, bucket, fromSensor };
}
