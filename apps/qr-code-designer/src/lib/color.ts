import type { PaintMode } from './options';
import type { Paint } from './types';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Returns a canonical `#rrggbb` string, or `null` when the input is not a hex colour. */
export function normalizeHex(input: string): string | null {
  const trimmed = input.trim();
  const match = HEX_PATTERN.exec(trimmed);
  if (!match) return null;

  const body = match[1].toLowerCase();
  const full =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body;
  return `#${full}`;
}

export function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex) ?? '#000000';
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

/** WCAG 2.x relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number): number => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/** Every colour a paint can put on screen. */
export function paintStops(paint: Paint): string[] {
  return paint.kind === 'solid' ? [paint.color] : [paint.from, paint.to];
}

export function paintLuminance(paint: Paint): number {
  const stops = paintStops(paint);
  return stops.reduce((sum, stop) => sum + relativeLuminance(stop), 0) / stops.length;
}

/**
 * Worst pairing between two paints. A gradient is only as scannable as its
 * weakest stop, so the minimum is what matters.
 */
export function worstContrast(foreground: Paint, background: Paint): number {
  let worst = Number.POSITIVE_INFINITY;
  for (const fg of paintStops(foreground)) {
    for (const bg of paintStops(background)) {
      worst = Math.min(worst, contrastRatio(fg, bg));
    }
  }
  return worst;
}

/**
 * SVG `linearGradient` endpoints in objectBoundingBox units.
 * Angle 0 runs left-to-right and increases clockwise.
 */
export function gradientVector(angle: number): { x1: number; y1: number; x2: number; y2: number } {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad) / 2;
  const dy = Math.sin(rad) / 2;
  return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy };
}

export const DEFAULT_GRADIENT_ANGLE = 135;

/**
 * Switch a paint between solid and gradient without a visual jump: the existing
 * colours carry across, so toggling modes never discards the user's choices.
 */
export function convertPaint(paint: Paint, mode: PaintMode): Paint {
  if (paint.kind === mode) return paint;
  const [first, second] = paintStops(paint);
  const from = first;
  const to = second ?? first;

  switch (mode) {
    case 'solid':
      return { kind: 'solid', color: from };
    case 'linear':
      return { kind: 'linear', from, to, angle: DEFAULT_GRADIENT_ANGLE };
    case 'radial':
      return { kind: 'radial', from, to };
  }
}

/** CSS equivalent of a paint, for swatches and previews. */
export function paintToCss(paint: Paint | null): string {
  if (!paint) return 'transparent';
  switch (paint.kind) {
    case 'solid':
      return paint.color;
    case 'linear':
      // CSS measures 0deg as "to top"; ours measures it as "to right".
      return `linear-gradient(${paint.angle + 90}deg, ${paint.from}, ${paint.to})`;
    case 'radial':
      return `radial-gradient(circle at 50% 50%, ${paint.from}, ${paint.to})`;
  }
}
