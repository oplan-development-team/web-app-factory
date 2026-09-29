import type { InkLayer } from '../ink/layer';
import type { ScaleName } from '../types';
import { computeLayout, type Layout } from './layout';
import { formatDate, formatDuration } from './format';

export const COLOR_PAPER = '#f3eee2';
export const COLOR_INK = '#14120f';
export const COLOR_SIGNAL = '#e4362c';
const RULE = 'rgba(20,18,15,0.9)';
const GUIDE = 'rgba(20,18,15,0.22)';
const FAINT = 'rgba(20,18,15,0.65)';

export interface PosterParams {
  title: string;
  catalogNumber: string;
  createdAt: Date;
  durationSec: number;
  scale: ScaleName;
  inkLayer: InkLayer;
}

function drawCropMarks(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const { border, cropMarkLen: len, cropMarkGap: gap } = layout;
  ctx.save();
  ctx.strokeStyle = COLOR_INK;
  ctx.lineWidth = 1;
  const corners: [number, number, 1 | -1, 1 | -1][] = [
    [border.x, border.y, -1, -1],
    [border.x + border.w, border.y, 1, -1],
    [border.x, border.y + border.h, -1, 1],
    [border.x + border.w, border.y + border.h, 1, 1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * gap);
    ctx.lineTo(cx, cy + dy * (gap + len));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + dx * gap, cy);
    ctx.lineTo(cx + dx * (gap + len), cy);
    ctx.stroke();
  }
  ctx.restore();
}

function trackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: 'left' | 'right' | 'center' = 'left',
): void {
  const chars = text.split('');
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);
  let cursor = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cursor, y);
    cursor += widths[i] + tracking;
  }
  ctx.textAlign = prevAlign;
}

