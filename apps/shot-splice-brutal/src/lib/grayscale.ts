/**
 * 画像の一部の縦範囲[srcYStart, srcYStart+srcHeight)を、指定した幅にリサンプリングして
 * グレースケールの行配列(0..255, Float32Array)に変換する。
 * 戻り値は行優先(row-major)、要素数は targetWidth * targetHeight。
 */
export interface GraySample {
  data: Float32Array;
  width: number;
  height: number;
}

export function sampleGrayscaleRegion(
  image: HTMLImageElement,
  srcYStart: number,
  srcHeight: number,
  targetWidth: number,
  verticalScale: number,
): GraySample {
  const targetHeight = Math.max(1, Math.round(srcHeight * verticalScale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('2D描画コンテキストを取得できなかった');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    image,
    0,
    srcYStart,
    image.naturalWidth,
    srcHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  const { data } = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const gray = new Float32Array(targetWidth * targetHeight);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    // ITU-R BT.601 の輝度係数
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return { data: gray, width: targetWidth, height: targetHeight };
}
