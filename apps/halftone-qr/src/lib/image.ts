import { clamp, type ImageAdjust } from './types';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
] as const;

export const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.join(',');

/** 幅・高さを持たない SVG のための代替寸法 */
const SVG_FALLBACK_SIZE = 512;

export interface LoadedImage {
  element: CanvasImageSource;
  width: number;
  height: number;
  name: string;
  /**
   * サムネイル表示用の ObjectURL。表示している間は必要なので保持し、
   * 画像を差し替える・消すタイミングで releaseImage() で解放する（NFR-001.5）。
   */
  previewUrl: string;
}

/** 使い終わった画像の ObjectURL を解放する */
export function releaseImage(image: LoadedImage | null): void {
  if (image) URL.revokeObjectURL(image.previewUrl);
}

export type LoadResult =
  | { ok: true; image: LoadedImage }
  | { ok: false; message: string };

export function validateFile(file: File): { ok: true } | { ok: false; message: string } {
  if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
    return {
      ok: false,
      message: '対応していない形式です。PNG / JPEG / WebP / GIF / SVG を選んでください。',
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, message: 'ファイルが大きすぎます（上限 20MB）。' };
  }
  return { ok: true };
}

/**
 * ファイルを画像として読み込む。
 *
 * createImageBitmap ではなく HTMLImageElement を使うのは、SVG の Blob を
 * createImageBitmap に渡すと環境によって失敗するため。`<img>` 経由なら
 * SVG 内のスクリプトも実行されない（NFR-001.4）。
 * ObjectURL は decode 完了後に revoke する（NFR-001.5）。
 */
export async function loadImageFile(file: File): Promise<LoadResult> {
  const validation = validateFile(file);
  if (!validation.ok) return validation;

  const url = URL.createObjectURL(file);
  const element = new Image();
  element.decoding = 'async';

  try {
    const loaded = new Promise<void>((resolve, reject) => {
      element.onload = () => resolve();
      element.onerror = () => reject(new Error('decode failed'));
    });
    element.src = url;
    await loaded;

    const width = element.naturalWidth || SVG_FALLBACK_SIZE;
    const height = element.naturalHeight || SVG_FALLBACK_SIZE;
    return {
      ok: true,
      image: { element, width, height, name: file.name, previewUrl: url },
    };
  } catch {
    URL.revokeObjectURL(url);
    return {
      ok: false,
      message: '画像を読み込めませんでした。ファイルが壊れている可能性があります。',
    };
  }
}

export interface DrawRect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * 画像を size×size の正方形へ cover 方式で配置する矩形を求める（SPEC FR-004.4）。
 *
 * 元画像側の矩形ではなく出力側の矩形を返すのは、オフセットで画像を枠外へ
 * 送り出せるようにするため。正方形画像を等倍で見ているときでも
 * オフセットのスライダーが必ず効く（枠内にしか動けない実装だと無反応になる）。
 * はみ出した領域は呼び出し側が白で塗り潰す。
 */
export function computeDrawRect(
  imageWidth: number,
  imageHeight: number,
  size: number,
  adjust: Pick<ImageAdjust, 'zoom' | 'offsetX' | 'offsetY'>,
): DrawRect {
  const safeWidth = Math.max(1, imageWidth);
  const safeHeight = Math.max(1, imageHeight);
  const cover = Math.max(size / safeWidth, size / safeHeight);
  const scale = cover * Math.max(0.01, adjust.zoom);

  const dw = safeWidth * scale;
  const dh = safeHeight * scale;

  return {
    dx: (size - dw) / 2 + adjust.offsetX * (size / 2),
    dy: (size - dh) / 2 + adjust.offsetY * (size / 2),
    dw,
    dh,
  };
}

/**
 * RGBA バイト列を 0..1 の輝度へ落とす。1 = 白。
 *
 * 透明ピクセルは白として合成する（SPEC FR-004.5）。素の RGBA を読むと
 * 透明部が (0,0,0) 扱いになり、画像全体が黒背景として量子化されてしまう。
 * 係数は Rec.709。厳密には線形光に対する式だが、ガンマ符号化された sRGB 値へ
 * そのまま適用するのがハーフトーンにおける慣例で、見た目の期待にも合う。
 */
export function rgbaToLuma(rgba: Uint8ClampedArray, out?: Float32Array): Float32Array {
  const count = rgba.length / 4;
  const target = out ?? new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const offset = i * 4;
    const alpha = rgba[offset + 3] / 255;
    const inverse = 255 * (1 - alpha);
    const r = rgba[offset] * alpha + inverse;
    const g = rgba[offset + 1] * alpha + inverse;
    const b = rgba[offset + 2] * alpha + inverse;
    target[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  return target;
}

/**
 * 明度 → コントラスト → 反転の順に適用する（SPEC FR-005）。
 * 明度で全体を持ち上げてからコントラストで締める順序のほうが、
 * 暗い写真を扱うときに黒潰れを起こしにくい。
 */
export function applyTone(
  luma: Float32Array,
  adjust: Pick<ImageAdjust, 'brightness' | 'contrast' | 'invert'>,
): Float32Array {
  const brightness = clamp(adjust.brightness, -100, 100) / 100;
  const contrast = 1 + clamp(adjust.contrast, -100, 100) / 100;

  for (let i = 0; i < luma.length; i += 1) {
    let value = luma[i] + brightness;
    value = (value - 0.5) * contrast + 0.5;
    if (adjust.invert) value = 1 - value;
    luma[i] = value < 0 ? 0 : value > 1 ? 1 : value;
  }
  return luma;
}

/**
 * 画像を size×size のグリッドへ再サンプリングし、階調調整済みの輝度配列を返す。
 * size は 3N（サブモジュール解像度）で呼ばれる。
 */
// スライダー操作のたびに呼ばれるので、作業用 canvas は使い回す（NFR-003.2）
let workCanvas: HTMLCanvasElement | null = null;

export function sampleToGrid(
  image: LoadedImage,
  size: number,
  adjust: ImageAdjust,
): Float32Array {
  workCanvas ??= document.createElement('canvas');
  const canvas = workCanvas;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('2D コンテキストを取得できませんでした');

  // 枠外・透明部を白地にする
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);

  // サブモジュール単位まで縮小するので、滑らかな補間のほうが階調が安定する
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  const rect = computeDrawRect(image.width, image.height, size, adjust);
  context.drawImage(image.element, rect.dx, rect.dy, rect.dw, rect.dh);

  const { data } = context.getImageData(0, 0, size, size);
  return applyTone(rgbaToLuma(data), adjust);
}
