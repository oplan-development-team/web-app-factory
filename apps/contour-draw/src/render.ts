import type { ColorPreset, ContourPolyline, Point, PosterState } from './types.ts';
import type { PosterLayout, Rect } from './layout.ts';
import { elevationOf, layoutIndexPolyline } from './contourLayout.ts';

function toPixel(pt: Point, drawArea: Rect): Point {
  return { x: drawArea.x + pt.x * drawArea.w, y: drawArea.y + pt.y * drawArea.h };
}

/** Draws text with manual letter-spacing (canvas has no native tracking support). */
export function drawTrackedText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, trackingPx: number): void {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + trackingPx * Math.max(0, chars.length - 1);
  let x = cx - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i]!, x, y);
    x += widths[i]! + trackingPx;
  }
  ctx.textAlign = prevAlign;
}

function drawBackground(ctx: CanvasRenderingContext2D, layout: PosterLayout, preset: ColorPreset): void {
  const { W, H } = layout;
  const grad = ctx.createRadialGradient(W / 2, H * 0.4, H * 0.08, W / 2, H * 0.52, Math.max(W, H) * 0.78);
  grad.addColorStop(0, preset.bg);
  grad.addColorStop(1, preset.bgVignette);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawFrame(ctx: CanvasRenderingContext2D, layout: PosterLayout, preset: ColorPreset): void {
  const { frame, unit } = layout;
  ctx.strokeStyle = preset.frame;
  ctx.lineWidth = Math.max(1, unit * 0.0016);
  ctx.strokeRect(frame.x, frame.y, frame.w, frame.h);

  const tick = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const cs = unit * 0.014;
  const corners = [
    { x: frame.x, y: frame.y },
    { x: frame.x + frame.w, y: frame.y },
    { x: frame.x, y: frame.y + frame.h },
    { x: frame.x + frame.w, y: frame.y + frame.h },
  ];
  for (const c of corners) {
    tick(c.x - cs, c.y, c.x + cs, c.y);
    tick(c.x, c.y - cs, c.x, c.y + cs);
  }

  const tickLen = unit * 0.009;
  const tickLenLong = unit * 0.017;
  const steps = 24;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const len = i % 4 === 0 ? tickLenLong : tickLen;
    const xt = frame.x + frame.w * t;
    tick(xt, frame.y, xt, frame.y + len);
    tick(xt, frame.y + frame.h, xt, frame.y + frame.h - len);
    const yt = frame.y + frame.h * t;
    tick(frame.x, yt, frame.x + len, yt);
    tick(frame.x + frame.w, yt, frame.x + frame.w - len, yt);
  }
}

function drawHeaderText(ctx: CanvasRenderingContext2D, layout: PosterLayout, preset: ColorPreset, state: PosterState): void {
  const { headerRect, unit } = layout;
  const cx = headerRect.x + headerRect.w / 2;

  if (state.showTitle && state.title.trim()) {
    const fontSize = headerRect.h * 0.4;
    ctx.fillStyle = preset.text;
    ctx.font = `500 ${fontSize}px "Cormorant", serif`;
    ctx.textBaseline = 'alphabetic';
    drawTrackedText(ctx, state.title.toUpperCase(), cx, headerRect.y + headerRect.h * 0.56, fontSize * 0.16);
  }

  if (state.showSubtitle && state.subtitle.trim()) {
    const fontSize = headerRect.h * 0.14;
    ctx.fillStyle = preset.textMuted;
    ctx.font = `${fontSize}px "IBM Plex Mono", monospace`;
    ctx.textBaseline = 'alphabetic';
    drawTrackedText(ctx, state.subtitle.toUpperCase(), cx, headerRect.y + headerRect.h * 0.86, fontSize * 0.22);
  }

  ctx.strokeStyle = preset.frame;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, unit * 0.001);
  ctx.beginPath();
  ctx.moveTo(headerRect.x, headerRect.y + headerRect.h * 0.98);
  ctx.lineTo(headerRect.x + headerRect.w, headerRect.y + headerRect.h * 0.98);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawScaleBar(ctx: CanvasRenderingContext2D, layout: PosterLayout, preset: ColorPreset): void {
  const { footerRect, unit } = layout;
  const barW = footerRect.w * 0.34;
  const barH = unit * 0.007;
  const segs = 4;
  const x0 = footerRect.x;
  const y0 = footerRect.y + footerRect.h * 0.34;

  for (let i = 0; i < segs; i++) {
    const sx = x0 + (barW / segs) * i;
    ctx.lineWidth = Math.max(1, unit * 0.0012);
    ctx.strokeStyle = preset.frame;
    ctx.strokeRect(sx, y0, barW / segs, barH);
    if (i % 2 === 0) {
      ctx.fillStyle = preset.frame;
      ctx.fillRect(sx, y0, barW / segs, barH);
    }
  }

  const fs = unit * 0.011;
  ctx.fillStyle = preset.textMuted;
  ctx.font = `${fs}px "IBM Plex Mono", monospace`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText('0', x0, y0 + barH + fs * 0.4);
  ctx.textAlign = 'right';
  ctx.fillText(String(segs), x0 + barW, y0 + barH + fs * 0.4);
  ctx.textAlign = 'left';
  ctx.fillText('SCALE — ARBITRARY UNITS', x0, y0 - fs * 1.5);
  ctx.textAlign = 'left';
}

