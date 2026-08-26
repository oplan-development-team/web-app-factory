import { mulberry32 } from './prng';

/** シードから、バーコード風の縞（各バーの太さ 1 or 2 単位）を決定的に生成する。 */
export function barcodeBars(seed: number, moduleCount = 44): number[] {
  const rnd = mulberry32(seed >>> 0);
  return Array.from({ length: moduleCount }, () => (rnd() < 0.6 ? 1 : 2));
}

export interface BarSegment {
  /** 全幅に対する開始位置の割合（0〜1）。 */
  offset: number;
  /** 全幅に対する太さの割合（0〜1）。 */
  width: number;
}

/**
 * バーの位置・太さを正規化した割合で返す。
 * SVG（ライブプレビュー）と Canvas（PNG書き出し）の両方が同じレイアウトを
 * それぞれのピクセル幅に掛け算して使うことで、見た目を一致させる。
 */
export function barcodeLayout(seed: number, moduleCount = 44): BarSegment[] {
  const bars = barcodeBars(seed, moduleCount);
  const gapUnits = 1;
  const totalUnits = bars.reduce((sum, w) => sum + w + gapUnits, 0);
  let cursorUnits = 0;
  const segments: BarSegment[] = [];
  for (const w of bars) {
    segments.push({ offset: cursorUnits / totalUnits, width: w / totalUnits });
    cursorUnits += w + gapUnits;
  }
  return segments;
}

/** 受領番号らしき数字列をシードから生成する。 */
export function receiptNumber(seed: number): string {
  const n = (seed >>> 0) % 100000000;
  return n.toString().padStart(8, '0');
}

export function formatTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}.${m}.${d}  ${hh}:${mm}`;
}
