// Manual per-character text layout. Canvas's native fillText has no reliable
// cross-browser letter-spacing primitive, and the Blue Note look specifically
// depends on hand-tuned, often extreme tracking (sometimes stretched to span
// an exact measure). So every glyph is advanced by hand here instead of
// relying on any CSS/canvas letter-spacing shortcut.

export type Align = 'left' | 'center' | 'right';

function charWidths(ctx: CanvasRenderingContext2D, text: string): number[] {
  return [...text].map((ch) => ctx.measureText(ch).width);
}

export function naturalWidth(ctx: CanvasRenderingContext2D, text: string): number {
  return charWidths(ctx, text).reduce((a, b) => a + b, 0);
}

export function trackedWidth(ctx: CanvasRenderingContext2D, text: string, tracking: number): number {
  const widths = charWidths(ctx, text);
  if (widths.length === 0) return 0;
  return widths.reduce((a, b) => a + b, 0) + tracking * widths.length;
}

/**
 * Draws `text` left-to-right starting at (x, y) with a fixed extra gap
 * (`tracking`, in px) inserted after every glyph. Returns the total rendered
 * width so callers can lay out adjacent elements.
 */
export function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: Align = 'left',
): number {
  const widths = charWidths(ctx, text);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, widths.length - 1);
  let cursor = x;
  if (align === 'center') cursor = x - total / 2;
  if (align === 'right') cursor = x - total;

  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i]!, cursor, y);
    cursor += widths[i]! + tracking;
  }
  ctx.textAlign = prevAlign;
  return total;
}

/**
 * Solves for a (fontSize, tracking) pair so that `text`, set in the given
 * font family/weight, spans as close to `targetWidth` as possible via
 * per-character tracking rather than distorting the glyphs themselves.
 * Mirrors the Reid Miles habit of justifying a title to the exact width of
 * the layout block.
 */
export function fitTrackedToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  weight: number | string,
  targetWidth: number,
  opts: { baseSize: number; minSize: number; maxTrackingRatio?: number } = { baseSize: 96, minSize: 28 },
): { fontSize: number; tracking: number } {
  const maxTrackingRatio = opts.maxTrackingRatio ?? 0.85;
  let fontSize = opts.baseSize;
  ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
  let natural = naturalWidth(ctx, text);

  // Shrink the glyphs first if they don't even fit without extra tracking.
  // `minSize` is only the *preferred* floor for normal-length titles — very
  // long input (near the form's maxlength) is allowed to go below it, down
  // to a hard readability floor, so the render never overflows the canvas.
  if (natural > targetWidth * 0.98 && natural > 0) {
    const scale = (targetWidth * 0.98) / natural;
    const preferred = Math.max(opts.minSize, fontSize * scale);
    ctx.font = `${weight} ${preferred}px ${fontFamily}`;
    if (naturalWidth(ctx, text) > targetWidth * 0.98) {
      fontSize = Math.max(14, fontSize * scale);
    } else {
      fontSize = preferred;
    }
    ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
    natural = naturalWidth(ctx, text);
  }

  const gaps = Math.max(1, text.length - 1);
  let tracking = (targetWidth - natural) / gaps;
  const maxTracking = fontSize * maxTrackingRatio;
  if (tracking > maxTracking) tracking = maxTracking;
  if (tracking < 0) tracking = 0;

  return { fontSize, tracking };
}

/**
 * Trims `text` (appending an ellipsis) until it fits within `maxWidth` at
 * the current ctx.font + tracking. Used for list-style rows (track names)
 * where shrinking font size per-row would look inconsistent — truncation
 * reads more like a real printed tracklist running out of room.
 */
export function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, tracking: number, maxWidth: number): string {
  if (trackedWidth(ctx, text, tracking) <= maxWidth) return text;
  let end = text.length - 1;
  while (end > 0) {
    const candidate = `${text.slice(0, end).trimEnd()}…`;
    if (trackedWidth(ctx, candidate, tracking) <= maxWidth) return candidate;
    end -= 1;
  }
  return '…';
}

/**
 * Draws text rotated 90 degrees (reading bottom-to-top), used for the
 * vertical banner treatment in the circle-inset template.
 */
export function drawVerticalTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: Align = 'left',
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  drawTracked(ctx, text, 0, 0, tracking, align);
  ctx.restore();
}
