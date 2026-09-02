import type { RatioPreset, Stone, Streamline } from './types';
import { renderGarden, makeLineSeed } from './renderer';
import { paintWashiBackground } from './washiTexture';

const SCALE = 2;

export interface PosterExportOptions {
  preset: RatioPreset;
  stones: Stone[];
  streamlines: Streamline[];
}

function drawStamp(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((Math.random() - 0.5) * 0.03);
  const r = size * 0.14;
  ctx.beginPath();
  ctx.moveTo(-size / 2 + r, -size / 2);
  ctx.arcTo(size / 2, -size / 2, size / 2, size / 2, r);
  ctx.arcTo(size / 2, size / 2, -size / 2, size / 2, r);
  ctx.arcTo(-size / 2, size / 2, -size / 2, -size / 2, r);
  ctx.arcTo(-size / 2, -size / 2, size / 2, -size / 2, r);
  ctx.closePath();
  ctx.fillStyle = '#b3392c';
  ctx.globalAlpha = 0.92;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(244, 237, 224, 0.94)';
  ctx.font = `500 ${Math.round(size * 0.52)}px "Shippori Mincho", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('庭', 0, size * 0.03);
  ctx.restore();
}

export async function buildPosterCanvas(opts: PosterExportOptions): Promise<HTMLCanvasElement> {
  await document.fonts.ready;

  const { preset, stones, streamlines } = opts;
  const gw = preset.width * SCALE;
  const gh = preset.height * SCALE;

  const marginSide = Math.round(gw * 0.07);
  const marginTop = Math.round(gh * 0.15);
  const marginBottom = Math.round(gh * 0.18);

  const posterW = gw + marginSide * 2;
  const posterH = gh + marginTop + marginBottom;

  const poster = document.createElement('canvas');
  poster.width = posterW;
  poster.height = posterH;
  const pctx = poster.getContext('2d');
  if (!pctx) throw new Error('canvas 2d context unavailable');

  paintWashiBackground(pctx, posterW, posterH);

  // garden artwork, rendered at 2x internal resolution for crispness
  const garden = document.createElement('canvas');
  garden.width = gw;
  garden.height = gh;
  const gctx = garden.getContext('2d');
  if (!gctx) throw new Error('canvas 2d context unavailable');
  gctx.scale(SCALE, SCALE);
  renderGarden(gctx, {
    width: preset.width,
    height: preset.height,
    stones,
    streamlines,
    selectedStoneId: null,
    lineSeed: makeLineSeed(Math.max(1, streamlines.length)),
  });

  pctx.drawImage(garden, marginSide, marginTop);

  // hairline frame around the artwork, mimicking a mounted print edge
  pctx.save();
  pctx.strokeStyle = 'rgba(43, 38, 30, 0.5)';
  pctx.lineWidth = 1.5;
  pctx.strokeRect(marginSide + 0.75, marginTop + 0.75, gw - 1.5, gh - 1.5);
  pctx.restore();

  // title
  pctx.save();
  pctx.fillStyle = '#2b2620';
  pctx.font = `500 ${Math.round(gh * 0.042)}px "Shippori Mincho", serif`;
  pctx.textBaseline = 'alphabetic';
  pctx.textAlign = 'left';
  const titleY = marginTop * 0.62;
  // manual letter-spacing since canvas fillText has none
  const title = '枯 山 水';
  pctx.fillText(title, marginSide, titleY);

  pctx.font = `300 ${Math.round(gh * 0.02)}px "Zen Kaku Gothic New", sans-serif`;
  pctx.fillStyle = '#7a7062';
  pctx.fillText('KARESANSUI COMPOSER', marginSide, titleY + gh * 0.032);
  pctx.restore();

  // dimension caption, bottom-left, gallery plate style
  pctx.save();
  pctx.fillStyle = '#7a7062';
  pctx.font = `300 ${Math.round(gh * 0.017)}px "Zen Kaku Gothic New", sans-serif`;
  pctx.textAlign = 'left';
  const capY = marginTop + gh + marginBottom * 0.42;
  pctx.fillText(preset.captionLabel, marginSide, capY);
  pctx.fillText(`石　${stones.length} 個`, marginSide, capY + gh * 0.026);
  pctx.restore();

  // stamp, bottom-right
  drawStamp(pctx, posterW - marginSide - gh * 0.028, marginTop + gh + marginBottom * 0.4, gh * 0.05);

  return poster;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNGの生成に失敗しました'));
    }, 'image/png');
  });
}
