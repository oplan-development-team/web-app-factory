import { NEUTRAL_EXPOSURE, toLuminance } from './grayscale';
import { floydSteinberg } from './dither';
import { drawSpecimen } from '../specimens';
import { createCanvas, hexToRgb, type Ctx2D } from './ctx2d';
import type { InkPreset } from '../types';

/**
 * 図案帳のサムネイル（FR-124）。
 *
 * アイコンや静的画像ではなく、本番と同じ生成器＋同じ誤差拡散を通した
 * 小さなサイアノタイプを描く。サムネイルが製品そのものの縮小であることが、
 * 「選ぶ前に何が出るか分かる」という体験の前提になっている。
 */
export function renderSpecimenSwatch(
  ctx: Ctx2D,
  specimenId: string,
  seed: number,
  width: number,
  height: number,
  preset: InkPreset,
  threshold = 128,
  contrast = 20,
): boolean {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  ctx.canvas.width = w;
  ctx.canvas.height = h;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = preset.paper;
  ctx.fillRect(0, 0, w, h);

  const { ctx: sourceCtx } = createCanvas(w, h);
  if (!drawSpecimen(sourceCtx, specimenId, seed, w, h)) return false;

  const luminance = toLuminance(sourceCtx.getImageData(0, 0, w, h), contrast, threshold);
  const bits = floydSteinberg(luminance, w, h, NEUTRAL_EXPOSURE);

  const { canvas: inkCanvas, ctx: inkCtx } = createCanvas(w, h);
  const layer = inkCtx.createImageData(w, h);
  const data = layer.data;
  const ink = hexToRgb(preset.ink);

  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== 1) continue;
    const idx = i * 4;
    data[idx] = ink.r;
    data[idx + 1] = ink.g;
    data[idx + 2] = ink.b;
    data[idx + 3] = 255;
  }

  inkCtx.putImageData(layer, 0, 0);
  ctx.drawImage(inkCanvas, 0, 0);
  return true;
}
