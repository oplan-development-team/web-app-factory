import {
  ART_H,
  ART_W,
  ART_X,
  ART_Y,
  DOC_H,
  DOC_W,
  MULTI_PRESETS,
  REG_MARK_INSET,
  REG_MARK_SIZE,
  RULER_MAJOR_STEP,
  RULER_MINOR_STEP,
} from './constants';
import { hypsometricColor } from './palette';
import type { AppSettings, SourceImage, TraceResult } from '../types';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function text(x: number, y: number, content: string, attrs: Record<string, string | number> = {}): SVGTextElement {
  const t = el('text', { x, y, ...attrs });
  t.textContent = content;
  return t;
}

export function buildPosterSvg(trace: TraceResult, settings: AppSettings, source: SourceImage | null): SVGSVGElement {
  const paper = settings.colorMode === 'multi' ? MULTI_PAPER(settings) : settings.paperColor;

  const svg = el('svg', {
    viewBox: `0 0 ${DOC_W} ${DOC_H}`,
    width: DOC_W,
    height: DOC_H,
    xmlns: SVG_NS,
  });
  svg.setAttribute('font-family', "'Inter', system-ui, sans-serif");

  const bg = el('rect', { x: 0, y: 0, width: DOC_W, height: DOC_H, fill: paper });
  svg.appendChild(bg);

  const clip = el('clipPath', { id: 'art-clip' });
  clip.appendChild(el('rect', { x: ART_X, y: ART_Y, width: ART_W, height: ART_H }));
  const defs = el('defs');
  defs.appendChild(clip);
  if (settings.colorMode === 'multi') defs.appendChild(buildLegendGradient(settings.multiPreset));
  svg.appendChild(defs);

  svg.appendChild(buildArt(trace, settings));

  if (settings.includeFrame) {
    svg.appendChild(buildFrame(trace, settings, source, paper));
  } else {
    // Art box hairline is still useful even without the full decorative frame.
    svg.appendChild(
      el('rect', {
        x: ART_X,
        y: ART_Y,
        width: ART_W,
        height: ART_H,
        fill: 'none',
        stroke: settings.colorMode === 'multi' ? '#00000033' : `${settings.inkColor}33`,
        'stroke-width': 1,
      }),
    );
  }

  return svg;
}

function MULTI_PAPER(settings: AppSettings): string {
  return MULTI_PRESETS[settings.multiPreset].paper;
}

function buildArt(trace: TraceResult, settings: AppSettings): SVGGElement {
  const g = el('g', { transform: `translate(${ART_X}, ${ART_Y})`, 'clip-path': 'url(#art-clip)' });
  if (trace.bands.length === 0) return g;

  if (settings.colorMode === 'mono') {
    const combined = trace.bands.map((b) => b.path).join(' ');
    g.appendChild(
      el('path', {
        d: combined,
        fill: 'none',
        stroke: settings.inkColor,
        'stroke-width': settings.lineWeight,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
      }),
    );
  } else {
    for (const band of trace.bands) {
      g.appendChild(
        el('path', {
          d: band.path,
          fill: 'none',
          stroke: hypsometricColor(settings.multiPreset, band.t),
          'stroke-width': settings.lineWeight,
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
        }),
      );
    }
  }
  return g;
}

function buildFrame(trace: TraceResult, settings: AppSettings, source: SourceImage | null, paper: string): SVGGElement {
  const frameInk =
    settings.colorMode === 'multi' ? (settings.multiPreset === 'blueprint' ? '#E8F1FA' : '#1A1A1A') : settings.inkColor;
  const dim = frameInk;

  const g = el('g', { class: 'frame' });
  g.setAttribute('color', dim);

  // Art box border.
  g.appendChild(el('rect', { x: ART_X, y: ART_Y, width: ART_W, height: ART_H, fill: 'none', stroke: dim, 'stroke-width': 1 }));

  // Registration marks, four corners of the whole document.
  const marks: Array<[number, number]> = [
    [REG_MARK_INSET, REG_MARK_INSET],
    [DOC_W - REG_MARK_INSET, REG_MARK_INSET],
    [REG_MARK_INSET, DOC_H - REG_MARK_INSET],
    [DOC_W - REG_MARK_INSET, DOC_H - REG_MARK_INSET],
  ];
  for (const [cx, cy] of marks) g.appendChild(regMark(cx, cy, dim));

  // Outer document border.
  g.appendChild(
    el('rect', {
      x: 14,
      y: 14,
      width: DOC_W - 28,
      height: DOC_H - 28,
      fill: 'none',
      stroke: dim,
      'stroke-width': 0.75,
      opacity: 0.5,
    }),
  );

  g.appendChild(buildRulers(dim));
  g.appendChild(buildLegend(trace, settings, dim, paper));
  g.appendChild(buildTitleBlock(trace, settings, source, dim));

  return g;
}

