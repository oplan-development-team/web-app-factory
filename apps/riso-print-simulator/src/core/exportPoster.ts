import { AppState } from '../types';
import { renderPoster } from './render';
import { ASPECT_SIZES } from './aspect';

/**
 * Re-runs the full pipeline (not a scaled screenshot of the preview) at the
 * requested export resolution and returns a PNG blob.
 */
export async function exportPosterPNG(state: AppState): Promise<Blob> {
  const base = ASPECT_SIZES[state.aspect];
  const width = base.width * state.exportScale;
  const height = base.height * state.exportScale;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D コンテキストを取得できませんでした');

  // Yield one frame so the "書き出し中…" state has actually painted before
  // the heavy synchronous render blocks the main thread.
  await new Promise((resolve) => requestAnimationFrame(resolve));

  renderPoster(ctx, width, height, state);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG書き出しに失敗しました'));
    }, 'image/png');
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
