import { AppState, LayoutPreset, ShapeKind } from '../types';

export const DISPLAY_FONT_FAMILY = 'Anton';
export const DISPLAY_FONT = `'${DISPLAY_FONT_FAMILY}', 'Impact', 'Haettenschweiler', 'Arial Narrow Bold', sans-serif`;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  align: CanvasTextAlign;
}

function shapePath(shape: ShapeKind, layout: LayoutPreset, w: number, h: number): ((ctx: CanvasRenderingContext2D) => void) | null {
  if (shape === 'none') return null;

  if (shape === 'circle') {
    let cx = w * 0.5;
    let cy = h * 0.42;
    let r = Math.min(w, h) * 0.34;
    if (layout === 'diagonal') {
      cx = w * 0.82;
      cy = h * 0.24;
      r = Math.min(w, h) * 0.3;
    } else if (layout === 'stamp') {
      cx = w * 0.86;
      cy = h * 0.15;
      r = Math.min(w, h) * 0.12;
    }
    return (ctx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    };
  }

  if (shape === 'band') {
    return (ctx) => {
      ctx.save();
      if (layout === 'center') {
        ctx.fillRect(0, h * 0.46, w, h * 0.2);
      } else if (layout === 'diagonal') {
        ctx.translate(w * 0.5, h * 0.5);
        ctx.rotate((-18 * Math.PI) / 180);
        ctx.fillRect(-w * 0.8, -h * 0.11, w * 1.6, h * 0.22);
      } else {
        ctx.fillRect(0, h * 0.64, w, h * 0.32);
      }
      ctx.restore();
    };
  }

  // triangle
  return (ctx) => {
    ctx.beginPath();
    if (layout === 'center') {
      ctx.moveTo(w * 0.5, h * 0.12);
      ctx.lineTo(w * 0.86, h * 0.6);
      ctx.lineTo(w * 0.14, h * 0.6);
    } else if (layout === 'diagonal') {
      ctx.moveTo(w * 1.0, 0);
      ctx.lineTo(w * 1.0, h * 0.52);
      ctx.lineTo(w * 0.52, 0);
    } else {
      ctx.moveTo(w * 0.06, h * 0.06);
      ctx.lineTo(w * 0.24, h * 0.06);
      ctx.lineTo(w * 0.06, h * 0.24);
    }
    ctx.closePath();
    ctx.fill();
  };
}

function boxesFor(layout: LayoutPreset, w: number, h: number): { heading: Box; subtext: Box } {
  if (layout === 'diagonal') {
    return {
      heading: { x: w * 0.08, y: h * 0.1, w: w * 0.62, h: h * 0.34, align: 'left' },
      subtext: { x: w * 0.28, y: h * 0.8, w: w * 0.64, h: h * 0.12, align: 'right' },
    };
  }
  if (layout === 'stamp') {
    return {
      heading: { x: w * 0.06, y: h * 0.68, w: w * 0.88, h: h * 0.24, align: 'center' },
      subtext: { x: w * 0.08, y: h * 0.06, w: w * 0.55, h: h * 0.1, align: 'left' },
    };
  }
  return {
    heading: { x: w * 0.1, y: h * 0.4, w: w * 0.8, h: h * 0.28, align: 'center' },
    subtext: { x: w * 0.15, y: h * 0.7, w: w * 0.7, h: h * 0.1, align: 'center' },
  };
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (para.trim() === '') {
      lines.push('');
      continue;
    }
    const hasSpaces = /\s/.test(para.trim());
    if (hasSpaces) {
      const words = para.split(/\s+/).filter(Boolean);
      let current = words[0];
      for (let i = 1; i < words.length; i++) {
        const test = `${current} ${words[i]}`;
        if (ctx.measureText(test).width <= maxWidth) {
          current = test;
        } else {
          lines.push(current);
          current = words[i];
        }
      }
      lines.push(current);
    } else {
      // No whitespace (typical for Japanese headings) — wrap per character.
      const chars = Array.from(para);
      let current = chars[0] ?? '';
      for (let i = 1; i < chars.length; i++) {
        const test = current + chars[i];
        if (ctx.measureText(test).width <= maxWidth) {
          current = test;
        } else {
          lines.push(current);
          current = chars[i];
        }
      }
      lines.push(current);
    }
  }
  return lines;
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: Box,
  maxFont: number,
  minFont: number,
  maxLines: number,
): { fontSize: number; lines: string[] } {
  let fontSize = maxFont;
  while (fontSize >= minFont) {
    ctx.font = `${fontSize}px ${DISPLAY_FONT}`;
    const lines = wrapLines(ctx, text, box.w);
    const lineHeight = fontSize * 0.92;
    const fitsWidth = lines.every((l) => ctx.measureText(l).width <= box.w);
    const fitsHeight = lines.length * lineHeight <= box.h;
    const fitsLineCount = lines.length <= maxLines;
    if (fitsWidth && fitsHeight && fitsLineCount) {
      return { fontSize, lines };
    }
    fontSize -= 2;
  }
  ctx.font = `${minFont}px ${DISPLAY_FONT}`;
  const lines = wrapLines(ctx, text, box.w).slice(0, maxLines);
  return { fontSize: minFont, lines };
}

