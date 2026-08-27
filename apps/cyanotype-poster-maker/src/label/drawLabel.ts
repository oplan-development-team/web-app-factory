import type { LabelFields } from '../types';
import type { Ctx2D } from '../core/ctx2d';
import { formatCoordinatePair } from './coordinates';

export interface LabelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SERIF = '"EB Garamond", Georgia, serif';
const MONO = '"Special Elite", "Courier New", monospace';

/**
 * 受入ラベルを描く（FR-402）。
 *
 * イタリックの学名 → 本文セリフの和名 → 罫 → スモールキャップスの産地 →
 * タイプライター体の台帳欄（日付 / 座標 / 標本番号）という 3 層の書体対比は、
 * 実際の標本シートが持つ「手書きと押印の混在」を写したもの。ここは意匠の
 * 中核なので、実装の都合で層を減らさない（NFR-006）。
 */
export function drawLabel(ctx: Ctx2D, rect: LabelRect, inkColor: string, fields: LabelFields): void {
  const padX = rect.x;
  const rightX = rect.x + rect.width;
  const centerX = rect.x + rect.width / 2;
  let cursorY = rect.y + rect.height * 0.16;

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = inkColor;

  // -- 学名: イタリックセリフ --
  const titleSize = Math.max(14, rect.height * 0.155);
  cursorY += titleSize * 0.72;
  drawFittedTitle(ctx, fields.title, padX, cursorY, rect.width, titleSize);

  // -- 和名・通称: 本文セリフ --
  const subtitleSize = Math.max(11, rect.height * 0.072);
  cursorY += subtitleSize * 1.6;
  if (fields.subtitle.trim()) {
    ctx.font = `400 ${subtitleSize}px ${SERIF}`;
    ctx.fillStyle = inkColor;
    ctx.textAlign = 'left';
    ctx.fillText(clampText(fields.subtitle, 60), padX, cursorY);
  }

  // -- 罫 --
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

  // -- 産地: スモールキャップス --
  cursorY += rect.height * 0.11;
  const localitySize = Math.max(11, rect.height * 0.062);
  ctx.font = `400 ${localitySize}px ${SERIF}`;
  const caps = ctx as Ctx2D & { fontVariantCaps?: string };
  const supportsSmallCaps = 'fontVariantCaps' in ctx;
  if (supportsSmallCaps) caps.fontVariantCaps = 'small-caps';
  ctx.fillStyle = inkColor;
  ctx.textAlign = 'left';
  ctx.fillText(clampText(fields.locality.trim() || 'Locality not recorded', 70), padX, cursorY);
  if (supportsSmallCaps) caps.fontVariantCaps = 'normal';

  // -- 台帳欄の見出し --
  cursorY += rect.height * 0.155;
  const monoSize = Math.max(9.5, rect.height * 0.05);
  ctx.font = `400 ${monoSize * 0.72}px ${MONO}`;
  ctx.globalAlpha = 0.6;
  ctx.textAlign = 'left';
  ctx.fillText('DATE', padX, cursorY);
  ctx.textAlign = 'center';
  ctx.fillText('COORDINATES', centerX, cursorY);
  ctx.textAlign = 'right';
  ctx.fillText('SPECIMEN NO.', rightX, cursorY);
  ctx.globalAlpha = 1;

  // -- 台帳欄の値 --
  cursorY += monoSize * 1.3;
  ctx.font = `400 ${monoSize}px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText(formatDate(fields.date), padX, cursorY);
  ctx.textAlign = 'center';
  ctx.fillText(formatCoordinatePair(fields.lat, fields.lon), centerX, cursorY);
  ctx.textAlign = 'right';
  ctx.fillText(clampText(fields.specimenNo.trim() || '—', 22), rightX, cursorY);
  ctx.textAlign = 'left';
}

/** 幅に収まるまで字送りを詰める。 */
function drawFittedTitle(
  ctx: Ctx2D,
  rawText: string,
  x: number,
  y: number,
  maxWidth: number,
  baseSize: number,
): void {
  const value = clampText(rawText.trim() || 'Herbarium Specimen', 80);
  let size = baseSize;
  ctx.font = `italic 500 ${size}px ${SERIF}`;
  while (ctx.measureText(value).width > maxWidth && size > baseSize * 0.5) {
    size -= 1;
    ctx.font = `italic 500 ${size}px ${SERIF}`;
  }
  ctx.textAlign = 'left';
  ctx.fillText(value, x, y);
}

export function clampText(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/** 未入力は伏字で埋め、レイアウトを崩さない（FR-403）。 */
export function formatDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return '----.--.--';
  return value.trim().replaceAll('-', '.');
}
