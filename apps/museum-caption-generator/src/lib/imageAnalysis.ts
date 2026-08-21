import type { ImageAnalysis, MoodTag } from './types';

/** 解析用に画像を縮小する一辺の目安。大きすぎる原寸を読まないための上限。 */
const SAMPLE_SIZE = 48;

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l };
  }

  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let h: number;
  if (max === rn) {
    h = ((gn - bn) / delta) % 6;
  } else if (max === gn) {
    h = (bn - rn) / delta + 2;
  } else {
    h = (rn - gn) / delta + 4;
  }
  h *= 60;
  if (h < 0) h += 360;

  return { h, s, l };
}

/**
 * アップロード画像を Canvas 上で縮小し、平均色相・彩度・明度を算出する。
 * ネットワーク送信は行わず、すべてブラウザ内の Canvas API で完結する。
 */
export function analyzeImage(image: HTMLImageElement): ImageAnalysis {
  const naturalWidth = image.naturalWidth || 1;
  const naturalHeight = image.naturalHeight || 1;
  const aspectRatio = naturalWidth / naturalHeight;

  const scale = Math.min(1, SAMPLE_SIZE / Math.max(naturalWidth, naturalHeight));
  const sampleWidth = Math.max(1, Math.round(naturalWidth * scale));
  const sampleHeight = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D コンテキストを取得できませんでした。');
  }
  ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight);

  const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight);

  let sumSin = 0;
  let sumCos = 0;
  let sumS = 0;
  let sumL = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;
    const { h, s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const rad = (h * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
    sumS += s;
    sumL += l;
    count += 1;
  }

  if (count === 0) {
    count = 1;
  }

  let hue = (Math.atan2(sumSin, sumCos) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  const saturation = sumS / count;
  const lightness = sumL / count;

  const tags: MoodTag[] = [];

  if (lightness < 0.35) tags.push('dark');
  else if (lightness > 0.65) tags.push('light');
  else tags.push('mid');

  if (saturation < 0.14) {
    tags.push('mono');
  } else if ((hue >= 0 && hue < 65) || hue >= 300) {
    tags.push('warm');
  } else if (hue >= 150 && hue < 300) {
    tags.push('cool');
  } else {
    tags.push('neutral');
  }

  return { hue, saturation, lightness, aspectRatio, tags };
}
