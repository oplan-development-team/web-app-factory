import type { GeneratedCaption } from './types';

const COLORS = {
  bg: '#0d0c0a',
  bgEdge: '#050403',
  spotlight: 'rgba(255, 246, 224, 0.16)',
  ink: '#e8e2d5',
  inkMuted: '#9c9384',
  brass: '#b08d57',
  brassLight: '#d9b98a',
  brassDark: '#7a5f38',
  plateBg: '#f2e8d6',
  plateBg2: '#e9dcc2',
  plateInk: '#241d13',
  plateInkMuted: '#5b4b30',
} as const;

const CANVAS_WIDTH = 1080;
const OUTER_PADDING = 56;
const IMAGE_MAX_HEIGHT = 640;
const PLATE_PADDING_X = 56;
const PLATE_PADDING_Y = 48;

const FONT_DISPLAY = '"Playfair Display", "Noto Serif JP", serif';
const FONT_BODY = '"Noto Serif JP", "Playfair Display", serif';

async function ensureFontsReady(): Promise<void> {
  const specs = [
    '600 44px "Playfair Display"',
    'italic 600 44px "Playfair Display"',
    '400 24px "Noto Serif JP"',
    '500 24px "Noto Serif JP"',
    '700 24px "Noto Serif JP"',
  ];
  await Promise.all(specs.map((spec) => document.fonts.load(spec)));
  await document.fonts.ready;
}

function fillTextSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: 'left' | 'center' = 'left',
): void {
  const chars = Array.from(text);
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((sum, w) => sum + w, 0) + spacing * Math.max(0, chars.length - 1);
  let cursorX = align === 'center' ? x - total / 2 : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cursorX, y);
    cursorX += widths[i] + spacing;
  });
  ctx.textAlign = prevAlign;
}

/** 日本語混じりのテキストを、単語単位ではなく文字単位で幅に収まるよう折り返す。 */
function wrapTextByChar(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const noLineStart = new Set(['、', '。', '」', '』', '）', '、', '.', ',', ')']);
  const lines: string[] = [];
  let current = '';

  for (const ch of Array.from(text)) {
    const tentative = current + ch;
    if (ctx.measureText(tentative).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
    } else {
      current = tentative;
    }
  }
  if (current) lines.push(current);

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.length > 0 && noLineStart.has(line[0])) {
      lines[i - 1] += line[0];
      lines[i] = line.slice(1);
    }
  }
  return lines.filter((l) => l.length > 0);
}

function createGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const size = 96;
  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = size;
  noiseCanvas.height = size;
  const nctx = noiseCanvas.getContext('2d');
  if (!nctx) return null;
  const imageData = nctx.createImageData(size, size);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
    imageData.data[i + 3] = Math.random() * 40;
  }
  nctx.putImageData(imageData, 0, 0);
  return ctx.createPattern(noiseCanvas, 'repeat');
}

function drawDoubleBorder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.strokeStyle = COLORS.brass;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.strokeStyle = COLORS.brassDark;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
}

interface PlateLayout {
  lines: string[];
  height: number;
}

function measurePlate(ctx: CanvasRenderingContext2D, caption: GeneratedCaption, plateWidth: number): PlateLayout {
  const contentWidth = plateWidth - PLATE_PADDING_X * 2;

  ctx.font = `italic 700 40px ${FONT_DISPLAY}`;
  const titleLines = wrapTextByChar(ctx, caption.title, contentWidth);

  ctx.font = `400 17px ${FONT_BODY}`;
  const bodyLines = wrapTextByChar(ctx, caption.body, contentWidth);

  const titleLineHeight = 50;
  const bodyLineHeight = 30;

  const height =
    PLATE_PADDING_Y +
    titleLines.length * titleLineHeight +
    18 + // artist
    30 + // meta row
    30 + // dimensions
    28 + // divider gap
    bodyLines.length * bodyLineHeight +
    PLATE_PADDING_Y;

  return { lines: [...titleLines, ...bodyLines], height };
}

/**
 * プレビュー全体（展示写真＋美術館プレート）を 1 枚の PNG として合成する。
 * 外部ライブラリは使わず、Canvas 2D API のみで描画する。
 */
