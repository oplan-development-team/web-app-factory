import type { NotePlan, TextRun } from './notePlan.ts';
import type { GuillocheLayer } from './guilloche.ts';

const SVG_FONT_FAMILIES: Record<TextRun['font'], string> = {
  title: "'Cinzel', 'Times New Roman', serif",
  italic: "'Cormorant Garamond', 'Times New Roman', serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
  label: "'Space Grotesk', sans-serif",
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function num(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '0';
}

function layerToPath(layer: GuillocheLayer): string {
  const pts = layer.points;
  if (pts.length < 2) return '';
  let d = `M ${num(pts[0]!.x)} ${num(pts[0]!.y)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${num(pts[i]!.x)} ${num(pts[i]!.y)}`;
  return d;
}

function layersToSvg(layers: GuillocheLayer[], color: string, weightMultiplier: number, opacityMultiplier: number): string {
  let out = '';
  for (const layer of layers) {
    const d = layerToPath(layer);
    if (!d) continue;
    const w = Math.max(0.25, layer.width * weightMultiplier);
    const a = Math.max(0, Math.min(1, layer.alpha * opacityMultiplier));
    out += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${num(w)}" stroke-opacity="${a.toFixed(3)}" stroke-linecap="round" stroke-linejoin="round"/>\n`;
  }
  return out;
}

/** Naive per-character advance estimate, matching notePlan's arch layout heuristic. */
function estimateAdvance(fontSize: number, letterSpacing: number): number {
  return fontSize * 0.62 + letterSpacing;
}

function spacedTextSvg(run: TextRun): string {
  const family = SVG_FONT_FAMILIES[run.font];
  const style = run.font === 'italic' ? 'italic' : 'normal';
  const weight = run.font === 'title' ? 600 : 500;
  const alpha = run.alpha ?? 1;

  if (!run.letterSpacing) {
    const anchor = run.align === 'center' ? 'middle' : run.align === 'right' ? 'end' : 'start';
    return `<text x="${num(run.x)}" y="${num(run.y)}" font-family="${family}" font-size="${num(run.fontSize)}" font-style="${style}" font-weight="${weight}" fill="${run.color}" fill-opacity="${alpha}" text-anchor="${anchor}">${esc(run.text)}</text>\n`;
  }

  // Manual per-glyph placement so exported SVG matches the canvas letter-spacing.
  const chars = run.text.split('');
  const advance = estimateAdvance(run.fontSize, run.letterSpacing);
  const total = advance * chars.length;
  let startX = run.x;
  if (run.align === 'center') startX = run.x - total / 2 + advance / 2;
  else if (run.align === 'right') startX = run.x - total + advance / 2;
  else startX = run.x + advance / 2;

  let out = `<g font-family="${family}" font-size="${num(run.fontSize)}" font-style="${style}" font-weight="${weight}" fill="${run.color}" fill-opacity="${alpha}" text-anchor="middle">\n`;
  chars.forEach((ch, i) => {
    out += `<text x="${num(startX + i * advance)}" y="${num(run.y)}">${esc(ch)}</text>\n`;
  });
  out += `</g>\n`;
  return out;
}

/** Build a standalone SVG document string for the given note plan. */
export function planToSvgString(plan: NotePlan): string {
  const { width, height } = plan;
  const c = { x0: plan.frame.contentInset, y0: plan.frame.contentInset, x1: width - plan.frame.contentInset, y1: height - plan.frame.contentInset };
  const b = { x0: plan.frame.innerInset, y0: plan.frame.innerInset, x1: width - plan.frame.innerInset, y1: height - plan.frame.innerInset };

  let svg = '';
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;
  svg += `<defs>\n`;
  svg += `<clipPath id="clip-content"><rect x="${num(c.x0)}" y="${num(c.y0)}" width="${num(c.x1 - c.x0)}" height="${num(c.y1 - c.y0)}"/></clipPath>\n`;
  svg += `<clipPath id="clip-band"><path fill-rule="evenodd" d="M ${num(b.x0)} ${num(b.y0)} H ${num(b.x1)} V ${num(b.y1)} H ${num(b.x0)} Z M ${num(c.x0)} ${num(c.y0)} H ${num(c.x1)} V ${num(c.y1)} H ${num(c.x0)} Z"/></clipPath>\n`;
  svg += `</defs>\n`;

  // paper
  svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="${plan.paperColor}"/>\n`;

  // paper grain hatch
  svg += `<g stroke="${plan.paperGrain}" stroke-width="0.4" opacity="0.5">\n`;
  for (let x = -height; x < width; x += 3) {
    svg += `<line x1="${num(x)}" y1="0" x2="${num(x + height)}" y2="${num(height)}"/>\n`;
  }
  svg += `</g>\n`;

  // tint field (clipped to content)
  svg += `<g clip-path="url(#clip-content)">\n${layersToSvg(plan.layers.tint, plan.inkMain, plan.weightMultiplier, 1)}</g>\n`;

  // numeral ring, central rosette, corner rosettes
  svg += layersToSvg(plan.layers.numeralRing, plan.inkMain, plan.weightMultiplier, 1);
  svg += layersToSvg(plan.layers.centralRosette, plan.inkMain, plan.weightMultiplier, 1);
  svg += layersToSvg(plan.layers.cornerRosettes, plan.inkMain, plan.weightMultiplier, 1);

  // border band (clipped to band ring)
  svg += `<g clip-path="url(#clip-band)">\n${layersToSvg(plan.layers.border, plan.inkMain, plan.weightMultiplier, 1)}</g>\n`;

  // double-rule frame
  svg += `<rect x="${num(plan.frame.outerInset)}" y="${num(plan.frame.outerInset)}" width="${num(width - plan.frame.outerInset * 2)}" height="${num(height - plan.frame.outerInset * 2)}" fill="none" stroke="${plan.inkMain}" stroke-width="${plan.frame.ruleWidth}" stroke-opacity="0.92"/>\n`;
  svg += `<rect x="${num(plan.frame.innerInset)}" y="${num(plan.frame.innerInset)}" width="${num(width - plan.frame.innerInset * 2)}" height="${num(height - plan.frame.innerInset * 2)}" fill="none" stroke="${plan.inkMain}" stroke-width="${plan.frame.ruleWidth * 0.72}" stroke-opacity="0.92"/>\n`;

  // title (arched glyphs)
  svg += `<g font-family="${SVG_FONT_FAMILIES.title}" font-size="${num(plan.titleFontSize)}" font-weight="600" fill="${plan.inkMain}" text-anchor="middle">\n`;
  for (const g of plan.titleChars) {
    svg += `<text x="0" y="0" transform="translate(${num(g.x)} ${num(g.y)}) rotate(${num((g.rotate * 180) / Math.PI)})">${esc(g.ch)}</text>\n`;
  }
  svg += `</g>\n`;

  // other text runs
  for (const run of plan.texts) svg += spacedTextSvg(run);

  // specimen overprint
  const s = plan.specimen;
  svg += `<g transform="translate(${num(s.centerX)} ${num(s.centerY)}) rotate(${num((s.rotate * 180) / Math.PI)})">\n`;
  for (const row of s.rows) {
    svg += spacedTextSvg({
      text: row.text,
      x: row.x,
      y: row.y,
      fontSize: s.fontSize,
      font: 'title',
      color: s.color,
      align: 'center',
      letterSpacing: s.letterSpacing,
    });
  }
  svg += `</g>\n`;

  svg += `</svg>\n`;
  return svg;
}
