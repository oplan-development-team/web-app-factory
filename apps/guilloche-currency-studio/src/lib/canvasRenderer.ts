import type { NotePlan, TextRun } from './notePlan.ts';
import type { GuillocheLayer } from './guilloche.ts';

const FONT_FAMILIES: Record<TextRun['font'], string> = {
  title: '"Cinzel", "Times New Roman", serif',
  italic: '"Cormorant Garamond", "Times New Roman", serif',
  mono: '"JetBrains Mono", "Courier New", monospace',
  label: '"Space Grotesk", sans-serif',
};

function fontString(font: TextRun['font'], size: number): string {
  const italic = font === 'italic' ? 'italic ' : '';
  const weight = font === 'title' ? '600 ' : font === 'mono' ? '500 ' : '500 ';
  return `${italic}${weight}${size}px ${FONT_FAMILIES[font]}`;
}

function strokeLayers(ctx: CanvasRenderingContext2D, layers: GuillocheLayer[], color: string, weightMultiplier: number, opacityMultiplier = 1) {
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const layer of layers) {
    if (layer.points.length < 2) continue;
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.alpha * opacityMultiplier));
    ctx.lineWidth = Math.max(0.25, layer.width * weightMultiplier);
    ctx.beginPath();
    const pts = layer.points;
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Draw a run of text with manual letter-spacing (canvas has no native letter-spacing on older engines). */
function drawSpacedText(ctx: CanvasRenderingContext2D, run: TextRun) {
  ctx.font = fontString(run.font, run.fontSize);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = run.color;
  ctx.globalAlpha = run.alpha ?? 1;

  if (!run.letterSpacing) {
    ctx.textAlign = run.align;
    ctx.fillText(run.text, run.x, run.y);
    ctx.globalAlpha = 1;
    return;
  }

  const chars = run.text.split('');
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + run.letterSpacing * (chars.length - 1);

  let startX = run.x;
  if (run.align === 'center') startX = run.x - total / 2;
  else if (run.align === 'right') startX = run.x - total;

  ctx.textAlign = 'left';
  let cx = startX;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i]!, cx, run.y);
    cx += widths[i]! + run.letterSpacing;
  }
  ctx.globalAlpha = 1;
}

/**
 * Render a NotePlan into a canvas context at the given pixel scale. The
 * context is expected to already be sized to plan.width*scale x
 * plan.height*scale; this function applies the scale transform itself.
 */
export function renderNoteToCanvas(ctx: CanvasRenderingContext2D, plan: NotePlan, scale: number) {
  const { width, height } = plan;
  ctx.save();
  ctx.clearRect(0, 0, width * scale, height * scale);
  ctx.scale(scale, scale);

  // --- paper ---
  ctx.fillStyle = plan.paperColor;
  ctx.fillRect(0, 0, width, height);

  // faint paper grain hatch (very subtle, static per-render, not seed-driven —
  // purely a physical paper texture cue, independent of the guilloche math)
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = plan.paperGrain;
  ctx.lineWidth = 0.4;
  for (let x = -height; x < width; x += 3) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
    ctx.stroke();
  }
  ctx.restore();

  // --- background tint field (zone c), clipped to content rect ---
  ctx.save();
  const c = { x0: plan.frame.contentInset, y0: plan.frame.contentInset, x1: width - plan.frame.contentInset, y1: height - plan.frame.contentInset };
  ctx.beginPath();
  ctx.rect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
  ctx.clip();
  strokeLayers(ctx, plan.layers.tint, plan.inkMain, plan.weightMultiplier);
  ctx.restore();

  // --- numeral ring + central rosette + corner rosettes ---
  strokeLayers(ctx, plan.layers.numeralRing, plan.inkMain, plan.weightMultiplier);
  strokeLayers(ctx, plan.layers.centralRosette, plan.inkMain, plan.weightMultiplier);
  strokeLayers(ctx, plan.layers.cornerRosettes, plan.inkMain, plan.weightMultiplier);

  // --- border band (zone b), clipped to band ring ---
  ctx.save();
  const b = { x0: plan.frame.innerInset, y0: plan.frame.innerInset, x1: width - plan.frame.innerInset, y1: height - plan.frame.innerInset };
  ctx.beginPath();
  ctx.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  ctx.rect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0); // evenodd punches this out of the band rect above
  ctx.clip('evenodd');
  strokeLayers(ctx, plan.layers.border, plan.inkMain, plan.weightMultiplier);
  ctx.restore();

  // --- double-rule outer frame ---
  ctx.strokeStyle = plan.inkMain;
  ctx.globalAlpha = 0.92;
  ctx.lineWidth = plan.frame.ruleWidth;
  ctx.strokeRect(plan.frame.outerInset, plan.frame.outerInset, width - plan.frame.outerInset * 2, height - plan.frame.outerInset * 2);
  ctx.lineWidth = plan.frame.ruleWidth * 0.72;
  ctx.strokeRect(plan.frame.innerInset, plan.frame.innerInset, width - plan.frame.innerInset * 2, height - plan.frame.innerInset * 2);
  ctx.globalAlpha = 1;

  // --- title (arched, per-glyph) ---
  ctx.font = fontString('title', plan.titleFontSize);
  ctx.fillStyle = plan.inkMain;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const g of plan.titleChars) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.rotate);
    ctx.fillText(g.ch, 0, 0);
    ctx.restore();
  }

  // --- other text runs ---
  for (const run of plan.texts) drawSpacedText(ctx, run);

  // --- SPECIMEN overprint (always on) ---
  ctx.save();
  ctx.translate(plan.specimen.centerX, plan.specimen.centerY);
  ctx.rotate(plan.specimen.rotate);
  ctx.font = fontString('title', plan.specimen.fontSize);
  ctx.fillStyle = plan.specimen.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const row of plan.specimen.rows) {
    drawSpacedText(ctx, {
      text: row.text,
      x: row.x,
      y: row.y,
      fontSize: plan.specimen.fontSize,
      font: 'title',
      color: plan.specimen.color,
      align: 'center',
      letterSpacing: plan.specimen.letterSpacing,
    });
  }
  ctx.restore();

  ctx.restore();
}
