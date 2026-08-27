const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png']);

/**
 * 受け入れ上限（FR-110.4）。
 *
 * 上限を設けないと、巨大画像で `getImageData` が失敗して無言で真っ白な
 * プレートが出る。ブラウザごとに限界が違うので、どの環境でも安全側に倒れる
 * 値を自分で決めておく。
 */
export const MAX_IMAGE_EDGE = 12000;
export const MAX_IMAGE_PIXELS = 40_000_000;

export class ImageLoadError extends Error {}

export function isAcceptedImageFile(file: File): boolean {
  return ACCEPTED_TYPES.has(file.type);
}

export interface SizeCheck {
  ok: boolean;
  message?: string;
}

export function checkImageSize(width: number, height: number): SizeCheck {
  if (width <= 0 || height <= 0) {
    return { ok: false, message: '画像の寸法を読み取れませんでした。別のファイルを試してください' };
  }
  if (width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE) {
    return {
      ok: false,
      message: `画像が大きすぎます（長辺 ${MAX_IMAGE_EDGE}px まで）。縮小してから読み込んでください`,
    };
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    return {
      ok: false,
      message: `画像の画素数が多すぎます（${Math.round(MAX_IMAGE_PIXELS / 1_000_000)} メガピクセルまで）。縮小してから読み込んでください`,
    };
  }
  return { ok: true };
}

/** File を HTMLImageElement へ復号する。canvas へ描ける状態で返す。 */
export function loadImageFile(file: File): Promise<HTMLImageElement> {
  if (!isAcceptedImageFile(file)) {
    return Promise.reject(new ImageLoadError('JPEGまたはPNG形式の画像を選んでください'));
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    const cleanup = (): void => URL.revokeObjectURL(url);

    image.onload = () => {
      cleanup();
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      const check = checkImageSize(width, height);
      if (!check.ok) {
        reject(new ImageLoadError(check.message ?? '画像を読み込めませんでした'));
        return;
      }
      resolve(image);
    };

    image.onerror = () => {
      cleanup();
      reject(new ImageLoadError('画像を読み込めませんでした。ファイルが破損している可能性があります'));
    };

    image.src = url;
  });
}
