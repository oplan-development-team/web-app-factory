const MAX_FILE_BYTES = 40 * 1024 * 1024; // 40MB — generous for a screenshot, guards against pathological input

export class ImageLoadError extends Error {}

function assertValidImageFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new ImageLoadError('画像ファイルを選んでください');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageLoadError('ファイルサイズが大きすぎます（40MBまで）');
  }
}

/**
 * Decodes an image file into an HTMLImageElement. The object URL is revoked
 * as soon as decoding completes, since the decoded bitmap remains usable by
 * <canvas> drawImage calls afterward.
 */
export async function loadImageFile(file: File): Promise<HTMLImageElement> {
  assertValidImageFile(file);

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;

  try {
    await img.decode();
    return img;
  } catch {
    throw new ImageLoadError('画像を読み込めませんでした（破損している可能性があります）');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
