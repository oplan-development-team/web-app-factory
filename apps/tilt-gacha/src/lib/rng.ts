import type { Rng } from "./types.ts";

/**
 * 決定的な擬似乱数（FR-100.1）。
 * `Math.random` を使わないのは、模様がシードだけから完全に再生成できる必要があるため
 * （図鑑はシード整数しか保存しない — FR-200.2）。
 */
export function mulberry32(seed: number): Rng {
  // 32bit に畳んでおく。負値・2^32 超のシードでも同じ経路で扱えるようにするため。
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `[min, max)` の実数。 */
export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** `[min, max]` の整数（両端を含む）。 */
export function randInt(rng: Rng, min: number, max: number): number {
  return Math.min(max, min + Math.floor(rng() * (max - min + 1)));
}

/**
 * 配列から 1 要素を選ぶ。
 * `noUncheckedIndexedAccess` 下でも undefined を返さないよう、末尾に丸めてから取り出す。
 */
export function randPick<T>(rng: Rng, items: readonly T[]): T {
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
  const picked = items[index];
  if (picked === undefined) {
    throw new Error("randPick: 空の配列からは選べない");
  }
  return picked;
}
