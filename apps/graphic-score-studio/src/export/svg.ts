import type { InkLayer } from '../ink/layer';
import type { ScaleName } from '../types';
import { computeLayout } from '../poster/layout';
import { formatDate, formatDuration } from '../poster/format';

const INK = '#14120f';
const RULE = 'rgba(20,18,15,0.9)';
const GUIDE = 'rgba(20,18,15,0.22)';
const FAINT = 'rgba(20,18,15,0.65)';

export interface SvgExportParams {
  title: string;
  catalogNumber: string;
  createdAt: Date;
  durationSec: number;
  scale: ScaleName;
  inkLayer: InkLayer;
}

/** Escapes text for safe embedding inside SVG/XML text nodes and attributes. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cropMarksSvg(layout: ReturnType<typeof computeLayout>): string {
  const { border, cropMarkLen: len, cropMarkGap: gap } = layout;
  const corners: [number, number, 1 | -1, 1 | -1][] = [
    [border.x, border.y, -1, -1],
    [border.x + border.w, border.y, 1, -1],
    [border.x, border.y + border.h, -1, 1],
    [border.x + border.w, border.y + border.h, 1, 1],
  ];
  let out = '';
  for (const [cx, cy, dx, dy] of corners) {
    out += `<line x1="${cx}" y1="${cy + dy * gap}" x2="${cx}" y2="${cy + dy * (gap + len)}" stroke="${INK}" stroke-width="1"/>`;
    out += `<line x1="${cx + dx * gap}" y1="${cy}" x2="${cx + dx * (gap + len)}" y2="${cy}" stroke="${INK}" stroke-width="1"/>`;
  }
  return out;
}

function strokesToPaths(inkLayer: InkLayer, offsetX: number, offsetY: number): string {
  let out = '';
  for (const s of inkLayer.strokes) {
    if (s.points.length === 0) continue;
    if (s.points.length === 1) {
      const p = s.points[0];
      out += `<circle cx="${(p.x + offsetX).toFixed(1)}" cy="${(p.y + offsetY).toFixed(1)}" r="${(s.width / 2).toFixed(1)}" fill="${INK}" opacity="${s.opacity}"/>`;
      continue;
    }
    const d = s.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x + offsetX).toFixed(1)} ${(p.y + offsetY).toFixed(1)}`)
      .join(' ');
    out += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${s.opacity}"/>`;
  }
  return out;
}

function imageCellsToRects(inkLayer: InkLayer, offsetX: number, offsetY: number): string {
  const cell = 6;
  const cells = inkLayer.sampleImageCells(cell);
  let out = '';
  for (const c of cells) {
    out += `<rect x="${(c.x + offsetX).toFixed(1)}" y="${(c.y + offsetY).toFixed(1)}" width="${cell}" height="${cell}" fill="${INK}" opacity="${c.alpha.toFixed(2)}"/>`;
  }
  return out;
}

function legendSwatchSvg(kind: 'pitch' | 'volume' | 'timbre', x: number, y: number): string {
  const h = 34;
  if (kind === 'pitch') {
    let out = `<line x1="${x}" y1="${y + h}" x2="${x}" y2="${y}" stroke="${INK}" stroke-width="1.4"/>`;
    for (let i = 0; i < 3; i++) {
      const r = 3 + i * 2.4;
      const cy = y + h - (h / 2) * i;
      out += `<circle cx="${x + 14 + i * 26}" cy="${cy}" r="${r}" fill="${INK}"/>`;
    }
    return out;
  }
  if (kind === 'volume') {
    const w = 96;
    return `<polygon points="${x},${y + h / 2 - 1} ${x + w},${y + h / 2 - 10} ${x + w},${y + h / 2 + 10}" fill="${INK}"/>`;
  }
  let out = '';
  for (let i = 0; i < 3; i++) {
    const bx = x + i * 34;
    const by = y + h / 2 - 12;
    out += `<rect x="${bx}" y="${by}" width="24" height="24" fill="none" stroke="${INK}" stroke-width="1"/>`;
    const density = 0.25 + i * 0.4;
    let hatch = '';
    for (let ly = 0; ly < 24; ly += 4) {
      hatch += `<line x1="${bx}" y1="${by + ly}" x2="${bx + 24}" y2="${by + ly}" stroke="${INK}" stroke-width="1" opacity="${density}"/>`;
    }
    out += `<clipPath id="clip-${i}-${bx}"><rect x="${bx}" y="${by}" width="24" height="24"/></clipPath><g clip-path="url(#clip-${i}-${bx})">${hatch}</g>`;
  }
  return out;
}

export function buildSvg(params: SvgExportParams): string {
  const layout = computeLayout();
  const { posterW, posterH, border, content, ink } = layout;
  const scaleLabel = params.scale === 'pentatonic' ? 'PENTATONIC' : 'WHOLE-TONE';
  const titleLines = esc(params.title.toUpperCase()).split(' ');
  // simple width-based wrap approximation for SVG (no canvas measurement available here)
  const wrapped: string[] = [];
  let cur = '';
  for (const w of titleLines) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length > 26 && cur) {
      wrapped.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) wrapped.push(cur);

  const legendRows: { kind: 'pitch' | 'volume' | 'timbre'; label: string; desc: string }[] = [
    { kind: 'pitch', label: 'VERTICAL POSITION', desc: `→ PITCH (3 OCT, ${scaleLabel} QUANTIZED)` },
    { kind: 'volume', label: 'STROKE WEIGHT', desc: '→ DYNAMIC (VOLUME)' },
    { kind: 'timbre', label: 'INK DENSITY', desc: '→ TIMBRE: SINE · TRIANGLE · SAWTOOTH' },
  ];

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${posterW}" height="${posterH}" viewBox="0 0 ${posterW} ${posterH}" font-family="'IBM Plex Mono', monospace">`,
  );
  parts.push(`<rect x="0" y="0" width="${posterW}" height="${posterH}" fill="#f3eee2"/>`);
  parts.push(cropMarksSvg(layout));
  parts.push(
    `<rect x="${border.x + 0.5}" y="${border.y + 0.5}" width="${border.w}" height="${border.h}" fill="none" stroke="${RULE}"/>`,
  );

  parts.push(
    `<text x="${content.x}" y="${content.y + 14}" font-size="13" font-weight="600" letter-spacing="1.5" fill="${INK}">GRAPHIC SCORE — GRAPHISCHE PARTITUR — PARTITION GRAPHIQUE</text>`,
  );

  wrapped.slice(0, 2).forEach((line, i) => {
    parts.push(
      `<text x="${layout.titleBox.x}" y="${layout.titleBox.y + 50 + i * 62}" font-family="Inter, sans-serif" font-size="56" font-weight="800" letter-spacing="1.2">${line}</text>`,
    );
  });

  parts.push(
    `<text x="${layout.catalogBox.x + layout.catalogBox.w}" y="${layout.catalogBox.y + 14}" text-anchor="end" font-size="12" fill="${FAINT}" letter-spacing="1.5">CATALOGUE NO.</text>`,
  );
  parts.push(
    `<text x="${layout.catalogBox.x + layout.catalogBox.w}" y="${layout.catalogBox.y + 50}" text-anchor="end" font-size="30" font-weight="600" fill="${INK}">${esc(params.catalogNumber)}</text>`,
  );
  parts.push(
    `<text x="${layout.catalogBox.x + layout.catalogBox.w}" y="${layout.catalogBox.y + 74}" text-anchor="end" font-size="12" fill="${FAINT}" letter-spacing="1.2">EDITION WEB AUDIO</text>`,
  );

  const headerRuleY = layout.header.y + layout.header.h;
  parts.push(`<line x1="${content.x}" y1="${headerRuleY}" x2="${content.x + content.w}" y2="${headerRuleY}" stroke="${RULE}"/>`);

  parts.push(
    `<text x="${content.x}" y="${layout.instructionY}" font-size="13" fill="${INK}">PERFORM LEFT → RIGHT AT CONSTANT VELOCITY · DURATION ${formatDuration(params.durationSec)} · SCALE ${scaleLabel}</text>`,
  );

  parts.push(`<rect x="${ink.x + 0.5}" y="${ink.y + 0.5}" width="${ink.w}" height="${ink.h}" fill="none" stroke="${RULE}"/>`);
  parts.push(
    `<line x1="${ink.x}" y1="${ink.y + ink.h / 3}" x2="${ink.x + ink.w}" y2="${ink.y + ink.h / 3}" stroke="${GUIDE}"/>`,
  );
  parts.push(
    `<line x1="${ink.x}" y1="${ink.y + (ink.h * 2) / 3}" x2="${ink.x + ink.w}" y2="${ink.y + (ink.h * 2) / 3}" stroke="${GUIDE}"/>`,
  );
  const bandLabels: [string, number][] = [
    ['HIGH', ink.y + ink.h / 6],
    ['MID', ink.y + ink.h / 2],
    ['LOW', ink.y + (ink.h * 5) / 6],
  ];
  for (const [label, y] of bandLabels) {
    parts.push(
      `<text x="${layout.bandLabelX + 10}" y="${y + 4}" font-size="11" font-weight="600" fill="${FAINT}" letter-spacing="1.5">${label}</text>`,
    );
  }

  parts.push(`<g clip-path="url(#ink-clip)">`);
  parts.push(`<clipPath id="ink-clip"><rect x="${ink.x}" y="${ink.y}" width="${ink.w}" height="${ink.h}"/></clipPath>`);
  parts.push(imageCellsToRects(params.inkLayer, ink.x, ink.y));
  parts.push(strokesToPaths(params.inkLayer, ink.x, ink.y));
  parts.push(`</g>`);

  const metaRuleY = layout.metaY - 22;
  parts.push(`<line x1="${content.x}" y1="${metaRuleY}" x2="${content.x + content.w}" y2="${metaRuleY}" stroke="${RULE}"/>`);
  const col = content.w / 3;
  parts.push(`<text x="${content.x}" y="${layout.metaY}" font-size="13" fill="${INK}">DURATION ${formatDuration(params.durationSec)}</text>`);
  parts.push(
    `<text x="${content.x + col}" y="${layout.metaY}" font-size="13" fill="${INK}">GENERATED ${esc(formatDate(params.createdAt))}</text>`,
  );
  parts.push(`<text x="${content.x + col * 2}" y="${layout.metaY}" font-size="13" fill="${INK}">VOICES ≤ 6 · OSC ONLY</text>`);

  parts.push(
    `<text x="${content.x}" y="${layout.legendHeaderY}" font-family="Inter, sans-serif" font-size="13" font-weight="700" letter-spacing="2">LEGEND</text>`,
  );
  const legendRuleY = layout.legendHeaderY + 12;
  parts.push(`<line x1="${content.x}" y1="${legendRuleY}" x2="${content.x + content.w}" y2="${legendRuleY}" stroke="${RULE}"/>`);
  legendRows.forEach((row, i) => {
    const y = layout.legend.y + i * layout.legendRowH;
    parts.push(legendSwatchSvg(row.kind, content.x, y));
    parts.push(
      `<text x="${content.x + 190}" y="${y + 20}" font-family="Inter, sans-serif" font-size="14" font-weight="700" fill="${INK}">${esc(row.label)}</text>`,
    );
    parts.push(`<text x="${content.x + 190}" y="${y + 38}" font-size="13" fill="${FAINT}">${esc(row.desc)}</text>`);
  });

  const footerRuleY = layout.footerY - 20;
  parts.push(`<line x1="${content.x}" y1="${footerRuleY}" x2="${content.x + content.w}" y2="${footerRuleY}" stroke="${RULE}"/>`);
  parts.push(`<text x="${content.x}" y="${layout.footerY}" font-size="11" fill="${FAINT}">PLATE ${esc(params.catalogNumber)}</text>`);
  parts.push(
    `<text x="${content.x + content.w}" y="${layout.footerY}" text-anchor="end" font-size="11" fill="${FAINT}">OSCILLATOR SYNTHESIS ONLY — NO SAMPLES — GRAPHIC SCORE STUDIO</text>`,
  );

  parts.push('</svg>');
  return parts.join('');
}
