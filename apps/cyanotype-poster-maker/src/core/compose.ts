import type { EdgeStyle, LabelFields, LayoutId, LayoutMetrics } from '../types';
import { toLuminance } from './grayscale';
import { floydSteinberg } from './dither';
import { drawCoverFit } from './coverFit';
import { buildEdgeMask } from './edgeMask';
import { createMottleSampler } from './mottle';
import { applyVignette, applyPageAge } from './vignette';
import { generateFiberTextureTile } from './texture';
import { getInkPreset } from './presets';
import { drawLabel } from '../label/drawLabel';

export interface RenderParams {
  source: HTMLImageElement | null;
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

const fiberTileCache = new Map<number, HTMLCanvasElement>();

function getFiberTile(seed: number): HTMLCanvasElement {
  let tile = fiberTileCache.get(seed);
  if (!tile) {
    tile = generateFiberTextureTile(seed);
    fiberTileCache.set(seed, tile);
  }
  return tile;
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

/** Full render pipeline: paper base, dithered ink plate, texture, label. */
export function renderPoster(canvas: HTMLCanvasElement, width: number, height: number, params: RenderParams): void {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const preset = getInkPreset(params.inkPresetId);
  const metrics = getLayoutMetrics(params.layout, w, h);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = preset.paper;
  ctx.fillRect(0, 0, w, h);

  if (params.source) {
    renderImagePlate(ctx, metrics, preset.ink, params);
  }

  const tile = getFiberTile(params.seed);
  const pattern = ctx.createPattern(tile, 'repeat');
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

function renderImagePlate(ctx: CanvasRenderingContext2D, metrics: LayoutMetrics, inkColor: string, params: RenderParams): void {
  if (!params.source) return;
  const imageW = Math.max(1, Math.round(metrics.imageW));
  const imageH = Math.max(1, Math.round(metrics.imageH));

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = imageW;
  sourceCanvas.height = imageH;
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) return;
  drawCoverFit(sourceCtx, params.source, imageW, imageH);

  const imageData = sourceCtx.getImageData(0, 0, imageW, imageH);
  const luminance = toLuminance(imageData, params.contrast);
  const bits = floydSteinberg(luminance, imageW, imageH, params.threshold);

  const { canvas: maskCanvas, pad } = buildEdgeMask(imageW, imageH, params.edgeStyle, params.seed);
  const layerW = imageW + pad * 2;
  const layerH = imageH + pad * 2;

  const mottleSampler = createMottleSampler(params.seed);
  const mottleStrength = clamp01(params.mottle / 100);
  const inkRgb = hexToRgb(inkColor);

  const layerData = new ImageData(layerW, layerH);
  for (let y = 0; y < imageH; y++) {
    const ny = y / imageH;
    const rowOffset = y * imageW;
    for (let x = 0; x < imageW; x++) {
      if (bits[rowOffset + x] !== 1) continue;
      const nx = x / imageW;
      const mottleValue = mottleSampler(nx, ny);
      const alpha = clamp01(1 - mottleStrength * (1 - mottleValue) * 0.62);
      const px = x + pad;
      const py = y + pad;
      const idx = (py * layerW + px) * 4;
      layerData.data[idx] = inkRgb.r;
      layerData.data[idx + 1] = inkRgb.g;
      layerData.data[idx + 2] = inkRgb.b;
      layerData.data[idx + 3] = Math.round(alpha * 255);
    }
  }

  const inkLayerCanvas = document.createElement('canvas');
  inkLayerCanvas.width = layerW;
  inkLayerCanvas.height = layerH;
  const inkLayerCtx = inkLayerCanvas.getContext('2d');
  if (!inkLayerCtx) return;
  inkLayerCtx.putImageData(layerData, 0, 0);
  inkLayerCtx.globalCompositeOperation = 'destination-in';
  inkLayerCtx.drawImage(maskCanvas, 0, 0);
  inkLayerCtx.globalCompositeOperation = 'source-over';

  ctx.drawImage(inkLayerCanvas, metrics.imageX - pad, metrics.imageY - pad);

  applyVignette(ctx, metrics.imageX, metrics.imageY, metrics.imageW, metrics.imageH, inkColor, clamp01(params.vignette / 100));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}