export async function renderExportCanvas(
  image: HTMLImageElement,
  caption: GeneratedCaption,
): Promise<HTMLCanvasElement> {
  await ensureFontsReady();

  const scratch = document.createElement('canvas').getContext('2d');
  if (!scratch) throw new Error('Canvas 2D コンテキストを取得できませんでした。');

  const plateWidth = CANVAS_WIDTH - OUTER_PADDING * 2;

  // --- 画像描画サイズを計算 ---
  const naturalW = image.naturalWidth || 1;
  const naturalH = image.naturalHeight || 1;
  const maxImgWidth = CANVAS_WIDTH - OUTER_PADDING * 2;
  const scale = Math.min(maxImgWidth / naturalW, IMAGE_MAX_HEIGHT / naturalH, 1);
  const imgW = naturalW * scale;
  const imgH = naturalH * scale;

  const topLabelHeight = 70;
  const imageAreaTop = topLabelHeight;
  const imageAreaHeight = Math.max(imgH, 220) + 40;
  const plateTop = imageAreaTop + imageAreaHeight + 36;

  scratch.font = `italic 700 40px ${FONT_DISPLAY}`;
  const plateLayout = measurePlate(scratch, caption, plateWidth);

  const canvasHeight = plateTop + plateLayout.height + OUTER_PADDING;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D コンテキストを取得できませんでした。');

  // --- 背景（ギャラリーの壁） ---
  const bgGradient = ctx.createRadialGradient(
    CANVAS_WIDTH / 2,
    canvasHeight * 0.25,
    canvasHeight * 0.1,
    CANVAS_WIDTH / 2,
    canvasHeight * 0.5,
    canvasHeight * 0.9,
  );
  bgGradient.addColorStop(0, COLORS.bg);
  bgGradient.addColorStop(1, COLORS.bgEdge);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight);

  // --- 上部ラベル ---
  ctx.fillStyle = COLORS.brass;
  ctx.font = `500 13px ${FONT_BODY}`;
  fillTextSpaced(ctx, 'ARCHIVE OF IMAGINARY WORKS', CANVAS_WIDTH / 2, 40, 4, 'center');

  // --- スポットライト ---
  const spotlight = ctx.createRadialGradient(
    CANVAS_WIDTH / 2,
    imageAreaTop - 40,
    10,
    CANVAS_WIDTH / 2,
    imageAreaTop + imageAreaHeight * 0.4,
    imageAreaHeight * 1.1,
  );
  spotlight.addColorStop(0, COLORS.spotlight);
  spotlight.addColorStop(1, 'rgba(255, 246, 224, 0)');
  ctx.fillStyle = spotlight;
  ctx.fillRect(0, 0, CANVAS_WIDTH, imageAreaTop + imageAreaHeight);

  // --- 展示写真 ---
  const imgX = (CANVAS_WIDTH - imgW) / 2;
  const imgY = imageAreaTop + (imageAreaHeight - imgH) / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 18;
  ctx.drawImage(image, imgX, imgY, imgW, imgH);
  ctx.restore();

  // --- プレート ---
  const plateX = OUTER_PADDING;
  const plateY = plateTop;
  const plateH = plateLayout.height;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  const plateGradient = ctx.createLinearGradient(plateX, plateY, plateX, plateY + plateH);
  plateGradient.addColorStop(0, COLORS.plateBg);
  plateGradient.addColorStop(1, COLORS.plateBg2);
  ctx.fillStyle = plateGradient;
  ctx.fillRect(plateX, plateY, plateWidth, plateH);
  ctx.restore();

  const grain = createGrainPattern(ctx);
  if (grain) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = grain;
    ctx.fillRect(plateX, plateY, plateWidth, plateH);
    ctx.restore();
  }

  drawDoubleBorder(ctx, plateX, plateY, plateWidth, plateH);

  // --- プレート内テキスト ---
  const contentX = plateX + PLATE_PADDING_X;
  const contentWidth = plateWidth - PLATE_PADDING_X * 2;
  let cursorY = plateY + PLATE_PADDING_Y + 4;

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.plateInk;
  ctx.font = `italic 700 40px ${FONT_DISPLAY}`;
  const titleLines = wrapTextByChar(ctx, caption.title, contentWidth);
  const titleLineHeight = 50;
  titleLines.forEach((line) => {
    cursorY += titleLineHeight - 20;
    ctx.fillText(line, contentX, cursorY);
    cursorY += 20;
  });

  cursorY += 20;
  ctx.fillStyle = COLORS.plateInkMuted;
  ctx.font = `600 15px ${FONT_BODY}`;
  fillTextSpaced(ctx, caption.artist, contentX, cursorY, 2.5, 'left');

  cursorY += 30;
  ctx.font = `400 13px ${FONT_BODY}`;
  fillTextSpaced(ctx, `${caption.year}　／　${caption.medium}`, contentX, cursorY, 1.5, 'left');

  cursorY += 30;
  fillTextSpaced(ctx, caption.dimensions, contentX, cursorY, 1.5, 'left');

  cursorY += 22;
  ctx.strokeStyle = COLORS.brass;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(contentX, cursorY);
  ctx.lineTo(contentX + Math.min(140, contentWidth), cursorY);
  ctx.stroke();

  cursorY += 30;
  ctx.fillStyle = COLORS.plateInk;
  ctx.font = `400 17px ${FONT_BODY}`;
  const bodyLineHeight = 30;
  const bodyLines = wrapTextByChar(ctx, caption.body, contentWidth);
  bodyLines.forEach((line) => {
    ctx.fillText(line, contentX, cursorY);
    cursorY += bodyLineHeight;
  });

  return canvas;
}

export function canvasToDownload(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
