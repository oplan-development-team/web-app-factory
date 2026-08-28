/** Draws text curved along the top of a circle, reading left-to-right. */
export function drawArcTextTop(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  font: string,
  color: string,
  letterSpacing: number,
): void {
  if (!text) return;
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + letterSpacing);
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  const totalAngle = totalWidth / radius;
  ctx.translate(cx, cy);
  let angle = -totalAngle / 2;
  for (let i = 0; i < chars.length; i++) {
    const charAngle = widths[i] / radius;
    angle += charAngle / 2;
    ctx.save();
    ctx.rotate(angle);
    ctx.translate(0, -radius);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    angle += charAngle / 2;
  }
  ctx.restore();
}

/** Draws text curved along the bottom of a circle, still reading left-to-right (not mirrored). */
export function drawArcTextBottom(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  font: string,
  color: string,
  letterSpacing: number,
): void {
  if (!text) return;
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + letterSpacing);
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  const totalAngle = totalWidth / radius;
  ctx.translate(cx, cy);
  let angle = totalAngle / 2;
  for (let i = chars.length - 1; i >= 0; i--) {
    const charAngle = widths[i] / radius;
    angle -= charAngle / 2;
    ctx.save();
    ctx.rotate(angle);
    ctx.translate(0, radius);
    ctx.rotate(Math.PI);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    angle -= charAngle / 2;
  }
  ctx.restore();
}

/** Draws single-line text, shrinking the font size until it fits within maxWidth. */
export function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  startPx: number,
  minPx: number,
  fontFamily: string,
  fontWeight: string,
  color: string,
  letterSpacingEm: number,
): void {
  if (!text) return;
  let px = startPx;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let width = maxWidth + 1;
  while (px > minPx) {
    ctx.font = `${fontWeight} ${px}px ${fontFamily}`;
    width = measureWithSpacing(ctx, text, px * letterSpacingEm);
    if (width <= maxWidth) break;
    px -= 1;
  }
  ctx.fillStyle = color;
  drawSpacedText(ctx, text, cx, cy, px * letterSpacingEm);
}

function measureWithSpacing(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  const chars = [...text];
  let total = 0;
  for (const c of chars) total += ctx.measureText(c).width + spacing;
  return total - spacing;
}

function drawSpacedText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, spacing: number): void {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - totalWidth / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, cy);
    x += widths[i] + spacing;
  }
  ctx.textAlign = prevAlign;
}