function regMark(cx: number, cy: number, ink: string): SVGGElement {
  const g = el('g', { stroke: ink, 'stroke-width': 1, fill: 'none' });
  const r = REG_MARK_SIZE / 2;
  g.appendChild(el('circle', { cx, cy, r }));
  g.appendChild(el('line', { x1: cx - r - 6, y1: cy, x2: cx + r + 6, y2: cy }));
  g.appendChild(el('line', { x1: cx, y1: cy - r - 6, x2: cx, y2: cy + r + 6 }));
  return g;
}

function buildRulers(ink: string): SVGGElement {
  const g = el('g', { stroke: ink, fill: ink });

  // Top ruler baseline + ticks.
  g.appendChild(el('line', { x1: ART_X, y1: ART_Y - 12, x2: ART_X + ART_W, y2: ART_Y - 12, 'stroke-width': 1 }));
  for (let x = 0; x <= ART_W; x += RULER_MINOR_STEP) {
    const major = x % RULER_MAJOR_STEP === 0;
    g.appendChild(
      el('line', {
        x1: ART_X + x,
        y1: ART_Y - 12,
        x2: ART_X + x,
        y2: ART_Y - (major ? 20 : 16),
        'stroke-width': major ? 1 : 0.5,
      }),
    );
    if (major) {
      const t = text(ART_X + x, ART_Y - 24, String(x), {
        'font-family': "'IBM Plex Mono', monospace",
        'font-size': 8,
        'text-anchor': 'middle',
        stroke: 'none',
      });
      g.appendChild(t);
    }
  }

  // Left ruler baseline + ticks.
  g.appendChild(el('line', { x1: ART_X - 12, y1: ART_Y, x2: ART_X - 12, y2: ART_Y + ART_H, 'stroke-width': 1 }));
  for (let y = 0; y <= ART_H; y += RULER_MINOR_STEP) {
    const major = y % RULER_MAJOR_STEP === 0;
    g.appendChild(
      el('line', {
        x1: ART_X - 12,
        y1: ART_Y + y,
        x2: ART_X - (major ? 20 : 16),
        y2: ART_Y + y,
        'stroke-width': major ? 1 : 0.5,
      }),
    );
    if (major) {
      const t = text(ART_X - 24, ART_Y + y + 3, String(y), {
        'font-family': "'IBM Plex Mono', monospace",
        'font-size': 8,
        'text-anchor': 'end',
        stroke: 'none',
      });
      g.appendChild(t);
    }
  }

  return g;
}

function buildLegendGradient(preset: AppSettings['multiPreset']): SVGLinearGradientElement {
  const grad = el('linearGradient', { id: 'legend-gradient', x1: '0%', y1: '0%', x2: '100%', y2: '0%' });
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    grad.appendChild(el('stop', { offset: `${(i / steps) * 100}%`, 'stop-color': hypsometricColor(preset, i / steps) }));
  }
  return grad;
}

