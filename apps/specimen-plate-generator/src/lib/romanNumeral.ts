const TABLE: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** 1〜3999 の整数をローマ数字に変換する（プレート番号の自動連番用）。 */
export function toRomanNumeral(value: number): string {
  let n = Math.max(1, Math.min(3999, Math.round(value)));
  let result = "";
  for (const [num, sym] of TABLE) {
    while (n >= num) {
      result += sym;
      n -= num;
    }
  }
  return result;
}
