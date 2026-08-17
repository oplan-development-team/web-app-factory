import { LOGO_MAX_BYTES } from './types';

export const ACCEPTED_LOGO_TYPES = 'image/png,image/jpeg,image/svg+xml,image/webp';

/** Returns an error message, or `null` when the file is acceptable. */
export function validateLogoFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return '画像ファイルを選択してください（PNG / JPEG / SVG / WebP）。';
  }
  if (file.size > LOGO_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `ファイルが大きすぎます（${mb}MB）。2MB 以下にしてください。`;
  }
  return null;
}

/**
 * Reads the file into a data URL. Everything stays in memory — no upload, no
 * object URL that could outlive the tab.
 */
export function readLogoAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('ファイルを読み込めませんでした。'));
    reader.readAsDataURL(file);
  });
}
