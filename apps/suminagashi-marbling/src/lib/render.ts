import type { DistortionField, DropRecord } from './types';
import { computeDropRenderParams, evaluateBasinAt, WASHI_BG } from './ink';

/**
 * Render the basin at an arbitrary resolution, synchronously. Used for the
 * small live-preview canvas (a few hundred px, cheap enough per interaction).
 */
export function renderBasinSync(
  drops: DropRecord[],
  field: DistortionField,
  size: number
): ImageData {
  const params = computeDropRenderParams(drops);
  const img = new ImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const [r, g, b] = evaluateBasinAt(u, v, drops, params, field, WASHI_BG);
      const idx = (y * size + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  return img;
}

/**
 * Render the basin at export resolution, yielding to the event loop between
 * row bands so the UI (loading state, progress) stays responsive even at
 * large sizes like 2048px.
 */
export async function renderBasinChunked(
  drops: DropRecord[],
  field: DistortionField,
  size: number,
  onProgress?: (fraction: number) => void
): Promise<ImageData> {
  const params = computeDropRenderParams(drops);
  const img = new ImageData(size, size);
  const data = img.data;
  const rowsPerChunk = Math.max(1, Math.floor(24000 / size));

  for (let yStart = 0; yStart < size; yStart += rowsPerChunk) {
    const yEnd = Math.min(size, yStart + rowsPerChunk);
    for (let y = yStart; y < yEnd; y++) {
      const v = (y + 0.5) / size;
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / size;
        const [r, g, b] = evaluateBasinAt(u, v, drops, params, field, WASHI_BG);
        const idx = (y * size + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    onProgress?.(yEnd / size);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  }

  return img;
}
