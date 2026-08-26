import type { LabelFields } from '../types';

export interface LabelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Renders the herbarium accession label onto the canvas: an italic
 * scientific-name title, a plain-serif common-name subrow, a rule,
 * a small-caps locality line, and a typewriter-mono ledger row for
 * date / coordinates / specimen number. Three deliberate type layers
 * echoing a real specimen sheet's mix of hand-lettering and stamped
 * fields.
 */
export function drawLabel(ctx: CanvasRenderingContext2D, rect: LabelRect, inkColor: string, fields: LabelFields): void {
  const padX = rect.x;
  const rightX = rect.x + rect.width;
  const centerX = rect.x + rect.width / 2;
  let cursorY = rect.y + rect.height * 0.16;

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = inkColor;

  // -- Title: italic serif, scientific-name register --
  const titleSize = Math.max(14, rect.height * 0.155);
  cursorY += titleSize * 0.72;
  drawFittedTitle(ctx, fields.title, padX, cursorY, rect.width, titleSize);

  // -- Subtitle: plain serif --
  const subtitleSize = Math.max(11, rect.height * 0.072);
  cursorY += subtitleSize * 1.6;
  if (fields.subtitle.trim()) {
    ctx.font = `400 ${subtitleSize}px "EB Garamond", Georgia, serif`;
    ctx.fillStyle = inkColor;
    ctx.textAlign = 'left';
    ctx.fillText(clampText(fields.subtitle, 60), padX, cursorY);
  }

  // -- Divider rule --
  cursorY += rect.height * 0.1;
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = inkColor;
  ctx.lineWidth = Math.max(1, rect.width * 0.0016);
  ctx.beginPath();
  ctx.moveTo(padX, cursorY);
  ctx.lineTo(rightX, cursorY);
  ctx.stroke();
  ctx.restore();

  // -- Locality: small-caps serif --
  cursorY += rect.height * 0.11;
  const localitySize = Math.max(11, rect.height * 0.062);
  ctx.font = `400 ${localitySize}px "EB Garamond", Georgia, serif`;
  const supportsSmallCaps = 'fontVariantCaps' in ctx;
  const canvasCtx = ctx as CanvasRenderingContext2D & { fontVariantCaps?: string };
  if (supportsSmallCaps) canvasCtx.fontVariantCaps = 'small-caps';
  ctx.fillStyle = inkColor;
  ctx.textAlign = 'left';
  ctx.fillText(clampText(fields.locality.trim() || 'Locality not recorded', 70), padX, cursorY);
  if (supportsSmallCaps) canvasCtx.fontVariantCaps = 'normal';

  // -- Mono ledger field labels --
  cursorY += rect.height * 0.155;
  const monoSize = Math.max(9.5, rect.height * 0.05);
  const fieldLabelSize = monoSize * 0.72;
  ctx.font = `400 ${fieldLabelSize}px "Special Elite", "Courier New", monospace`;
  ctx.globalAlpha = 0.6;
  ctx.textAlign = 'left';
  ctx.fillText('DATE', padX, cursorY);
  ctx.textAlign = 'center';
  ctx.fillText('COORDINATES', centerX, cursorY);
  ctx.textAlign = 'right';
  ctx.fillText('SPECIMEN NO.', rightX, cursorY);
  ctx.globalAlpha = 1;

  // -- Mono ledger values --
  cursorY += monoSize * 1.3;
  ctx.font = `400 ${monoSize}px "Special Elite", "Courier New", monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(formatDate(fields.date), padX, cursorY);
  ctx.textAlign = 'center';
  ctx.fillText(formatCoords(fields.lat, fields.lon), centerX, cursorY);
  ctx.textAlign = 'right';
  ctx.fillText(clampText(fields.specimenNo.trim() || '—', 22), rightX, cursorY);
  ctx.textAlign = 'left';
}

function drawFittedTitle(
  ctx: CanvasRenderingContext2D,
  rawText: string,
  x: number,
  y: number,
  maxWidth: number,
  baseSize: number,
): void {
  const value = clampText(rawText.trim() || 'Herbarium Specimen', 80);
  let size = baseSize;
  ctx.font = `italic 500 ${size}px "EB Garamond", Georgia, serif`;
  while (ctx.measureText(value).width > maxWidth && size > baseSize * 0.5) {
    size -= 1;
    ctx.font = `italic 500 ${size}px "EB Garamond", Georgia, serif`;
  }
  ctx.textAlign = 'left';
  ctx.fillText(value, x, y);
}

function clampText(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function formatDate(value: string): string {
  if (!value) return '----.--.--';
  return value.replaceAll('-', '.');
}

function formatCoords(lat: string, lon: string): string {
  const latNum = Number(lat);
  const lonNum = Number(lon);
  const latStr = lat.trim() && Number.isFinite(latNum) ? `${Math.abs(latNum).toFixed(4)}°${latNum >= 0 ? 'N' : 'S'}` : '--.----°';
  const lonStr = lon.trim() && Number.isFinite(lonNum) ? `${Math.abs(lonNum).toFixed(4)}°${lonNum >= 0 ? 'E' : 'W'}` : '--.----°';
  return `${latStr}, ${lonStr}`;
}
