import type { EdgeStyle, LabelFields, LayoutId, LayoutMetrics, PosterSource } from '../types';
import { toLuminance } from './grayscale';
import { floydSteinberg } from './dither';
import { drawCoverFit } from './coverFit';
import { buildEdgeMask } from './edgeMask';
import { createMottleSampler, mottledAlpha } from './mottle';
import { applyVignette, applyPageAge } from './vignette';
import { getFiberTile } from './texture';
import { getInkPreset } from './presets';
import { drawLabel } from '../label/drawLabel';
import { drawSpecimen } from '../specimens';
import { type Ctx2D, clamp01, createCanvas, hexToRgb } from './ctx2d';

export interface RenderParams {
  source: PosterSource | null;
  seed: number;
  contrast: number;
  threshold: number;
  inkPresetId: string;
  mottle: number;
  grain: number;
  vignette: number;
  edgeStyle: EdgeStyle;
  layout: LayoutId;
  label: LabelFields;
}

export function getLayoutMetrics(layout: LayoutId, width: number, height: number): LayoutMetrics {
  const isSquare = layout === 'square';
  const marginX = width * (isSquare ? 0.078 : 0.088);
  const marginTop = width * 0.078;
  const labelBandHeight = height * (isSquare ? 0.205 : 0.255);
  const bottomMargin = height * 0.05;
  const imageX = marginX;
  const imageY = marginTop;
  const imageW = width - marginX * 2;
  const imageH = height - imageY - labelBandHeight - bottomMargin;
  return { width, height, marginX, marginTop, labelBandHeight, imageX, imageY, imageW, imageH };
}

/**
 * 台紙一枚を組む（FR-2xx〜FR-4xx）。
 * 紙色の地 → 感光域（二階調のインク版） → 紙の繊維 → 経年 → ラベル帯。
 */
export function renderPoster(ctx: Ctx2D, width: number, height: number, params: RenderParams): void {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  ctx.canvas.width = w;
  ctx.canvas.height = h;

  const preset = getInkPreset(params.inkPresetId);
  const metrics = getLayoutMetrics(params.layout, w, h);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = preset.paper;
  ctx.fillRect(0, 0, w, h);

  if (params.source) {
    renderImagePlate(ctx, metrics, preset.ink, params);
  }

  const pattern = ctx.createPattern(getFiberTile(params.seed), 'repeat');
  if (pattern) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = clamp01(params.grain / 100) * 0.85;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  applyPageAge(ctx, w, h, preset.ink);

  const gap = h * 0.018;
  drawLabel(
    ctx,
    {
      x: metrics.imageX,
      y: metrics.imageY + metrics.imageH + gap,
      width: metrics.imageW,
      height: metrics.labelBandHeight - gap,
    },
    preset.ink,
    params.label,
  );
}

/**
 * 図案ソースを感光域の階調へ落とす（FR-101）。
 *
 * アップロードは cover 配置、所蔵標本は**この寸法で直接描く**。
 * 低解像度で描いてから拡大すると、3× 書き出しで輪郭がぼける（FR-123）。
 */
function paintSourceTones(ctx: Ctx2D, source: PosterSource, seed: number, width: number, height: number): boolean {
  if (source.kind === 'upload') {
    drawCoverFit(ctx, source.image, width, height);
    return true;
  }
  return drawSpecimen(ctx, source.specimenId, seed, width, height);
}

function renderImagePlate(ctx: Ctx2D, metrics: LayoutMetrics, inkColor: string, params: RenderParams): void {
  const source = params.source;
  if (!source) return;

  const imageW = Math.max(1, Math.round(metrics.imageW));
  const imageH = Math.max(1, Math.round(metrics.imageH));

  const { ctx: sourceCtx } = createCanvas(imageW, imageH);
  if (!paintSourceTones(sourceCtx, source, params.seed, imageW, imageH)) return;

  const imageData = sourceCtx.getImageData(0, 0, imageW, imageH);
  const luminance = toLuminance(imageData, params.contrast);
  const bits = floydSteinberg(luminance, imageW, imageH, params.threshold);

  const { canvas: maskCanvas, pad } = buildEdgeMask(imageW, imageH, params.edgeStyle, params.seed);
  const layerW = imageW + pad * 2;
  const layerH = imageH + pad * 2;

  const sampleMottle = createMottleSampler(params.seed);
  const mottleStrength = clamp01(params.mottle / 100);
  const ink = hexToRgb(inkColor);

  const { canvas: inkCanvas, ctx: inkCtx } = createCanvas(layerW, layerH);
  const layer = inkCtx.createImageData(layerW, layerH);
  const data = layer.data;

  for (let y = 0; y < imageH; y++) {
    const ny = y / imageH;
    const rowOffset = y * imageW;
    for (let x = 0; x < imageW; x++) {
      if (bits[rowOffset + x] !== 1) continue;
      const alpha = mottledAlpha(sampleMottle(x / imageW, ny), mottleStrength);
      const idx = ((y + pad) * layerW + (x + pad)) * 4;
      data[idx] = ink.r;
      data[idx + 1] = ink.g;
      data[idx + 2] = ink.b;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }

  inkCtx.putImageData(layer, 0, 0);
  inkCtx.globalCompositeOperation = 'destination-in';
  inkCtx.drawImage(maskCanvas, 0, 0);
  inkCtx.globalCompositeOperation = 'source-over';

  ctx.drawImage(inkCanvas, metrics.imageX - pad, metrics.imageY - pad);

  applyVignette(
    ctx,
    metrics.imageX,
    metrics.imageY,
    metrics.imageW,
    metrics.imageH,
    inkColor,
    clamp01(params.vignette / 100),
  );
}
