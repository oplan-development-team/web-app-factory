import { renderPoster, type RenderParams } from '../core/compose';
import { LAYOUT_SIZES } from '../core/presets';

export const EXPORT_SCALES = [1, 2, 3] as const;
export type ExportScale = (typeof EXPORT_SCALES)[number];

export interface ExportSize {
  width: number;
  height: number;
}

export function exportSizeFor(layout: RenderParams['layout'], scale: number): ExportSize {
  const base = LAYOUT_SIZES[layout];
  return { width: Math.round(base.width * scale), height: Math.round(base.height * scale) };
}

/**
 * 指定解像度で全工程を再実行して PNG を書き出す（FR-502）。
 * プレビューの拡大ではないので、誤差拡散も所蔵標本の作図も出力解像度で走る。
 */
export async function exportPoster(params: RenderParams, scale: number): Promise<void> {
  const { width, height } = exportSizeFor(params.layout, scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D コンテキストを取得できませんでした');

  renderPoster(ctx, width, height, params);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNGの生成に失敗しました');

  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildFilename(params.label.specimenNo);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** ファイル名に使えない文字を落とす（FR-503）。 */
export function buildFilename(specimenNo: string): string {
  const safe = specimenNo.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/^[._-]+/, '');
  return `cyanotype-${safe || 'specimen'}.png`;
}