function wrapTitle(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

function drawLegendSwatch(ctx: CanvasRenderingContext2D, kind: 'pitch' | 'volume' | 'timbre', x: number, y: number): void {
  const w = 96;
  const h = 34;
  ctx.save();
  ctx.strokeStyle = COLOR_INK;
  ctx.fillStyle = COLOR_INK;
  ctx.lineWidth = 1.4;
  if (kind === 'pitch') {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const r = 3 + i * 2.4;
      const cy = y + h - (h / 2) * i;
      ctx.beginPath();
      ctx.arc(x + 14 + i * 26, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'volume') {
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2 - 1);
    ctx.lineTo(x + w, y + h / 2 - 10);
    ctx.lineTo(x + w, y + h / 2 + 10);
    ctx.closePath();
    ctx.fill();
  } else {
    const boxes: [number, 'sine' | 'triangle' | 'saw'][] = [
      [0, 'sine'],
      [1, 'triangle'],
      [2, 'saw'],
    ];
    for (const [i] of boxes) {
      const bx = x + i * 34;
      ctx.strokeRect(bx, y + h / 2 - 12, 24, 24);
      const density = 0.25 + i * 0.4;
      const step = 4;
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, y + h / 2 - 12, 24, 24);
      ctx.clip();
      ctx.globalAlpha = density;
      for (let ly = 0; ly < 24; ly += step) {
        ctx.beginPath();
        ctx.moveTo(bx, y + h / 2 - 12 + ly);
        ctx.lineTo(bx + 24, y + h / 2 - 12 + ly);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

/**
 * Draws the entire poster sheet — border, crop marks, title block, pitch
 * guides, the ink composite, the legend table and the footer imprint — onto
 * a single canvas. Used for on-screen display AND for PNG export (at a
 * higher `ctx` scale) so preview and export are guaranteed to match.
 */
export function renderPoster(ctx: CanvasRenderingContext2D, params: PosterParams): Layout {
  const layout = computeLayout();
  const { posterW, posterH, border, content, ink } = layout;

  ctx.save();
  ctx.fillStyle = COLOR_PAPER;
  ctx.fillRect(0, 0, posterW, posterH);

  drawCropMarks(ctx, layout);

  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.strokeRect(border.x + 0.5, border.y + 0.5, border.w, border.h);

  // -- header ------------------------------------------------------
  ctx.fillStyle = COLOR_INK;
  ctx.font = '600 13px "IBM Plex Mono", monospace';
  ctx.textBaseline = 'alphabetic';
  trackedText(
    ctx,
    'GRAPHIC SCORE — GRAPHISCHE PARTITUR — PARTITION GRAPHIQUE',
    content.x,
    content.y + 14,
    1.5,
  );

  ctx.font = '800 56px Inter, sans-serif';
  const titleLines = wrapTitle(ctx, params.title.toUpperCase(), layout.titleBox.w);
  titleLines.forEach((line, i) => {
    trackedText(ctx, line, layout.titleBox.x, layout.titleBox.y + 50 + i * 62, 1.2);
  });

  ctx.font = '500 12px "IBM Plex Mono", monospace';
  ctx.fillStyle = FAINT;
  trackedText(ctx, 'CATALOGUE NO.', layout.catalogBox.x + layout.catalogBox.w, layout.catalogBox.y + 14, 1.5, 'right');
  ctx.fillStyle = COLOR_INK;
  ctx.font = '600 30px "IBM Plex Mono", monospace';
  trackedText(ctx, params.catalogNumber, layout.catalogBox.x + layout.catalogBox.w, layout.catalogBox.y + 50, 0.5, 'right');
  ctx.font = '500 12px "IBM Plex Mono", monospace';
  ctx.fillStyle = FAINT;
  trackedText(ctx, 'EDITION WEB AUDIO', layout.catalogBox.x + layout.catalogBox.w, layout.catalogBox.y + 74, 1.2, 'right');

  ctx.strokeStyle = RULE;
  ctx.beginPath();
  ctx.moveTo(content.x, layout.header.y + layout.header.h);
  ctx.lineTo(content.x + content.w, layout.header.y + layout.header.h);
  ctx.stroke();

  // -- performance instruction -------------------------------------
  ctx.font = '500 13px "IBM Plex Mono", monospace';
  ctx.fillStyle = COLOR_INK;
  const scaleLabel = params.scale === 'pentatonic' ? 'PENTATONIC' : 'WHOLE-TONE';
  trackedText(
    ctx,
    `PERFORM LEFT → RIGHT AT CONSTANT VELOCITY · DURATION ${formatDuration(params.durationSec)} · SCALE ${scaleLabel}`,
    content.x,
    layout.instructionY,
    0.8,
  );

  // -- ink / score area ----------------------------------------------
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.strokeRect(ink.x + 0.5, ink.y + 0.5, ink.w, ink.h);

  // pitch reference guides (register bands)
  ctx.strokeStyle = GUIDE;
  ctx.beginPath();
  ctx.moveTo(ink.x, ink.y + ink.h / 3);
  ctx.lineTo(ink.x + ink.w, ink.y + ink.h / 3);
  ctx.moveTo(ink.x, ink.y + (ink.h * 2) / 3);
  ctx.lineTo(ink.x + ink.w, ink.y + (ink.h * 2) / 3);
  ctx.stroke();

  ctx.font = '600 11px "IBM Plex Mono", monospace';
  ctx.fillStyle = FAINT;
  const bandLabels: [string, number][] = [
    ['HIGH', ink.y + ink.h / 6],
    ['MID', ink.y + ink.h / 2],
    ['LOW', ink.y + (ink.h * 5) / 6],
  ];
  for (const [label, y] of bandLabels) {
    ctx.save();
    ctx.translate(layout.bandLabelX + 10, y);
    trackedText(ctx, label, 0, 4, 1.5, 'left');
    ctx.restore();
  }

  ctx.drawImage(params.inkLayer.getComposite(), ink.x, ink.y, ink.w, ink.h);

  // -- meta row below score -----------------------------------------
  ctx.strokeStyle = RULE;
  ctx.beginPath();
  ctx.moveTo(content.x, layout.metaY - 22);
  ctx.lineTo(content.x + content.w, layout.metaY - 22);
  ctx.stroke();

  ctx.font = '500 13px "IBM Plex Mono", monospace';
  ctx.fillStyle = COLOR_INK;
  const col = content.w / 3;
  trackedText(ctx, `DURATION ${formatDuration(params.durationSec)}`, content.x, layout.metaY, 0.6);
  trackedText(ctx, `GENERATED ${formatDate(params.createdAt)}`, content.x + col, layout.metaY, 0.6);
  trackedText(ctx, `VOICES ≤ 6 · OSC ONLY`, content.x + col * 2, layout.metaY, 0.6);

  // -- legend ----------------------------------------------------------
  ctx.font = '700 13px Inter, sans-serif';
  trackedText(ctx, 'LEGEND', content.x, layout.legendHeaderY, 2);
  ctx.strokeStyle = RULE;
  ctx.beginPath();
  ctx.moveTo(content.x, layout.legendHeaderY + 12);
  ctx.lineTo(content.x + content.w, layout.legendHeaderY + 12);
  ctx.stroke();

  const legendRows: { kind: 'pitch' | 'volume' | 'timbre'; label: string; desc: string }[] = [
    { kind: 'pitch', label: 'VERTICAL POSITION', desc: `→ PITCH (3 OCT, ${scaleLabel} QUANTIZED)` },
    { kind: 'volume', label: 'STROKE WEIGHT', desc: '→ DYNAMIC (VOLUME)' },
    { kind: 'timbre', label: 'INK DENSITY', desc: '→ TIMBRE: SINE · TRIANGLE · SAWTOOTH' },
  ];
  legendRows.forEach((row, i) => {
    const y = layout.legend.y + i * layout.legendRowH;
    drawLegendSwatch(ctx, row.kind, content.x, y);
    ctx.font = '700 14px Inter, sans-serif';
    ctx.fillStyle = COLOR_INK;
    trackedText(ctx, row.label, content.x + 190, y + 20, 0.6);
    ctx.font = '500 13px "IBM Plex Mono", monospace';
    ctx.fillStyle = FAINT;
    trackedText(ctx, row.desc, content.x + 190, y + 38, 0.3);
    if (i < legendRows.length - 1) {
      ctx.strokeStyle = 'rgba(20,18,15,0.12)';
      ctx.beginPath();
      ctx.moveTo(content.x, y + layout.legendRowH - 10);
      ctx.lineTo(content.x + content.w, y + layout.legendRowH - 10);
      ctx.stroke();
    }
  });

  // -- footer imprint ---------------------------------------------------
  ctx.strokeStyle = RULE;
  ctx.beginPath();
  ctx.moveTo(content.x, layout.footerY - 20);
  ctx.lineTo(content.x + content.w, layout.footerY - 20);
  ctx.stroke();

  ctx.font = '500 11px "IBM Plex Mono", monospace';
  ctx.fillStyle = FAINT;
  trackedText(ctx, `PLATE ${params.catalogNumber}`, content.x, layout.footerY, 1);
  trackedText(
    ctx,
    'OSCILLATOR SYNTHESIS ONLY — NO SAMPLES — GRAPHIC SCORE STUDIO',
    content.x + content.w,
    layout.footerY,
    1,
    'right',
  );

  ctx.restore();
  return layout;
}
