import { ReceiptData } from './receiptData';
import { formatYen } from './pricing';
import { barcodeLayout } from './barcode';

const PAPER_WIDTH = 640;
const PAD_X = 46;
const ROW_HEIGHT = 34;
const TOOTH_WIDTH = 15;
const TOOTH_AMP = 7;
const BACKDROP_MARGIN = 72;
const EXPORT_SCALE = 3;

const COLOR = {
  ink: '#2b2620',
  inkSoft: '#726a58',
  paperTop: '#f4ecd9',
  paperBottom: '#e6dabf',
  gold: '#c9a34e',
  sale: '#8a352d',
  backdropCenter: '#1c1712',
  backdropEdge: '#050403',
};

function buildTornEdgePoints(
  width: number,
  baselineY: number,
  direction: 1 | -1,
): Array<[number, number]> {
  const teeth = Math.max(6, Math.round(width / TOOTH_WIDTH));
  const step = width / teeth;
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= teeth; i++) {
    const x = i * step;
    const isPeak = i % 2 === 0;
    const y = baselineY + (isPeak ? 0 : TOOTH_AMP * direction);
    points.push([x, y]);
  }
  return points;
}

function buildPaperPath(width: number, height: number): Path2D {
  const path = new Path2D();
  const top = buildTornEdgePoints(width, TOOTH_AMP, 1);
  const bottomBaseline = height - TOOTH_AMP;
  const bottom = buildTornEdgePoints(width, bottomBaseline, -1);

  path.moveTo(top[0][0], top[0][1]);
  for (const [x, y] of top) path.lineTo(x, y);
  const bottomReversed = [...bottom].reverse();
  for (const [x, y] of bottomReversed) path.lineTo(x, y);
  path.closePath();
  return path;
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = '…';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid) + ellipsis;
    if (ctx.measureText(candidate).width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo === 0 ? ellipsis : text.slice(0, lo) + ellipsis;
}

