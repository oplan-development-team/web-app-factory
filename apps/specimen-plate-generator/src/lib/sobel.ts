/** グレースケール化とSobelフィルタによる輝度勾配（エッジ強度）の算出。 */

export function toGrayscale(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // ITU-R BT.601 の輝度係数
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

const GX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
const GY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

/**
 * Sobelフィルタで各画素の勾配強度を計算し、0〜255に正規化して返す。
 * 端の1pxは勾配0として扱う（境界処理の単純化）。
 */
export function sobelMagnitude(gray: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;
      let k = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++, k++) {
          const v = gray[(y + ky) * width + (x + kx)];
          gx += v * GX[k];
          gy += v * GY[k];
        }
      }
      const mag = Math.sqrt(gx * gx + gy * gy);
      // 理論最大値は約1442（8bit入力×Sobelカーネル）。実写では滅多に到達しないため
      // /3で正規化してから255にクランプし、体感的なコントラストを確保する。
      out[y * width + x] = Math.min(255, mag / 3);
    }
  }
  return out;
}
