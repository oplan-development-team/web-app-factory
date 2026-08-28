/**
 * Canvas 2D は font-variant: small-caps を解釈しないため、
 * 小文字を大文字グリフの縮小版として自前描画する疑似スモールキャップス。
 */
export interface SmallCapsStyle {
  fontFamily: string;
  size: number;
  italic?: boolean;
  capsScale?: number; // 小文字を描く際の縮小率
  letterSpacing?: number;
  color: string;
  align?: "left" | "center";
}

function fontString(style: SmallCapsStyle, forLower: boolean): string {
  const size = forLower ? style.size * (style.capsScale ?? 0.74) : style.size;
  return `${style.italic ? "italic " : ""}${size}px "${style.fontFamily}"`;
}

export function measureSmallCaps(ctx: CanvasRenderingContext2D, text: string, style: SmallCapsStyle): number {
  const spacing = style.letterSpacing ?? 0;
  let total = 0;
  for (const ch of text) {
    const isLower = /[a-z]/.test(ch);
    ctx.font = fontString(style, isLower);
    total += ctx.measureText(ch.toUpperCase()).width + spacing;
  }
  return text.length > 0 ? total - spacing : 0;
}

export function drawSmallCaps(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: SmallCapsStyle,
): void {
  const spacing = style.letterSpacing ?? 0;
  const width = measureSmallCaps(ctx, text, style);
  let cx = style.align === "center" ? x - width / 2 : x;

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = style.color;
  for (const ch of text) {
    const isLower = /[a-z]/.test(ch);
    ctx.font = fontString(style, isLower);
    const glyph = ch.toUpperCase();
    ctx.fillText(glyph, cx, y);
    cx += ctx.measureText(glyph).width + spacing;
  }
}

/** レタースペースを効かせたトラッキング付きテキスト（通常の大文字/等幅ラベル用）。 */
export function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: {
    fontFamily: string;
    size: number;
    italic?: boolean;
    letterSpacing: number;
    color: string;
    align?: "left" | "center" | "right";
  },
): void {
  ctx.font = `${opts.italic ? "italic " : ""}${opts.size}px "${opts.fontFamily}"`;
  let width = 0;
  for (const ch of text) width += ctx.measureText(ch).width + opts.letterSpacing;
  width -= opts.letterSpacing;

  let cx = x;
  if (opts.align === "center") cx = x - width / 2;
  else if (opts.align === "right") cx = x - width;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = opts.color;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + opts.letterSpacing;
  }
}
