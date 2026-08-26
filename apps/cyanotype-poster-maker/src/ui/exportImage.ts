import { renderPoster, type RenderParams } from '../core/compose';
import { LAYOUT_SIZES } from '../core/presets';

/** Renders the poster at export resolution and triggers a PNG download. */
export async function exportPoster(params: RenderParams, scale: number): Promise<void> {
  const base = LAYOUT_SIZES[params.layout];
  const width = Math.round(base.width * scale);
  const height = Math.round(base.height * scale);

  const canvas = document.createElement('canvas');
  renderPoster(canvas, width, height, params);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error('PNGの生成に失敗しました');
  }

  const filename = buildFilename(params.label.specimenNo);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildFilename(specimenNo: string): string {
  const safe = specimenNo.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `cyanotype-${safe || 'specimen'}.png`;
}
