import type { CrackSegment, GlazeId } from './types';
import { GLAZES } from './glaze';
import type { GlazeSpec } from './glaze';
import type { VesselSpec } from './vessels';
import { computeTransform } from './vessels';
import { drawVesselWithCracks, drawBackdrop } from './render';

export interface PosterMeta {
  vesselLabel: string;
  glazeLabel: string;
  crackCount: number;
  dateLabel: string;
}

const FONT_SERIF = '"Shippori Mincho", serif';
const FONT_SANS = '"Zen Kaku Gothic New", sans-serif';

/** Greedy character-wrap: Japanese text has no spaces to break on, so lines
 * are packed until the next character would overflow the available width. */
function wrapJapanese(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const ch of text) {
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const unit = Math.min(w, h);
  const outer = unit * 0.045;
  const inner = outer + unit * 0.012;

  ctx.save();
  ctx.strokeStyle = 'rgba(212,175,55,0.85)';
  ctx.shadowColor = 'rgba(212,175,55,0.55)';
  ctx.shadowBlur = unit * 0.006;
  ctx.lineWidth = Math.max(1, unit * 0.0016);
  ctx.strokeRect(outer, outer, w - outer * 2, h - outer * 2);

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(212,175,55,0.4)';
  ctx.lineWidth = Math.max(1, unit * 0.0009);
  ctx.strokeRect(inner, inner, w - inner * 2, h - inner * 2);

  const tick = unit * 0.035;
  ctx.strokeStyle = 'rgba(244,229,161,0.95)';
  ctx.lineWidth = Math.max(1.2, unit * 0.0022);
  const corners: Array<[number, number, number, number]> = [
    [outer, outer, 1, 1],
    [w - outer, outer, -1, 1],
    [outer, h - outer, 1, -1],
    [w - outer, h - outer, -1, -1],
  ];
  for (const corner of corners) {
    const [cx, cy, dx, dy] = corner;
    ctx.beginPath();
    ctx.moveTo(cx, cy + tick * dy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + tick * dx, cy);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws the full poster: backdrop, centered vessel with fully-mended gold
 * seams, a double gold hairline frame with corner ticks, and a museum
 * caption plate (quote + form/glaze/crack-count/date). Used identically for
 * the on-screen poster stage and the high-resolution PNG export, so what the
 * user sees is exactly what gets saved.
 */
export function renderPosterComposition(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  spec: VesselSpec,
  glazeId: GlazeId,
  segments: CrackSegment[],
  caption: string,
  meta: PosterMeta,
): void {
  const glaze: GlazeSpec = GLAZES[glazeId];
  drawBackdrop(ctx, w, h);

  const margin = h * 0.09;
  const vesselZoneH = h * 0.5;
  const vesselZoneTop = margin * 0.5;

  const fitted = computeTransform(w - margin, vesselZoneH, spec, 0.86);
  const vesselTransform = { cx: w / 2, cy: vesselZoneTop + vesselZoneH / 2, scale: fitted.scale };
  drawVesselWithCracks(ctx, spec, glaze, vesselTransform, segments, { fullyMended: true });

  const dividerY = vesselZoneTop + vesselZoneH + h * 0.025;
  ctx.save();
  ctx.strokeStyle = 'rgba(212,175,55,0.35)';
  ctx.lineWidth = Math.max(1, h * 0.0012);
  ctx.beginPath();
  ctx.moveTo(w * 0.14, dividerY);
  ctx.lineTo(w * 0.86, dividerY);
  ctx.stroke();
  ctx.restore();

  // Faint oversized "継" (mend/inherit) glyph as a background texture,
  // tying the caption zone back to the piece's theme without competing
  // with the readable caption text on top of it.
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#f4e5a1';
  ctx.font = `700 ${h * 0.22}px ${FONT_SERIF}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('継', w * 0.92, h * 0.98);
  ctx.restore();

  const captionTop = dividerY + h * 0.06;
  ctx.save();
  ctx.fillStyle = '#ece4d2';
  ctx.font = `${h * 0.026}px ${FONT_SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const lines = wrapJapanese(ctx, caption, w * 0.68);
  const lineHeight = h * 0.044;
  lines.forEach((line, i) => ctx.fillText(line, w / 2, captionTop + i * lineHeight));
  ctx.restore();

  const metaTop = captionTop + lines.length * lineHeight + h * 0.05;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const labelX = w * 0.17;
  const rows: Array<[string, string]> = [
    ['形', meta.vesselLabel],
    ['釉', meta.glazeLabel],
    ['亀裂', `${meta.crackCount}条`],
  ];
  const rowGap = h * 0.028;
  rows.forEach(([label, value], i) => {
    const y = metaTop + i * rowGap;
    ctx.font = `500 ${h * 0.014}px ${FONT_SANS}`;
    ctx.fillStyle = 'rgba(212,175,55,0.75)';
    ctx.fillText(label, labelX, y);
    ctx.font = `${h * 0.017}px ${FONT_SERIF}`;
    ctx.fillStyle = '#d8cfb8';
    ctx.fillText(value, labelX + w * 0.078, y);
  });
  ctx.font = `400 ${h * 0.013}px ${FONT_SANS}`;
  ctx.fillStyle = 'rgba(216,207,184,0.6)';
  ctx.textAlign = 'right';
  ctx.fillText(meta.dateLabel, w * 0.83, metaTop + (rows.length - 1) * rowGap + h * 0.005);
  ctx.restore();

  drawFrame(ctx, w, h);
}