function drawDotLeader(
  ctx: CanvasRenderingContext2D,
  startX: number,
  endX: number,
  baselineY: number,
  color: string,
): void {
  if (endX <= startX) return;
  const spacing = 5.5;
  ctx.fillStyle = color;
  for (let x = startX; x <= endX; x += spacing) {
    ctx.beginPath();
    ctx.arc(x, baselineY - 3.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

function measureContentHeight(data: ReceiptData): number {
  let h = 0;
  h += 32; // top inner padding
  h += 40; // store name
  h += 22; // meta line
  h += 18; // divider gap
  h += data.lines.length * ROW_HEIGHT;
  h += 20; // divider gap
  h += 34; // total row
  h += 30; // footer line
  h += 56; // barcode block
  h += 30; // bottom inner padding
  return h;
}

/**
 * レシートの全内容を、ちぎれた縁とゴールドの装飾を持つ縦長 Canvas に描画する。
 * ライブプレビュー（DOM/CSS）と可能な限り同じ見た目になるよう、値・配色・配置ロジックを揃えている。
 */
export async function buildExportCanvas(data: ReceiptData): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const paperHeight = measureContentHeight(data);
  const canvasWidth = PAPER_WIDTH + BACKDROP_MARGIN * 2;
  const canvasHeight = paperHeight + BACKDROP_MARGIN * 2;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(canvasWidth * EXPORT_SCALE);
  canvas.height = Math.round(canvasHeight * EXPORT_SCALE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D コンテキストを取得できませんでした。');
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

  // --- 展示ケースを思わせる背景（スポットライト） ---
  const backdropGrad = ctx.createRadialGradient(
    canvasWidth / 2,
    canvasHeight * 0.4,
    canvasWidth * 0.08,
    canvasWidth / 2,
    canvasHeight * 0.4,
    canvasWidth * 0.9,
  );
  backdropGrad.addColorStop(0, COLOR.backdropCenter);
  backdropGrad.addColorStop(1, COLOR.backdropEdge);
  ctx.fillStyle = backdropGrad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // --- 紙をわずかに傾けて配置 ---
  ctx.save();
  ctx.translate(canvasWidth / 2, canvasHeight / 2);
  ctx.rotate(-0.011);
  ctx.translate(-PAPER_WIDTH / 2, -paperHeight / 2);

  const paperPath = buildPaperPath(PAPER_WIDTH, paperHeight);

  // 落ち影
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 26;
  const paperGrad = ctx.createLinearGradient(0, 0, 0, paperHeight);
  paperGrad.addColorStop(0, COLOR.paperTop);
  paperGrad.addColorStop(1, COLOR.paperBottom);
  ctx.fillStyle = paperGrad;
  ctx.fill(paperPath);
  ctx.restore();

  // 以降の描画は紙の形にクリップする
  ctx.save();
  ctx.clip(paperPath);

  // ごく薄い紙の粒状感
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = COLOR.ink;
  for (let i = 0; i < 260; i++) {
    const gx = (i * 197) % PAPER_WIDTH;
    const gy = (i * 83) % paperHeight;
    ctx.fillRect(gx, gy, 1, 1);
  }
  ctx.globalAlpha = 1;

  let cursorY = TOOTH_AMP + 30;
  const contentLeft = PAD_X;
  const contentRight = PAPER_WIDTH - PAD_X;
  const contentWidth = contentRight - contentLeft;

  // 店名（セリフ体）
  ctx.fillStyle = COLOR.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 26px "Zen Old Mincho", "Cormorant", serif';
  const storeNameFit = truncateToWidth(ctx, data.storeName, contentWidth);
  ctx.fillText(storeNameFit, PAPER_WIDTH / 2, cursorY);
  cursorY += 30;

  // 日時
  ctx.font = '13px "DotGothic16", monospace';
  ctx.fillStyle = COLOR.inkSoft;
  ctx.fillText(data.timestamp, PAPER_WIDTH / 2, cursorY);
  cursorY += 22;

  // 区切り線（点線）
  const drawDashedDivider = (y: number, color: string, width: number) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(contentLeft, y);
    ctx.lineTo(contentRight, y);
    ctx.stroke();
    ctx.restore();
  };
  drawDashedDivider(cursorY, COLOR.inkSoft, 1);
  cursorY += 20;

  // 品目行
  ctx.textAlign = 'left';
  for (const line of data.lines) {
    const baselineY = cursorY + ROW_HEIGHT * 0.62;

    let nameX = contentLeft;
    if (line.isSale) {
      ctx.font = '600 11px "DotGothic16", monospace';
      const tagText = '本日の特売';
      const tagPaddingX = 6;
      const tagWidth = ctx.measureText(tagText).width + tagPaddingX * 2;
      const tagHeight = 16;
      const tagY = baselineY - tagHeight + 3;
      ctx.fillStyle = COLOR.gold;
      ctx.fillRect(nameX, tagY, tagWidth, tagHeight);
      ctx.fillStyle = '#141110';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagText, nameX + tagPaddingX, tagY + tagHeight / 2 + 0.5);
      ctx.textBaseline = 'alphabetic';
      nameX += tagWidth + 8;
    }

    ctx.font = '16px "DotGothic16", monospace';
    ctx.fillStyle = COLOR.ink;

    // 価格側の幅を先に見積もる
    ctx.font = '16px "DotGothic16", monospace';
    const priceText = formatYen(line.price);
    let priceBlockText = priceText;
    let originalText = '';
    if (line.isSale && line.originalPrice !== undefined) {
      originalText = formatYen(line.originalPrice);
    }
    ctx.font = '13px "DotGothic16", monospace';
    const originalWidth = originalText ? ctx.measureText(originalText).width + 8 : 0;
    ctx.font = '16px "DotGothic16", monospace';
    const priceWidth = ctx.measureText(priceBlockText).width;
    const totalPriceWidth = originalWidth + priceWidth;

    const maxNameWidth = Math.max(24, contentRight - nameX - totalPriceWidth - 20);
    const nameFit = truncateToWidth(ctx, line.text, maxNameWidth);
    ctx.font = '16px "DotGothic16", monospace';
    ctx.fillStyle = COLOR.ink;
    ctx.fillText(nameFit, nameX, baselineY);
    const nameWidth = ctx.measureText(nameFit).width;

    const leaderStart = nameX + nameWidth + 6;
    const leaderEnd = contentRight - totalPriceWidth - 6;
    drawDotLeader(ctx, leaderStart, leaderEnd, baselineY, COLOR.inkSoft);

    let priceX = contentRight;
    ctx.textAlign = 'right';
    ctx.font = '16px "DotGothic16", monospace';
    ctx.fillStyle = COLOR.ink;
    ctx.fillText(priceBlockText, priceX, baselineY);
    priceX -= priceWidth;

    if (originalText) {
      priceX -= 8;
      ctx.font = '13px "DotGothic16", monospace';
      ctx.fillStyle = COLOR.sale;
      const ow = ctx.measureText(originalText).width;
      ctx.fillText(originalText, priceX, baselineY);
      ctx.beginPath();
      ctx.moveTo(priceX - ow, baselineY - 4.5);
      ctx.lineTo(priceX, baselineY - 4.5);
      ctx.strokeStyle = COLOR.sale;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.textAlign = 'left';

    cursorY += ROW_HEIGHT;
  }

  cursorY += 4;
  drawDashedDivider(cursorY, COLOR.inkSoft, 1);
  cursorY += 26;

  // ゴールドの罫線を上に持つ合計欄
  ctx.strokeStyle = COLOR.gold;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(contentLeft, cursorY - 20);
  ctx.lineTo(contentRight, cursorY - 20);
  ctx.stroke();

  ctx.font = 'italic 500 15px "Cormorant", "Zen Old Mincho", serif';
  ctx.fillStyle = COLOR.ink;
  ctx.textAlign = 'left';
  ctx.fillText(data.totalLabel, contentLeft, cursorY);

  ctx.font = '700 19px "DotGothic16", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(formatYen(data.total), contentRight, cursorY);
  ctx.textAlign = 'left';
  cursorY += 30;

  // フッター
  ctx.font = 'italic 13px "Cormorant", serif';
  ctx.fillStyle = COLOR.inkSoft;
  ctx.textAlign = 'center';
  ctx.fillText(data.footer, PAPER_WIDTH / 2, cursorY);
  ctx.textAlign = 'left';
  cursorY += 26;

  // バーコード（ゴールドインク）
  const barcodeHeight = 30;
  const barcodeWidth = contentWidth;
  const segments = barcodeLayout(data.barcodeSeed);
  ctx.fillStyle = COLOR.gold;
  for (const seg of segments) {
    ctx.fillRect(
      contentLeft + seg.offset * barcodeWidth,
      cursorY,
      Math.max(0.6, seg.width * barcodeWidth),
      barcodeHeight,
    );
  }
  cursorY += barcodeHeight + 14;

  ctx.font = '12px "DotGothic16", monospace';
  ctx.fillStyle = COLOR.inkSoft;
  ctx.textAlign = 'center';
  ctx.fillText(`No. ${data.receiptNo}`, PAPER_WIDTH / 2, cursorY);

  ctx.restore(); // clip
  ctx.restore(); // rotate/translate

  return canvas;
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNGの生成に失敗しました。'));
    }, 'image/png');
  });
}
