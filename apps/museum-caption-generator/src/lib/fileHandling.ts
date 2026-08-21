const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'JPEG・PNG・WebP形式の画像を選んでください。';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'ファイルサイズが大きすぎます(20MBまで)。';
  }
  return null;
}

export interface LoadedImage {
  image: HTMLImageElement;
  objectUrl: string;
}

/** File を Object URL 経由で読み込み、寸法取得済みの HTMLImageElement を返す。サーバー送信は行わない。 */
export function loadImageFromFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('画像の読み込みに失敗しました。別のファイルをお試しください。'));
    };
    image.src = objectUrl;
  });
}
