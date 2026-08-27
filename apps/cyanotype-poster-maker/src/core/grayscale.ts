import type { ImageDataLike } from './ctx2d';

/** 感光しきい値の中立値。ここを境に、露光を強める／弱める。 */
export const NEUTRAL_EXPOSURE = 128;

/**
 * RGBA 画像を、コントラストと露光を調整した輝度場へ変換する（FR-201〜203）。
 * 誤差拡散の入力になる。
 *
 * 「感光しきい値」を誤差拡散側のしきい値としてではなく、**ここでの露光量**
 * として効かせているのには理由がある。誤差拡散は、はみ出した誤差を隣へ
 * 送って帳尻を合わせる仕組みなので、出力の濃度は入力の明るさに追従し、
 * しきい値をどこに置いてもほとんど変わらない（実測でも 60〜195 の全域で
 * インク比率が 0.431 から動かなかった）。露光量として輝度そのものを
 * 上下させれば、印画紙を長く焼くほど藍が濃くなるという実際の挙動に一致し、
 * スライダーも見た目に効く。
 */
export function toLuminance(
  imageData: ImageDataLike,
  contrast: number,
  exposure: number = NEUTRAL_EXPOSURE,
): Float32Array {
  const { data, width, height } = imageData;
  const out = new Float32Array(width * height);
  const factor = contrastFactor(contrast);
  // しきい値を上げる = 露光を長くする = 全体が暗くなり、インクが増える
  const bias = NEUTRAL_EXPOSURE - exposure;

  for (let i = 0, p = 0; p < out.length; i += 4, p++) {
    const luminance = 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
    const adjusted = factor * (luminance - 128) + 128 + bias;
    out[p] = Math.max(0, Math.min(255, adjusted));
  }
  return out;
}

/**
 * いわゆる Photoshop 式のコントラスト係数。`contrast` は -100..100 で、
 * 0 のとき 1（無変換）になる。
 */
export function contrastFactor(contrast: number): number {
  const c = Math.max(-100, Math.min(100, contrast)) * 2.55;
  return (259 * (c + 255)) / (255 * (259 - c));
}
