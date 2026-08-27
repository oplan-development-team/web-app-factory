import type { ColorPreset, ContourPolyline, Point, PosterState } from './types.ts';
import type { PosterLayout, Rect } from './layout.ts';
import { elevationOf, layoutIndexPolyline } from './contourLayout.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function toPixel(pt: Point, drawArea: Rect): Point {
  return { x: drawArea.x + pt.x * drawArea.w, y: drawArea.y + pt.y * drawArea.h };
}

function pathFrom(points: Point[], closed: boolean): string {
  if (points.length < 2) return '';
  const [first, ...rest] = points;
  let d = `M ${first!.x.toFixed(2)} ${first!.y.toFixed(2)}`;
  for (const p of rest) d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  if (closed) d += ' Z';
  return d;
}

function buildFrame(layout: PosterLayout, preset: ColorPreset): SVGGElement {
  const { frame, unit } = layout;
  const g = el('g', { stroke: preset.frame, fill: 'none', 'stroke-width': Math.max(1, unit * 0.0016) });
  g.appendChild(el('rect', { x: frame.x, y: frame.y, width: frame.w, height: frame.h }));

  const line = (x1: number, y1: number, x2: number, y2: number) => el('line', { x1, y1, x2, y2 });

  const cs = unit * 0.014;
  const corners = [
    { x: frame.x, y: frame.y },
    { x: frame.x + frame.w, y: frame.y },
    { x: frame.x, y: frame.y + frame.h },
    { x: frame.x + frame.w, y: frame.y + frame.h },
  ];
  for (const c of corners) {
    g.appendChild(line(c.x - cs, c.y, c.x + cs, c.y));
    g.appendChild(line(c.x, c.y - cs, c.x, c.y + cs));
  }

  const tickLen = unit * 0.009;
  const tickLenLong = unit * 0.017;
  const steps = 24;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const len = i % 4 === 0 ? tickLenLong : tickLen;
    const xt = frame.x + frame.w * t;
    g.appendChild(line(xt, frame.y, xt, frame.y + len));
    g.appendChild(line(xt, frame.y + frame.h, xt, frame.y + frame.h - len));
    const yt = frame.y + frame.h * t;
    g.appendChild(line(frame.x, yt, frame.x + len, yt));
    g.appendChild(line(frame.x + frame.w, yt, frame.x + frame.w - len, yt));
  }
  return g;
}

function buildHeader(layout: PosterLayout, preset: ColorPreset, state: PosterState): SVGGElement {
  const { headerRect, unit } = layout;
  const g = el('g');
  const cx = headerRect.x + headerRect.w / 2;

  if (state.showTitle && state.title.trim()) {
    const fontSize = headerRect.h * 0.4;
    const t = el('text', {
      x: cx,
      y: headerRect.y + headerRect.h * 0.56,
      fill: preset.text,
      'font-family': '"Cormorant", Georgia, serif',
      'font-weight': 500,
      'font-size': fontSize,
      'letter-spacing': fontSize * 0.16,
      'text-anchor': 'middle',
    });
    t.textContent = state.title.toUpperCase();
    g.appendChild(t);
  }

  if (state.showSubtitle && state.subtitle.trim()) {
    const fontSize = headerRect.h * 0.14;
    const t = el('text', {
      x: cx,
      y: headerRect.y + headerRect.h * 0.86,
      fill: preset.textMuted,
      'font-family': '"IBM Plex Mono", monospace',
      'font-size': fontSize,
      'letter-spacing': fontSize * 0.22,
      'text-anchor': 'middle',
    });
    t.textContent = state.subtitle.toUpperCase();
    g.appendChild(t);
  }

  g.appendChild(
    el('line', {
      x1: headerRect.x,
      y1: headerRect.y + headerRect.h * 0.98,
      x2: headerRect.x + headerRect.w,
      y2: headerRect.y + headerRect.h * 0.98,
      stroke: preset.frame,
      'stroke-opacity': 0.55,
      'stroke-width': Math.max(1, unit * 0.001),
    }),
  );

  return g;
}

function buildScaleBar(layout: PosterLayout, preset: ColorPreset): SVGGElement {
  const { footerRect, unit } = layout;
  const g = el('g');
  const barW = footerRect.w * 0.34;
  const barH = unit * 0.007;
  const segs = 4;
  const x0 = footerRect.x;
  const y0 = footerRect.y + footerRect.h * 0.34;

  for (let i = 0; i < segs; i++) {
    const sx = x0 + (barW / segs) * i;
    g.appendChild(
      el('rect', {
        x: sx,
        y: y0,
        width: barW / segs,
        height: barH,
        stroke: preset.frame,
        'stroke-width': Math.max(1, unit * 0.0012),
        fill: i % 2 === 0 ? preset.frame : 'none',
      }),
    );
  }

  const fs = unit * 0.011;
  const label = (x: number, anchor: string, text: string) => {
    const t = el('text', { x, y: y0 + barH + fs * 1.2, fill: preset.textMuted, 'font-family': '"IBM Plex Mono", monospace', 'font-size': fs, 'text-anchor': anchor });
    t.textContent = text;
    return t;
  };
  g.appendChild(label(x0, 'start', '0'));
  g.appendChild(label(x0 + barW, 'end', String(segs)));
  const caption = el('text', { x: x0, y: y0 - fs * 0.7, fill: preset.textMuted, 'font-family': '"IBM Plex Mono", monospace', 'font-size': fs, 'text-anchor': 'start' });
  caption.textContent = 'SCALE — ARBITRARY UNITS';
  g.appendChild(caption);

  return g;
}