function drawCompass(ctx: CanvasRenderingContext2D, layout: PosterLayout, preset: ColorPreset): void {
  const { footerRect, unit } = layout;
  const r = footerRect.h * 0.36;
  const cx = footerRect.x + footerRect.w - r * 1.4;
  const cy = footerRect.y + footerRect.h * 0.52;

  ctx.strokeStyle = preset.frame;
  ctx.lineWidth = Math.max(1, unit * 0.0014);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  for (let a = 0; a < 4; a++) {
    const ang = (a * Math.PI) / 2;
    const x1 = cx + Math.sin(ang) * r * 0.72;
    const y1 = cy - Math.cos(ang) * r * 0.72;
    const x2 = cx + Math.sin(ang) * r * 1.05;
    const y2 = cy - Math.cos(ang) * r * 1.05;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.fillStyle = preset.frame;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.66);
  ctx.lineTo(cx - r * 0.15, cy + r * 0.12);
  ctx.lineTo(cx, cy - r * 0.02);
  ctx.lineTo(cx + r * 0.15, cy + r * 0.12);
  ctx.closePath();
  ctx.fill();

  const fs = unit * 0.011;
  ctx.fillStyle = preset.textMuted;
  ctx.font = `${fs}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('N', cx, cy - r * 1.16);
}

function drawEmptyHint(ctx: CanvasRenderingContext2D, layout: PosterLayout, preset: ColorPreset): void {
  const { drawArea, unit } = layout;
  ctx.save();
  ctx.setLineDash([unit * 0.006, unit * 0.009]);
  ctx.strokeStyle = preset.textMuted;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = Math.max(1, unit * 0.0012);
  ctx.strokeRect(drawArea.x, drawArea.y, drawArea.w, drawArea.h);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = preset.textMuted;
  ctx.font = `${unit * 0.026}px "Cormorant", serif`;
  ctx.fillText('ここに描いてください', drawArea.x + drawArea.w / 2, drawArea.y + drawArea.h / 2 - unit * 0.018);
  ctx.font = `${unit * 0.011}px "IBM Plex Mono", monospace`;
  ctx.fillText('DRAG TO BEGIN THE SURVEY', drawArea.x + drawArea.w / 2, drawArea.y + drawArea.h / 2 + unit * 0.022);
  ctx.globalAlpha = 1;
}

function drawContours(ctx: CanvasRenderingContext2D, layout: PosterLayout, preset: ColorPreset, polylines: ContourPolyline[], numLevels: number): void {
  const { drawArea, unit } = layout;
  const minorWidth = Math.max(0.6, unit * 0.0015);
  const majorWidth = Math.max(1.3, unit * 0.0038);
  const spacingPx = unit * 0.4;
  const gapHalf = unit * 0.026;
  const fontSize = Math.max(8, unit * 0.0125);

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const line of polylines) {
    if (line.isIndex) continue;
    const pixelPts = line.points.map((p) => toPixel(p, drawArea));
    ctx.beginPath();
    pixelPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    if (line.closed) ctx.closePath();
    ctx.globalAlpha = 0.82;
    ctx.strokeStyle = preset.lineMinor;
    ctx.lineWidth = minorWidth;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.font = `${fontSize}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const line of polylines) {
    if (!line.isIndex) continue;
    const points = line.closed && line.points.length > 0 ? [...line.points, line.points[0]!] : line.points;
    const pixelPts = points.map((p) => toPixel(p, drawArea));
    const elevation = elevationOf(line.level, numLevels);
    const { segments, labels } = layoutIndexPolyline(pixelPts, `${elevation}M`, spacingPx, gapHalf);

    ctx.strokeStyle = preset.lineMajor;
    ctx.lineWidth = majorWidth;
    for (const seg of segments) {
      ctx.beginPath();
      seg.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }

    ctx.fillStyle = preset.lineMajor;
    for (const label of labels) {
      ctx.save();
      ctx.translate(label.x, label.y);
      ctx.rotate(label.angle);
      ctx.fillText(label.text, 0, 0);
      ctx.restore();
    }
  }
}

/**
 * Draws the full poster (background, contours, chrome) onto any 2D canvas
 * context at the resolution implied by `layout`. Used for both the live
 * preview canvas and the higher-resolution offscreen PNG export canvas, so
 * what you see is exactly what you export.
 */
export function renderPoster(ctx: CanvasRenderingContext2D, layout: PosterLayout, preset: ColorPreset, state: PosterState, polylines: ContourPolyline[]): void {
  ctx.clearRect(0, 0, layout.W, layout.H);
  drawBackground(ctx, layout, preset);
  drawContours(ctx, layout, preset, polylines, state.levels);
  if (polylines.length === 0) drawEmptyHint(ctx, layout, preset);
  if (state.showFrame) drawFrame(ctx, layout, preset);
  if (state.showTitle || state.showSubtitle) drawHeaderText(ctx, layout, preset, state);
  if (state.showScaleBar) drawScaleBar(ctx, layout, preset);
  if (state.showCompass) drawCompass(ctx, layout, preset);
}
