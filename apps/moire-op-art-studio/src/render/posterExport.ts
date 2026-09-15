import { BLEND_LABELS, PATTERN_LABELS, type StudioState } from '../types';
import { fieldLabels } from '../layerPlan';
import { renderStudio } from './canvasRenderer';

const ART_SIZE = 1000;
const MARGIN = 70;
const RULE_GAP = 36;
const BAND_TOP_GAP = 34;
const LINE_HEIGHT = 30;
const RED = '#E10600';
const INK = '#111111';
const GREY = '#6B6B6B';

function specLine(layer: StudioState['layers'][number], index: number): string {
  const labels = fieldLabels(layer.type);
  // Keep in sync with canvasRenderer.ts: the base layer (index 0) always
  // composites Normal, so an override on it would never actually apply.
  const mode = index > 0 && layer.blendOverride ? layer.blendMode : undefined;
  const modeLabel = mode ? ` / ${BLEND_LABELS[mode]}*` : '';
  return (
    `L${String(index + 1).padStart(2, '0')} ${PATTERN_LABELS[layer.type]} — ` +
    `${labels.rotation} ${layer.rotation.toFixed(0)}° / ` +
    `${labels.spacing} ${layer.spacing.toFixed(0)}PX / ` +
    `${labels.thickness} ${layer.thickness.toFixed(1)}PX / ` +
    `OP ${(layer.opacity * 100).toFixed(0)}% / ${layer.color.toUpperCase()}${modeLabel}`
  );
}

function editionNumber(): string {
    const n = Math.floor(Math.random() * 90000) + 10000;
    return `ED. ${n}`;
}

function timestamp(): string {
  const d = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

/** Renders the current studio state into a museum wall-label style poster
 * frame (title, per-layer spec sheet, edition number, timestamp) at the
 * requested integer resolution multiplier, and returns a PNG Blob. */
export async function exportPosterPNG(state: StudioState, multiplier: number): Promise<Blob> {
  await document.fonts.ready;

  const bandHeight = 150 + state.layers.length * LINE_HEIGHT;
  const posterW = ART_SIZE + MARGIN * 2;
  const posterH = ART_SIZE + MARGIN + RULE_GAP + BAND_TOP_GAP + bandHeight + MARGIN;

  const canvas = document.createElement('canvas');
  canvas.width = posterW * multiplier;
  canvas.height = posterH * multiplier;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.scale(multiplier, multiplier);

  // paper
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, posterW, posterH);

  // art — clipped to the art square. Unlike the live preview (where the
  // canvas element's own physical bounds do this for free), here the art
  // shares a much larger canvas with the label band below it, and pattern
  // geometry (e.g. line fields) intentionally over-generates past its
  // nominal square to guarantee full coverage at any rotation. Without an
  // explicit clip that overflow bleeds straight across the caption text.
  ctx.save();
  ctx.translate(MARGIN, MARGIN);
  ctx.beginPath();
  ctx.rect(0, 0, ART_SIZE, ART_SIZE);
  ctx.clip();
  renderStudio(ctx, state, ART_SIZE);
  ctx.restore();

  ctx.save();
  ctx.translate(MARGIN, MARGIN);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, ART_SIZE - 1, ART_SIZE - 1);
  ctx.restore();

  // red accent rule
  const ruleY = MARGIN + ART_SIZE + RULE_GAP;
  ctx.fillStyle = RED;
  ctx.fillRect(MARGIN, ruleY, posterW - MARGIN * 2, 3);

  let y = ruleY + BAND_TOP_GAP;

  // title
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.font = '900 40px Inter, sans-serif';
  ctx.fillText('MOIRÉ / STUDY', MARGIN, y + 34);

  ctx.font = '700 14px Inter, sans-serif';
  ctx.fillStyle = GREY;
  ctx.fillText('KINETIC OP ART STUDIO — CATALOGUE No. OP-01', MARGIN, y + 58);

  y += 96;

  // spec sheet
  ctx.font = '500 16px Inter, monospace';
  ctx.fillStyle = INK;
  state.layers.forEach((layer, i) => {
    ctx.fillText(specLine(layer, i), MARGIN, y + i * LINE_HEIGHT);
  });
  const usesOverride = state.layers.some((l) => l.blendOverride);
  const globalLine = `GLOBAL BLEND: ${BLEND_LABELS[state.globalBlendMode]}${usesOverride ? '   (* = layer override)' : ''}`;
  ctx.font = '500 16px Inter, monospace';
  ctx.fillStyle = GREY;
  ctx.fillText(globalLine, MARGIN, y + state.layers.length * LINE_HEIGHT + 6);

  // edition + timestamp, bottom-right aligned
  const bottomY = posterH - MARGIN + 4;
  ctx.textAlign = 'right';
  ctx.font = '700 15px Inter, sans-serif';
  ctx.fillStyle = RED;
  ctx.fillText(editionNumber(), posterW - MARGIN, bottomY - 22);
  ctx.font = '400 13px Inter, sans-serif';
  ctx.fillStyle = GREY;
  ctx.fillText(timestamp(), posterW - MARGIN, bottomY);
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG encoding failed'));
    }, 'image/png');
  });
}