function buildCompass(layout: PosterLayout, preset: ColorPreset): SVGGElement {
  const { footerRect, unit } = layout;
  const g = el('g');
  const r = footerRect.h * 0.36;
  const cx = footerRect.x + footerRect.w - r * 1.4;
  const cy = footerRect.y + footerRect.h * 0.52;

  g.appendChild(el('circle', { cx, cy, r, fill: 'none', stroke: preset.frame, 'stroke-width': Math.max(1, unit * 0.0014) }));

  for (let a = 0; a < 4; a++) {
    const ang = (a * Math.PI) / 2;
    const x1 = cx + Math.sin(ang) * r * 0.72;
    const y1 = cy - Math.cos(ang) * r * 0.72;
    const x2 = cx + Math.sin(ang) * r * 1.05;
    const y2 = cy - Math.cos(ang) * r * 1.05;
    g.appendChild(el('line', { x1, y1, x2, y2, stroke: preset.frame, 'stroke-width': Math.max(1, unit * 0.0014) }));
  }

  const points = `${cx},${cy - r * 0.66} ${cx - r * 0.15},${cy + r * 0.12} ${cx},${cy - r * 0.02} ${cx + r * 0.15},${cy + r * 0.12}`;
  g.appendChild(el('polygon', { points, fill: preset.frame }));

  const label = el('text', { x: cx, y: cy - r * 1.16, fill: preset.textMuted, 'font-family': '"IBM Plex Mono", monospace', 'font-size': unit * 0.011, 'text-anchor': 'middle' });
  label.textContent = 'N';
  g.appendChild(label);

  return g;
}

function buildContours(layout: PosterLayout, preset: ColorPreset, polylines: ContourPolyline[], numLevels: number): SVGGElement {
  const { drawArea, unit } = layout;
  const minorWidth = Math.max(0.6, unit * 0.0015);
  const majorWidth = Math.max(1.3, unit * 0.0038);
  const spacingPx = unit * 0.4;
  const gapHalf = unit * 0.026;
  const fontSize = Math.max(8, unit * 0.0125);

  const g = el('g', { 'stroke-linejoin': 'round', 'stroke-linecap': 'round', fill: 'none' });
  const minorGroup = el('g', { stroke: preset.lineMinor, 'stroke-width': minorWidth, 'stroke-opacity': 0.82 });
  const majorGroup = el('g', { stroke: preset.lineMajor, 'stroke-width': majorWidth });
  const labelGroup = el('g', { fill: preset.lineMajor, 'font-family': '"IBM Plex Mono", monospace', 'font-size': fontSize, 'text-anchor': 'middle' });

  for (const line of polylines) {
    if (line.isIndex) continue;
    const pixelPts = line.points.map((p) => toPixel(p, drawArea));
    const d = pathFrom(pixelPts, line.closed);
    if (d) minorGroup.appendChild(el('path', { d }));
  }

  for (const line of polylines) {
    if (!line.isIndex) continue;
    const points = line.closed && line.points.length > 0 ? [...line.points, line.points[0]!] : line.points;
    const pixelPts = points.map((p) => toPixel(p, drawArea));
    const elevation = elevationOf(line.level, numLevels);
    const { segments, labels } = layoutIndexPolyline(pixelPts, `${elevation}M`, spacingPx, gapHalf);

    for (const seg of segments) {
      const d = pathFrom(seg, false);
      if (d) majorGroup.appendChild(el('path', { d }));
    }
    for (const label of labels) {
      const t = el('text', { x: 0, y: 0, transform: `translate(${label.x.toFixed(2)} ${label.y.toFixed(2)}) rotate(${((label.angle * 180) / Math.PI).toFixed(2)})` });
      t.textContent = label.text;
      labelGroup.appendChild(t);
    }
  }

  g.appendChild(minorGroup);
  g.appendChild(majorGroup);
  g.appendChild(labelGroup);
  return g;
}

/**
 * Builds the poster as a standalone SVG document via DOM APIs (no library),
 * reusing the same layout math and contour label placement as the canvas
 * renderer so the vector export matches the on-screen poster.
 */
export function buildPosterSVG(layout: PosterLayout, preset: ColorPreset, state: PosterState, polylines: ContourPolyline[]): SVGSVGElement {
  const svg = el('svg', {
    xmlns: SVG_NS,
    width: layout.W,
    height: layout.H,
    viewBox: `0 0 ${layout.W} ${layout.H}`,
  });

  const defs = el('defs');
  const grad = el('radialGradient', { id: 'bgGrad', cx: '50%', cy: '48%', r: '75%' });
  const stop0 = el('stop', { offset: '0%', 'stop-color': preset.bg });
  const stop1 = el('stop', { offset: '100%', 'stop-color': preset.bgVignette });
  grad.appendChild(stop0);
  grad.appendChild(stop1);
  defs.appendChild(grad);
  svg.appendChild(defs);

  svg.appendChild(el('rect', { x: 0, y: 0, width: layout.W, height: layout.H, fill: 'url(#bgGrad)' }));
  svg.appendChild(buildContours(layout, preset, polylines, state.levels));
  if (state.showFrame) svg.appendChild(buildFrame(layout, preset));
  if (state.showTitle || state.showSubtitle) svg.appendChild(buildHeader(layout, preset, state));
  if (state.showScaleBar) svg.appendChild(buildScaleBar(layout, preset));
  if (state.showCompass) svg.appendChild(buildCompass(layout, preset));

  return svg;
}

export function serializeSVG(svg: SVGSVGElement): string {
  const serializer = new XMLSerializer();
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serializer.serializeToString(svg)}`;
}
