import type { DistortionField, DropRecord } from './types';
import { renderBasinChunked } from './render';

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

/** Render the raw seamless tile (drops + field re-evaluated at `size`). */
export async function renderTileCanvas(
  drops: DropRecord[],
  field: DistortionField,
  size: number,
  onProgress?: (fraction: number) => void
): Promise<HTMLCanvasElement> {
  const img = await renderBasinChunked(drops, field, size, onProgress);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Compose an NxN tiled preview from a single seamless tile canvas, so seams
 * can be checked before committing to a download.
 */
export function composeTilingPreview(tile: HTMLCanvasElement, repeat: 2 | 3): HTMLCanvasElement {
  const size = tile.width;
  const canvas = makeCanvas(size * repeat);
  const ctx = canvas.getContext('2d')!;
  for (let j = 0; j < repeat; j++) {
    for (let i = 0; i < repeat; i++) {
      ctx.drawImage(tile, i * size, j * size);
    }
  }
  return canvas;
}

export interface PosterOptions {
  index: number;
  createdAt: number;
}

/**
 * Compose a museum-label poster finish around the tile: a washi margin, a
 * thin brass rule, and a small instrument-style caption row.
 */
export function composePosterCanvas(tile: HTMLCanvasElement, opts: PosterOptions): HTMLCanvasElement {
  const inner = tile.width;
  const margin = Math.round(inner * 0.08);
  const captionHeight = Math.round(inner * 0.09);
  const size = inner + margin * 2;
  const canvas = makeCanvas(size + 0);
  canvas.width = size;
  canvas.height = size + captionHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ece5d8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(tile, margin, margin, inner, inner);

  const ruleInset = Math.max(2, Math.round(inner * 0.006));
  ctx.strokeStyle = '#b08d57';
  ctx.lineWidth = Math.max(1, Math.round(inner * 0.0025));
  ctx.strokeRect(
    margin - ruleInset,
    margin - ruleInset,
    inner + ruleInset * 2,
    inner + ruleInset * 2
  );

  const date = new Date(opts.createdAt);
  const stamp = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate()
  ).padStart(2, '0')}`;
  const label = `SUMINAGASHI  No.${String(opts.index).padStart(3, '0')}  —  ${inner}×${inner}  —  ${stamp}`;

  ctx.fillStyle = '#3a2f22';
  ctx.font = `${Math.max(10, Math.round(inner * 0.02))}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvas.width / 2, size + captionHeight / 2, canvas.width - margin);

  return canvas;
}

export async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNGへの変換に失敗しました'));
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
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