function buildLegend(trace: TraceResult, settings: AppSettings, ink: string, _paper: string): SVGGElement {
  const y = ART_Y + ART_H + 42;
  const x = ART_X;
  const w = 300;
  const g = el('g', { fill: ink, stroke: ink });

  g.appendChild(
    text(x, y - 12, settings.colorMode === 'multi' ? 'ELEVATION TINT LEGEND' : 'CONTOUR DATA', {
      'font-family': "'Inter', sans-serif",
      'font-size': 9.5,
      'font-weight': 600,
      'letter-spacing': '0.14em',
      stroke: 'none',
    }),
  );

  if (settings.colorMode === 'multi') {
    g.appendChild(el('rect', { x, y, width: w, height: 14, fill: 'url(#legend-gradient)', stroke: ink, 'stroke-width': 1 }));
    g.appendChild(text(x, y + 30, `MIN ${Math.round(trace.min)}`, monoLabel(ink)));
    g.appendChild(text(x + w, y + 30, `MAX ${Math.round(trace.max)}`, { ...monoLabel(ink), 'text-anchor': 'end' }));
    g.appendChild(
      text(x + w / 2, y + 30, MULTI_PRESET_LABEL(settings.multiPreset), { ...monoLabel(ink), 'text-anchor': 'middle' }),
    );
  } else {
    const rows = [
      ['CI', trace.contourInterval ? trace.contourInterval.toFixed(2) : '—'],
      ['LINES', String(trace.bands.length)],
      ['INK', settings.inkColor.toUpperCase()],
    ];
    let cx = x;
    for (const [label, value] of rows) {
      g.appendChild(text(cx, y + 4, label, { ...smallLabel(ink) }));
      g.appendChild(text(cx, y + 20, value, monoLabel(ink)));
      cx += 92;
    }
    g.appendChild(el('line', { x1: x, y1: y - 4, x2: x + w, y2: y - 4, 'stroke-width': 1 }));
  }

  return g;
}

function buildTitleBlock(trace: TraceResult, settings: AppSettings, source: SourceImage | null, ink: string): SVGGElement {
  const w = 220;
  const h = 96;
  const x = ART_X + ART_W - w;
  const y = ART_Y + ART_H + 32;
  const g = el('g', { stroke: ink, fill: ink });

  g.appendChild(el('rect', { x, y, width: w, height: h, fill: 'none', 'stroke-width': 1 }));
  g.appendChild(el('line', { x1: x, y1: y + 30, x2: x + w, y2: y + 30, 'stroke-width': 0.75 }));
  g.appendChild(el('line', { x1: x, y1: y + 54, x2: x + w, y2: y + 54, 'stroke-width': 0.75 }));
  g.appendChild(el('line', { x1: x + w / 2, y1: y + 54, x2: x + w / 2, y2: y + h, 'stroke-width': 0.75 }));

  const title = (settings.title || 'UNTITLED SUMMIT').toUpperCase().slice(0, 26);
  g.appendChild(
    text(x + 10, y + 20, title, {
      'font-family': "'Inter', sans-serif",
      'font-size': 13,
      'font-weight': 700,
      'letter-spacing': '0.04em',
      stroke: 'none',
    }),
  );

  const subject = source ? source.fileName.slice(0, 34) : 'NO SOURCE LOADED';
  g.appendChild(
    text(x + 10, y + 44, subject, {
      'font-family': "'IBM Plex Mono', monospace",
      'font-size': 8,
      stroke: 'none',
      opacity: 0.85,
    }),
  );

  const date = new Date().toISOString().slice(0, 10);
  g.appendChild(text(x + 10, y + 68, 'SURVEYED', smallLabel(ink)));
  g.appendChild(text(x + 10, y + 84, date, monoLabel(ink)));

  g.appendChild(text(x + w / 2 + 10, y + 68, 'CI VALUE', smallLabel(ink)));
  g.appendChild(text(x + w / 2 + 10, y + 84, trace.contourInterval ? trace.contourInterval.toFixed(2) : '—', monoLabel(ink)));

  return g;
}

function MULTI_PRESET_LABEL(preset: AppSettings['multiPreset']): string {
  return MULTI_PRESETS[preset].label;
}

function monoLabel(ink: string): Record<string, string | number> {
  return { 'font-family': "'IBM Plex Mono', monospace", 'font-size': 10, fill: ink, stroke: 'none' };
}

function smallLabel(ink: string): Record<string, string | number> {
  return {
    'font-family': "'Inter', sans-serif",
    'font-size': 8,
    'letter-spacing': '0.1em',
    fill: ink,
    stroke: 'none',
    opacity: 0.75,
  };
}
