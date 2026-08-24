/**
 * 決定的な文字列ハッシュと疑似乱数生成。
 *
 * 同一シード文字列からは、実行環境・実行時刻によらず常に同一の紋が再現される
 * ことを保証する（FR-002）。この層は Math.random / Date / ロケール依存処理を
 * 一切含んではならない。
 */

export type Rng = () => number;

/**
 * シード文字列を正規化する（FR-001.3, FR-002.2）。
 * NFC 正規化により、合成済み濁点と結合濁点のような表現差を吸収する。
 */
export function normalizeSeed(input: string): string {
  return input.normalize("NFC").trim();
}

/**
 * FNV-1a 32bit ハッシュ。
 * コードユニット単位で回すためサロゲートペアも例外なく処理できる（FR-002.3）。
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0;
}

/** mulberry32: 軽量で決定的な疑似乱数生成器。[0, 1) を返す関数を作る。 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [min, max) の浮動小数 */
export function randFloat(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** [min, max] の整数 */
export function randInt(rng: Rng, min: number, max: number): number {
  return Math.min(max, Math.floor(randFloat(rng, min, max + 1)));
}

/** 配列から 1 つ決定的に選ぶ */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick: 候補が空です");
  const idx = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[idx] as T;
}

export interface Weighted<T> {
  value: T;
  weight: number;
}

/** 重み付きで 1 つ決定的に選ぶ。重み 0 の候補は選ばれない。 */
export function weightedPick<T>(rng: Rng, items: readonly Weighted<T>[]): T {
  if (items.length === 0) throw new Error("weightedPick: 候補が空です");
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0) throw new Error("weightedPick: 重みの合計が 0 です");

  let threshold = rng() * total;
  for (const item of items) {
    threshold -= Math.max(0, item.weight);
    if (threshold < 0) return item.value;
  }
  // 浮動小数の丸めで抜けた場合の保険として、重みを持つ最後の候補を返す
  const fallback = [...items].reverse().find((item) => item.weight > 0);
  if (!fallback) throw new Error("weightedPick: 有効な候補がありません");
  return fallback.value;
}

/** シード文字列 + バリアント番号から生成用のシード値(uint32)を作る */
export function seedForVariant(seedText: string, variantIndex: number): number {
  return hashString(`${normalizeSeed(seedText)}::variant:${variantIndex}`);
}
