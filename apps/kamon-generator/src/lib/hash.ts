/**
 * 決定的な文字列ハッシュ + 疑似乱数生成。
 * 同じシード文字列からは常に同じ紋様が再現されることを保証するためのユーティリティ。
 */

/** FNV-1a 32bit ハッシュ。空文字列にも対応。 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  // 符号なし32bitに正規化
  return hash >>> 0;
}

/** mulberry32: 軽量で決定的な疑似乱数生成器。0以上1未満の浮動小数を返す関数を返す。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/** rng()を使い、min以上max未満の浮動小数を返す */
export function randFloat(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** rng()を使い、min以上max以下の整数を返す */
export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(randFloat(rng, min, max + 1));
}

/** 配列から1つ決定的に選ぶ */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  const idx = Math.floor(rng() * items.length) % items.length;
  return items[idx] as T;
}

/** シード文字列 + バリアント番号から、生成用のシード値(uint32)を作る */
export function seedForVariant(seedText: string, variantIndex: number): number {
  return hashString(`${seedText}::variant:${variantIndex}`);
}
