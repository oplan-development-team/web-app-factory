import { PAPER_SIZE_MM } from './constants';
import { drawInkSegments } from './ink';
import { drawPaperTexture } from './paper';
import type { ScaledGeometry } from './pendulum';
import type { TrajectoryPoint, PaperType } from './types';

export interface PngPassInput {
  geometry: ScaledGeometry;
  color: string;
}

export async function renderHighResPNG(
  sizePx: number,
  paper: PaperType,
  passes: PngPassInput[],
  baseWidthMm: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context を取得できませんでした');

  drawPaperTexture(ctx, sizePx, sizePx, paper);

  const scale = sizePx / PAPER_SIZE_MM;
  for (const pass of passes) {
    const pxPoints = pass.geometry.points.map((p: TrajectoryPoint) => ({
      x: p.x * scale,
      y: p.y * scale,
    }));
    drawInkSegments(
      ctx,
      pxPoints,
      pass.geometry.normSpeeds,
      { color: pass.color, baseWidthMm },
      scale,
      0,
      pxPoints.length - 1,
    );
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG書き出しに失敗しました'));
    }, 'image/png');
  });
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
