const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png']);

export class ImageLoadError extends Error {}

export function isAcceptedImageFile(file: File): boolean {
  return ACCEPTED_TYPES.has(file.type);
}

/** Decodes a File into an HTMLImageElement, ready for canvas drawing. */
export function loadImageFile(file: File): Promise<HTMLImageElement> {
  if (!isAcceptedImageFile(file)) {
    return Promise.reject(new ImageLoadError('JPEGまたはPNG形式の画像を選んでください'));
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageLoadError('画像を読み込めませんでした。ファイルが破損している可能性があります'));
    };
    img.src = url;
  });
}
