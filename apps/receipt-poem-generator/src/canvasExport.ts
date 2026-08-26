import type { AppState } from './types';
import { formatCaptionDate, formatReceiptStamp, formatYen, hashString, mulberry32 } from './util';

const PAPER_WIDTH = 400;
const TOOTH = 8; // 400 / 8 = 50 teeth exactly, keeps the zigzag edge clean
const TOP_PAD = 30;
const BOTTOM_PAD = 26;
const SIDE_PAD = 26;
const EXPORT_SCALE = 3; // "2x以上" required; 3x for crisp dot-matrix rendering

const PAPER_COLOR = '#FDFBF4';
const INK = '#2B2622';
const INK_MUTED = 'rgba(43, 38, 34, 0.55)';
const ACCENT = '#C23B22';

const MONO_FONT = 'DotGothic16';
const SERIF_FONT = '"Shippori Mincho"';

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function wrapByCharacter(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const ch of text) {
    const candidate = current + ch;
    if (ctx.measureText(candidate).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
      if (lines.length === maxLines - 1) {
        // Last allowed line: consume the remainder (truncated) and stop.
        const rest = text.slice(text.indexOf(current));
        lines.push(truncateToWidth(ctx, rest, maxWidth));
        return lines;
      }
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function drawDotLeader(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number): void {
  if (x2 - x1 < 4) return;
  ctx.save();
  ctx.strokeStyle = INK_MUTED;
  ctx.lineWidth = 1.1;
  ctx.setLineDash([1, 3]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function drawRule(ctx: CanvasRenderingContext2D, y: number, bold = false): void {
  ctx.save();
  ctx.strokeStyle = bold ? INK : INK_MUTED;
  ctx.lineWidth = bold ? 1.6 : 1;
  ctx.setLineDash(bold ? [] : [3, 3]);
  ctx.beginPath();
  ctx.moveTo(SIDE_PAD, y);
  ctx.lineTo(PAPER_WIDTH - SIDE_PAD, y);
  ctx.stroke();
  ctx.restore();
}

function drawBarcode(ctx: CanvasRenderingContext2D, y: number, seed: string): number {
  const x0 = SIDE_PAD;
  const width = PAPER_WIDTH - SIDE_PAD * 2;
  const barHeight = 30;
  const rand = mulberry32(hashString(seed));
  const barCount = 46;
  const unit = width / barCount;
  ctx.save();
  ctx.fillStyle = INK;
  let x = x0;
  for (let i = 0; i < barCount; i += 1) {
    const isBar = rand() > 0.42;
    const w = unit * (isBar ? 0.6 : 0.4);
    if (isBar) ctx.fillRect(x, y, w, barHeight);
    x += unit;
  }
  ctx.restore();
  return barHeight;
}

function barcodeNumber(seed: string): string {
  const h = hashString(seed);
  const digits = String(h).padStart(13, '0').slice(0, 13);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

/**
 * Draws the receipt content (header, items or poem lines, totals, barcode, footer) starting at
 * y = TOP_PAD, mirroring the structure built in `receiptRender.ts`. Returns the final y position
 * so the caller can size the paper background before re-running this on the real canvas.
 */
function drawContent(ctx: CanvasRenderingContext2D, state: AppState): number {
  const contentWidth = PAPER_WIDTH - SIDE_PAD * 2;
  let y = TOP_PAD;

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `700 17px ${MONO_FONT}`;
  y += 6;
  const storeName = truncateToWidth(ctx, state.storeName || '（無題の店）', contentWidth);
  ctx.fillText(storeName, PAPER_WIDTH / 2, y);
  y += 22;

  ctx.font = `12px ${MONO_FONT}`;
  ctx.fillStyle = INK_MUTED;

  if (state.poemMode) {
    ctx.fillText(formatCaptionDate(state.dateTimeLocal), PAPER_WIDTH / 2, y);
    y += 28;

    if (state.items.length === 0) {
      ctx.textAlign = 'left';
      ctx.font = `13px ${MONO_FONT}`;
      ctx.fillStyle = INK_MUTED;
      const lines = wrapByCharacter(ctx, 'まだ品目がありません。', contentWidth, 3);
      lines.forEach((line) => {
        ctx.fillText(line, SIDE_PAD, y);
        y += 20;
      });
      return y + 10;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    state.items.forEach((item) => {
      ctx.font = `500 22px ${SERIF_FONT}`;
      const lines = wrapByCharacter(ctx, item.name || '（無題の行）', contentWidth - 20, 2);
      lines.forEach((line) => {
        ctx.fillText(line, PAPER_WIDTH / 2, y);
        y += 30;
      });
      y += 14;
    });

    y += 10;
    ctx.font = `italic 12px ${MONO_FONT}`;
    ctx.fillStyle = INK_MUTED;
    const footerLines = wrapByCharacter(ctx, state.footerPhrase, contentWidth, 2);
    footerLines.forEach((line) => {
      ctx.fillText(line, PAPER_WIDTH / 2, y);
      y += 18;
    });
    return y;
  }

  const meta = `${formatReceiptStamp(state.dateTimeLocal)} ・ ${state.receiptNo}`;
  ctx.fillText(truncateToWidth(ctx, meta, contentWidth), PAPER_WIDTH / 2, y);
  y += 18;

  drawRule(ctx, y);
  y += 22;

  if (state.items.length === 0) {
    ctx.textAlign = 'left';
    ctx.font = `13px ${MONO_FONT}`;
    ctx.fillStyle = INK_MUTED;
    const lines = wrapByCharacter(
      ctx,
      'まだ品目がありません。左の原稿用紙に、詩の一行を書き足してください。',
      contentWidth,
      3,
    );
    lines.forEach((line) => {
      ctx.fillText(line, SIDE_PAD, y);
      y += 20;
    });
    return y + 10;
  }

  let subtotal = 0;
  state.items.forEach((item) => {
    const lineTotal = item.qty * item.unitPrice;
    subtotal += lineTotal;

    ctx.font = `14px ${MONO_FONT}`;
    ctx.fillStyle = INK;
    const amountText = formatYen(lineTotal);
    ctx.textAlign = 'right';
    const amountWidth = ctx.measureText(amountText).width;
    ctx.textAlign = 'left';
    const maxNameWidth = contentWidth - amountWidth - 24;
    const name = truncateToWidth(ctx, item.name || '（無題の品目）', maxNameWidth);
    const nameWidth = ctx.measureText(name).width;
    ctx.fillText(name, SIDE_PAD, y);

    ctx.textAlign = 'right';
    ctx.fillText(amountText, PAPER_WIDTH - SIDE_PAD, y);

    drawDotLeader(ctx, SIDE_PAD + nameWidth + 6, PAPER_WIDTH - SIDE_PAD - amountWidth - 6, y - 4);

    y += 18;
    ctx.font = `11px ${MONO_FONT}`;
    ctx.fillStyle = INK_MUTED;
    ctx.textAlign = 'left';
    ctx.fillText(`${formatYen(item.unitPrice)} × ${item.qty}`, SIDE_PAD + 4, y);
    y += 20;
  });

  drawRule(ctx, y);
  y += 22;

  ctx.font = `14px ${MONO_FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.fillText('小計', SIDE_PAD, y);
  ctx.textAlign = 'right';
  const subtotalText = formatYen(subtotal);
  ctx.fillText(subtotalText, PAPER_WIDTH - SIDE_PAD, y);
  const subtotalWidth = ctx.measureText(subtotalText).width;
  ctx.textAlign = 'left';
  const subtotalLabelWidth = ctx.measureText('小計').width;
  drawDotLeader(ctx, SIDE_PAD + subtotalLabelWidth + 6, PAPER_WIDTH - SIDE_PAD - subtotalWidth - 6, y - 4);
  y += 22;

  drawRule(ctx, y, true);
  y += 26;

  ctx.font = `700 16px ${MONO_FONT}`;
  ctx.fillStyle = ACCENT;
  ctx.textAlign = 'left';
  ctx.fillText(state.totalLabel, SIDE_PAD, y);
  ctx.textAlign = 'right';
  const totalText = formatYen(subtotal);
  ctx.fillText(totalText, PAPER_WIDTH - SIDE_PAD, y);
  y += 28;

  const seed = `${state.receiptNo}-${state.storeName}-${state.items.length}`;
  const barHeight = drawBarcode(ctx, y, seed);
  y += barHeight + 8;

  ctx.font = `11px ${MONO_FONT}`;
  ctx.fillStyle = INK_MUTED;
  ctx.textAlign = 'center';
  ctx.fillText(barcodeNumber(seed), PAPER_WIDTH / 2, y);
  y += 24;

  ctx.font = `13px ${MONO_FONT}`;
  ctx.fillStyle = INK;
  const footerLines = wrapByCharacter(ctx, state.footerPhrase, contentWidth, 2);
  footerLines.forEach((line) => {
    ctx.fillText(line, PAPER_WIDTH / 2, y);
    y += 20;
  });

  return y;
}

function drawPaperBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, TOOTH);
  for (let x = 0; x < width; x += TOOTH) {
    ctx.lineTo(x + TOOTH / 2, 0);
    ctx.lineTo(x + TOOTH, TOOTH);
  }
  ctx.lineTo(width, height - TOOTH);
  for (let x = width; x > 0; x -= TOOTH) {
    ctx.lineTo(x - TOOTH / 2, height);
    ctx.lineTo(x - TOOTH, height - TOOTH);
  }
  ctx.closePath();

  ctx.shadowColor = 'rgba(43, 38, 34, 0.32)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = PAPER_COLOR;
  ctx.fill();
  ctx.restore();
}

async function ensureFontsReady(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`700 17px ${MONO_FONT}`),
      document.fonts.load(`14px ${MONO_FONT}`),
      document.fonts.load(`500 22px ${SERIF_FONT}`),
      document.fonts.ready,
    ]);
  } catch {
    // If font loading APIs are unavailable, fall back to whatever is already loaded.
  }
}

export async function exportReceiptToPng(state: AppState): Promise<void> {
  await ensureFontsReady();

  // Pass 1: measure content height using a throwaway 1x1 canvas (fillText on it is harmless,
  // measureText works regardless of canvas size).
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = 1;
  measureCanvas.height = 1;
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) throw new Error('Canvas 2D コンテキストを取得できませんでした。');
  const contentHeight = drawContent(measureCtx, state);
  const totalHeight = Math.ceil(contentHeight + BOTTOM_PAD);

  // Pass 2: draw the background sized to fit, then re-run the same content drawing on top.
  const canvas = document.createElement('canvas');
  canvas.width = PAPER_WIDTH * EXPORT_SCALE;
  canvas.height = totalHeight * EXPORT_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D コンテキストを取得できませんでした。');
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
  drawPaperBackground(ctx, PAPER_WIDTH, totalHeight);
  drawContent(ctx, state);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
  if (!blob) throw new Error('PNGの書き出しに失敗しました。');

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const suffix = state.poemMode ? '_poem' : '';
  const filename = `receipt-poem_${stamp}${suffix}.png`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
