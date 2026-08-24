const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_DIMENSION = 8000; // px（巨大画像で処理が固まるのを防ぐ）

export class UploadError extends Error {}

/**
 * アップロードされたファイルを検証し、HTMLImageElement として読み込む。
 * 非対応形式・巨大すぎるファイル/画像はエラーとして投げる。
 */
export async function loadImageFile(file: File): Promise<HTMLImageElement> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new UploadError("対応していないファイル形式です。JPEG・PNG・WebPのいずれかを選んでください。");
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError("ファイルサイズが大きすぎます（上限20MB）。");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new UploadError("画像を読み込めませんでした。ファイルが破損している可能性があります。"));
      img.src = objectUrl;
    });

    if (image.naturalWidth === 0 || image.naturalHeight === 0) {
      throw new UploadError("画像を読み込めませんでした。");
    }
    if (image.naturalWidth > MAX_DIMENSION || image.naturalHeight > MAX_DIMENSION) {
      throw new UploadError(`画像が大きすぎます（一辺${MAX_DIMENSION}px以下にしてください）。`);
    }
    return image;
  } finally {
    // 画像はデコード済みなので、以降このURLは不要
    URL.revokeObjectURL(objectUrl);
  }
}
