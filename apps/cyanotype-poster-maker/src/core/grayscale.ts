import type { ImageDataLike } from './ctx2d';

/**
 * RGBA 画像を、コントラスト調整済みの輝度場へ変換する（FR-201, FR-202）。
 * 誤差拡散の入力になる。
 */
export function toLuminance(imageData: ImageDataLike, contrast: number): Float32Array {
  const { data, width, height } = imageData;
  const out = new Float32Array(width * height);
  const factor = contrastFactor(contrast);

  for (let i = 0, p = 0; p < out.length; i += 4, p++) {
    const luminance = 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
    const adjusted = factor * (luminance - 128) + 128;
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
