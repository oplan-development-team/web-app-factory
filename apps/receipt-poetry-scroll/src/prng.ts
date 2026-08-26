/**
 * 決定性のあるハッシュ関数と疑似乱数生成器。
 * 同じテキスト + 同じシードなら常に同じ値段を返すために使う。
 */

/** FNV-1a 32bit ハッシュ。テキストから決定性のある数値を得る。 */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 2つの32bit整数を雪崩混合し、1つのシード値にまとめる。 */
export function mixSeeds(a: number, b: number): number {
  let h = (a ^ b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = h ^ (h >>> 16);
  return h >>> 0;
}

/** mulberry32: 軽量な決定性PRNG。0以上1未満の数を返す関数を生成する。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function (): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
