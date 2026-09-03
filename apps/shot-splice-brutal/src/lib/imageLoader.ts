import type { LoadedImage } from './types';

const MAX_FILE_BYTES = 40 * 1024 * 1024; // 40MB — 素朴な上限。巨大すぎる入力を弾く。

export class ImageLoadError extends Error {}

/**
 * File を検証してデコード済みの HTMLImageElement に変換する。
 * 信頼できない入力(ファイル種別・サイズ)を境界で検証してから処理する。
 */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith('image/')) {
    throw new ImageLoadError(`画像ファイルではない: ${file.name}`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageLoadError(`ファイルサイズが大きすぎる(上限40MB): ${file.name}`);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const element = await decodeImage(objectUrl);
    return {
      element,
      objectUrl,
      fileName: file.name,
      fileSize: file.size,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageLoadError('画像のデコードに失敗した'));
    img.src = src;
  });
}

export function releaseImage(image: LoadedImage | null): void {
  if (image) {
    URL.revokeObjectURL(image.objectUrl);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