// Text and shape accents are assigned to the SAME single ink plate (see
// requirements), which means a headline sitting on top of its own shape
// accent would otherwise be nearly invisible (identical ink color both
// places). A light paper-toned knockout outline keeps text legible in that
// overlap — this also reads as an intentional print "choke" edge rather than
// a workaround, which fits the medium.
const TEXT_OUTLINE_COLOR = '#F4EFDE';

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: Box,
  maxFont: number,
  minFont: number,
  maxLines: number,
  withOutline: boolean,
): void {
  if (!text.trim()) return;
  const upper = text.toUpperCase();
  const { fontSize, lines } = fitText(ctx, upper, box, maxFont, minFont, maxLines);
  ctx.font = `${fontSize}px ${DISPLAY_FONT}`;
  ctx.textAlign = box.align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.5, fontSize * 0.14);
  ctx.strokeStyle = TEXT_OUTLINE_COLOR;
  const lineHeight = fontSize * 0.92;
  const totalHeight = lines.length * lineHeight;
  let y = box.y + (box.h - totalHeight) / 2 + fontSize * 0.78;
  const x = box.align === 'left' ? box.x : box.align === 'right' ? box.x + box.w : box.x + box.w / 2;
  for (const line of lines) {
    if (withOutline) ctx.strokeText(line, x, y);
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
}

/**
 * Draws the flat (non-halftoned) text + shape layer for the plate that owns
 * text/shape ink. Shape and text are first composited at full opacity onto
 * an offscreen buffer, then that buffer is drawn onto `ctx` with a single
 * globalAlpha pass. Filling shape and text as two separate alpha<1 layers
 * would double up their opacity wherever they overlap (e.g. a headline
 * sitting on its own shape accent) — after multiply-compositing plates onto
 * the master canvas, that shows up as a visible seam exactly along the
 * overlap boundary. Compositing once, as a flattened unit, avoids it.
 */
export function drawFlatContent(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: AppState,
  color: string,
  alpha = 0.94,
  withOutline = true,
): void {
  const buffer = document.createElement('canvas');
  buffer.width = w;
  buffer.height = h;
  const bctx = buffer.getContext('2d');
  if (!bctx) return;

  bctx.fillStyle = color;
  const shape = shapePath(state.shape, state.layout, w, h);
  if (shape) shape(bctx);
  const boxes = boxesFor(state.layout, w, h);
  drawTextBlock(bctx, state.heading, boxes.heading, Math.round(h * 0.16), Math.round(h * 0.035), 2, withOutline);
  drawTextBlock(bctx, state.subtext, boxes.subtext, Math.round(h * 0.05), Math.round(h * 0.018), 2, withOutline);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(buffer, 0, 0);
  ctx.restore();
}

/** Solid-black silhouette of the text/shape layer, used to suppress photo dots underneath it. */
export function buildContentMask(w: number, h: number, state: AppState): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) drawFlatContent(ctx, w, h, state, '#000000', 1, false);
  return canvas;
}
