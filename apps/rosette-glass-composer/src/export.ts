import type { PlacedPoint, RoseSegments, Settings, TemplateKind, ViewMode } from './types.ts';
import { buildTemplate } from './templates.ts';
import { buildGridMask, buildCellBoundaryPath, computeField, gridSizeFor } from './glass/field.ts';
import { renderWindow } from './glass/render.ts';

const EXPORT_SCALE = 2.2;

export function exportPng(
  template: TemplateKind,
  roseSegments: RoseSegments,
  baseW: number,
  baseH: number,
  points: PlacedPoint[],
  settings: Settings,
  mode: ViewMode,
): Promise<Blob> {
  const w = Math.round(baseW * EXPORT_SCALE);
  const h = Math.round(baseH * EXPORT_SCALE);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const geom = buildTemplate(template, roseSegments, w, h);
  const { gridW, gridH } = gridSizeFor(w, h, 3);
  const mask = buildGridMask(geom, w, h, gridW, gridH);

  // Points are stored in base-canvas coordinates; scale to export resolution.
  const scaledPoints: PlacedPoint[] = points.map((p) => ({
    ...p,
    x: (p.x / baseW) * w,
    y: (p.y / baseH) * h,
  }));

  const field = computeField(scaledPoints, geom, mask, w, h, settings.irregularity, 1);
  const cellBoundaryPath = buildCellBoundaryPath(field, w, h);

  renderWindow({
    ctx,
    canvasW: w,
    canvasH: h,
    geom,
    field,
    cellBoundaryPath,
    points: scaledPoints,
    settings: { ...settings, leadThickness: settings.leadThickness * EXPORT_SCALE },
    mode,
  });

  return new Promise((resolve, reject) => {
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
