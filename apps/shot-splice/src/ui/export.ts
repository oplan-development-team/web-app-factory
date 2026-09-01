import { outputFileName } from '../core/output';
import type { Layout } from '../core/types';
import { composeCanvas, type ShotSource } from '../imaging/compose';
import type { CanvasFactory } from '../imaging/surface';
import type { FrontLayer } from '../core/types';

export interface ExportDeps {
  readonly factory?: CanvasFactory;
  readonly now?: () => Date;
  readonly saveBlob?: (blob: Blob, filename: string) => void;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Renders the splice at full resolution and hands it over as a PNG.
 *
 * This is the only place a full-size canvas exists. `toBlob` yields `null`
 * rather than throwing when the surface exceeds what the browser will allocate,
 * so that case is turned into a real error the caller can explain.
 */
export async function exportPng(
  shots: readonly ShotSource[],
  layout: Layout,
  fronts: readonly FrontLayer[],
  deps: ExportDeps = {},
): Promise<string> {
  if (layout.width <= 0 || layout.height <= 0) {
    throw new Error('書き出せる合成結果がありません。');
  }

  const canvas = composeCanvas(shots, layout, {
    fronts,
    scale: 1,
    background: '#000000',
    ...(deps.factory ? { factory: deps.factory } : {}),
  }) as unknown as HTMLCanvasElement;

  const blob = await new Promise<Blob | null>((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null);
      return;
    }
    canvas.toBlob(resolve, 'image/png');
  });

  if (!blob) {
    throw new Error(
      'PNGの書き出しに失敗しました。出力サイズが大きすぎる可能性があります。ショットを減らすか、重なりを増やしてから再試行してください。',
    );
  }

  const filename = outputFileName(deps.now?.() ?? new Date());
  (deps.saveBlob ?? downloadBlob)(blob, filename);
  return filename;
}
