import { computeDimensions } from './dimensions';
import type { FrontLayer, LoadedImage } from './types';

interface CompositeParams {
  top: LoadedImage;
  bottom: LoadedImage;
  cutBottomOfTop: number;
  cutTopOfBottom: number;
  overlapPx: number;
  frontLayer: FrontLayer;
}

/** 現在の設定から、最終出力と同一ロジックで継ぎ足し済みcanvasを構築する。 */
export function buildComposite(params: CompositeParams): HTMLCanvasElement {
  const { top, bottom, cutBottomOfTop, cutTopOfBottom, overlapPx, frontLayer } = params;
  const dims = computeDimensions(top, bottom, cutBottomOfTop, cutTopOfBottom, overlapPx);
  const overlapClamped = Math.max(0, Math.min(overlapPx, dims.maxOverlap));

  const canvas = document.createElement('canvas');
  canvas.width = dims.outputWidth;
  canvas.height = dims.outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D描画コンテキストを取得できなかった');
  }

  const topDestY = 0;
  const bottomDestY = dims.topHeight - overlapClamped;

  const drawTop = () =>
    ctx.drawImage(
      top.element,
      0,
      0,
      dims.outputWidth,
      dims.topHeight,
      0,
      topDestY,
      dims.outputWidth,
      dims.topHeight,
    );
  const drawBottom = () =>
    ctx.drawImage(
      bottom.element,
      0,
      cutTopOfBottom,
      dims.outputWidth,
      dims.bottomHeight,
      0,
      bottomDestY,
      dims.outputWidth,
      dims.bottomHeight,
    );

  // 背面レイヤーを全体描画してから、前面に出す方を上書きする
  if (frontLayer === 'top') {
    drawBottom();
    drawTop();
  } else {
    drawTop();
    drawBottom();
  }

  return canvas;
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, fileName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNGへの変換に失敗した'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}
