import type { DiscOptions } from '../types';
import { renderDisc } from './render';

const EXPORT_SIZE = 3000;

/** Re-renders the disc at high resolution offscreen and triggers a PNG download. */
export function exportDiscPng(options: DiscOptions, fileBaseName: string): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.reject(new Error('Canvasの取得に失敗しました。'));
  }
  renderDisc(ctx, EXPORT_SIZE, options);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNGの生成に失敗しました。'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileBaseName || 'vinyl-groove-label'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}
