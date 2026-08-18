import { drawGrid, outputSubSize } from './render';
import { EXPORT_PRESETS, MAX_EXPORT_PX, type ExportPreset } from './types';

/** クワイエットゾーン込みの出力 1 辺（ピクセル） */
export function outputPixels(moduleCount: number, pxPerSub: number): number {
  return outputSubSize(moduleCount) * pxPerSub;
}

export function presetPixels(moduleCount: number, preset: ExportPreset): number {
  return outputPixels(moduleCount, EXPORT_PRESETS[preset].pxPerSub);
}

/** 上限 8192px を超える組み合わせは選ばせない（SPEC FR-009.7） */
export function isPresetAvailable(moduleCount: number, preset: ExportPreset): boolean {
  return presetPixels(moduleCount, preset) <= MAX_EXPORT_PX;
}

export function availablePresets(moduleCount: number): ExportPreset[] {
  return (Object.keys(EXPORT_PRESETS) as ExportPreset[]).filter((preset) =>
    isPresetAvailable(moduleCount, preset),
  );
}

/**
 * 選択中のプリセットが上限を超える場合に、収まる最大のプリセットへ落とす。
 * 型番が大きいテキストへ切り替えた瞬間に書き出しが不能になるのを避ける。
 */
export function resolvePreset(moduleCount: number, preset: ExportPreset): ExportPreset {
  if (isPresetAvailable(moduleCount, preset)) return preset;
  const available = availablePresets(moduleCount);
  return available.length > 0 ? available[available.length - 1] : 'standard';
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function exportFileName(now: Date = new Date()): string {
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `halftone-qr-${stamp}.png`;
}

export function formatDimensions(pixels: number): string {
  return `${pixels} × ${pixels} px`;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG を生成できませんでした'));
    }, 'image/png');
  });
}

/** ハーフトーン QR を PNG としてダウンロードする（SPEC FR-009） */
export async function downloadPng(
  grid: Uint8Array,
  moduleCount: number,
  preset: ExportPreset,
): Promise<void> {
  const resolved = resolvePreset(moduleCount, preset);
  const canvas = document.createElement('canvas');
  drawGrid(canvas, grid, moduleCount, EXPORT_PRESETS[resolved].pxPerSub);

  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFileName();
    anchor.rel = 'noopener';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // クリック直後の revoke はダウンロードを取りこぼすことがあるため次のタスクで解放する
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
