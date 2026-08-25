import { rgba } from "../core/palette";
import type { Ctx2D } from "./types";

export const CAPTION_EYEBROW = "S I G N E D";

/** Gold used for the hairline and eyebrow, matching the UI accent. */
const GOLD = "#c9a24b";
const PEARL = "#f4efe4";

/** Every measurement is a fraction of the poster width, so all export sizes match. */
const SCRIM_HEIGHT_RATIO = 0.16;
const HAIRLINE_WIDTH_RATIO = 0.18;
const EYEBROW_SIZE_RATIO = 0.014;
const SIGNATURE_SIZE_RATIO = 0.028;
const SIGNATURE_MAX_WIDTH_RATIO = 0.8;
const MIN_FONT_SCALE = 0.55;
const FONT_SHRINK_STEP = 0.05;

export interface CaptionOptions {
  readonly width: number;
  readonly height: number;
  readonly backgroundHex: string;
  readonly text: string;
}

export interface FittedCaption {
  readonly text: string;
  readonly fontSize: number;
}

/**
 * Shrinks the signature line until it fits the available width, and only
 * truncates once the smallest allowed size still overflows (FR-007.5).
 */
export function fitCaption(
  ctx: Ctx2D,
  text: string,
  baseSize: number,
  maxWidth: number,
  font: (size: number) => string
): FittedCaption {
  let size = baseSize;
  const minSize = baseSize * MIN_FONT_SCALE;

  while (size > minSize) {
    ctx.font = font(size);
    if (ctx.measureText(text).width <= maxWidth) {
      return { text, fontSize: size };
    }
    size = Math.max(minSize, size - baseSize * FONT_SHRINK_STEP);
  }

  ctx.font = font(size);
  if (ctx.measureText(text).width <= maxWidth) {
    return { text, fontSize: size };
  }

  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return { text: `${truncated}…`, fontSize: size };
}

/**
 * Burns the gallery-placard caption into the bottom of the poster: a scrim that
 * fades the artwork out, a gold hairline, the SIGNED eyebrow and the signature
 * line. Draws nothing at all when there is no caption (FR-007.4).
 */
export function drawCaption(ctx: Ctx2D, options: CaptionOptions): void {
  const { width, height, backgroundHex } = options;
  const text = options.text.trim();
  if (text.length === 0) {
    return;
  }

  const scrimHeight = height * SCRIM_HEIGHT_RATIO;
  const scrimTop = height - scrimHeight;

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  const gradient = ctx.createLinearGradient(0, scrimTop, 0, height);
  gradient.addColorStop(0, rgba(backgroundHex, 0));
  gradient.addColorStop(0.55, rgba(backgroundHex, 0.85));
  gradient.addColorStop(1, rgba(backgroundHex, 0.97));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, scrimTop, width, scrimHeight);

  const hairlineY = height - scrimHeight * 0.42;
  const hairlineWidth = width * HAIRLINE_WIDTH_RATIO;
  ctx.strokeStyle = rgba(GOLD, 0.75);
  ctx.lineWidth = Math.max(1, width * 0.0011);
  ctx.beginPath();
  ctx.moveTo(width / 2 - hairlineWidth / 2, hairlineY);
  ctx.lineTo(width / 2 + hairlineWidth / 2, hairlineY);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = rgba(GOLD, 0.85);
  ctx.font = `500 ${Math.round(width * EYEBROW_SIZE_RATIO)}px "Cormorant Garamond", serif`;
  ctx.fillText(CAPTION_EYEBROW, width / 2, hairlineY - scrimHeight * 0.12);

  const baseSize = Math.round(width * SIGNATURE_SIZE_RATIO);
  const signatureFont = (size: number): string =>
    `italic 500 ${Math.round(size)}px "Playfair Display", serif`;
  const fitted = fitCaption(
    ctx,
    text,
    baseSize,
    width * SIGNATURE_MAX_WIDTH_RATIO,
    signatureFont
  );

  ctx.fillStyle = PEARL;
  ctx.font = signatureFont(fitted.fontSize);
  ctx.fillText(fitted.text, width / 2, hairlineY + scrimHeight * 0.34);
}
