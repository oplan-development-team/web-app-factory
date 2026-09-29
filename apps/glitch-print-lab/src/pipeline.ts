import { applyJpegByteCorruption } from './glitch/jpegCorrupt.ts';
import { applyRowShift } from './glitch/rowShift.ts';
import { applyChannelShift } from './glitch/channelShift.ts';
import { applyScanlineReplace } from './glitch/scanlineReplace.ts';

export interface LayerState {
  jpegCorrupt: { enabled: boolean; rate: number; blockSize: number };
  rowShift: { enabled: boolean; maxShift: number; bandHeight: number; mode: 'random' | 'wave' };
  channelShift: { enabled: boolean; maxOffset: number };
  scanline: { enabled: boolean; density: number; mode: 'noise' | 'duplicate' };
}

export interface PipelineResult {
  canvas: HTMLCanvasElement;
  error: string | null;
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = source.width;
  c.height = source.height;
  const ctx = c.getContext('2d');
  if (ctx) ctx.drawImage(source, 0, 0);
  return c;
}

/**
 * Runs the fixed four-layer glitch stack in order:
 * 1. JPEG byte corruption (real binary corruption, async, can fail)
 * 2. Row pixel shift
 * 3. Channel separation / chromatic aberration
 * 4. Scanline replace
 *
 * Layers 2-4 operate on ImageData and cannot themselves fail; only layer 1
 * (a genuine re-decode of a corrupted bitstream) can produce a real error.
 *
 * `blockSizeScale` (default 1) lets the caller compensate CORRUPTION BLOCK
 * SIZE for the resolution actually being processed. Empirically, re-decode
 * survival depends mainly on the *number* of independent random corruption
 * hits, not on the % of bytes touched — and that count grows with the
 * JPEG's entropy-coded scan length, which scales with pixel count. Export
 * re-runs the pipeline against the full-resolution source (often 4x+ more
 * pixels than the live preview), so without compensation the exact same
 * slider values that looked fine in preview would fail to re-decode far
 * more often at export time. Scaling blockSize by the same pixel-count
 * ratio keeps the corruption hit-count — and thus the failure risk — in
 * the same ballpark at both resolutions.
 */
export async function runGlitchPipeline(
  source: HTMLCanvasElement,
  layers: LayerState,
  seed: number,
  blockSizeScale = 1,
): Promise<PipelineResult> {
  const scaledBlockSize = Math.max(1, Math.round(layers.jpegCorrupt.blockSize * blockSizeScale));
  const step1 = await applyJpegByteCorruption(cloneCanvas(source), {
    enabled: layers.jpegCorrupt.enabled,
    rate: layers.jpegCorrupt.rate,
    blockSize: scaledBlockSize,
    seed,
  });

  if (step1.error) {
    return { canvas: source, error: step1.error };
  }

  const canvas = step1.canvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { canvas: source, error: 'Canvas 2Dコンテキストを取得できませんでした。' };
  }

  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  imageData = applyRowShift(imageData, { ...layers.rowShift, seed });
  imageData = applyChannelShift(imageData, { ...layers.channelShift, seed });
  imageData = applyScanlineReplace(imageData, { ...layers.scanline, seed });

  ctx.putImageData(imageData, 0, 0);

  return { canvas, error: null };
}
