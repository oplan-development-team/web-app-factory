import { PEDESTAL_MATERIALS, type PedestalMaterial } from './globe/pedestal';

const CARD_W = 900;
const CARD_H = 1350;

async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('800 64px "Shippori Mincho"'),
      document.fonts.load('600 30px "Shippori Mincho"'),
      document.fonts.load('italic 500 42px "Shippori Mincho"'),
      document.fonts.load('500 20px "IBM Plex Mono"'),
    ]);
  } catch {
    // fonts API not fully supported; canvas will fall back gracefully
  }
}

function drawFrame(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = '#ad8a54';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(46, 46, CARD_W - 92, CARD_H - 92);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(173,138,84,0.65)';
  ctx.strokeRect(60, 60, CARD_W - 120, CARD_H - 120);
}

function drawPedestal(ctx: CanvasRenderingContext2D, material: PedestalMaterial, cx: number, topY: number): void {
  const def = PEDESTAL_MATERIALS[material];
  const width = 300;
  const height = 96;
  const grad = ctx.createLinearGradient(cx - width / 2, 0, cx + width / 2, 0);
  for (const [offset, color] of def.stops) grad.addColorStop(offset, color);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - width / 2, topY);
  ctx.lineTo(cx + width / 2, topY);
  ctx.lineTo(cx + width / 2 - 26, topY + height);
  ctx.lineTo(cx - width / 2 + 26, topY + height);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.ellipse(cx, topY + 6, width / 2, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();

  const plaqueW = 150;
  const plaqueH = 34;
  const plaqueY = topY + height / 2 - plaqueH / 2 + 6;
  ctx.fillStyle = def.plaqueBg;
  ctx.fillRect(cx - plaqueW / 2, plaqueY, plaqueW, plaqueH);
  ctx.strokeStyle = def.plaqueText;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - plaqueW / 2 + 3, plaqueY + 3, plaqueW - 6, plaqueH - 6);
  ctx.globalAlpha = 1;
  ctx.fillStyle = def.plaqueText;
  ctx.font = '500 13px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('No. 001 · HANDMADE TO ORDER', cx, plaqueY + plaqueH / 2 + 1);
}

export interface PostcardOptions {
  domeSource: HTMLCanvasElement;
  material: PedestalMaterial;
  message: string;
  target: HTMLCanvasElement;
}

export async function composePostcard(opts: PostcardOptions): Promise<void> {
  await ensureFonts();
  const { domeSource, material, message, target } = opts;
  target.width = CARD_W;
  target.height = CARD_H;
  const ctx = target.getContext('2d');
  if (!ctx) throw new Error('2D canvas context is not available');

  ctx.fillStyle = '#f7f1e6';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  drawFrame(ctx);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#8a6b3d';
  ctx.font = '500 20px "IBM Plex Mono", monospace';
  ctx.save();
  ctx.letterSpacing = '6px';
  ctx.fillText('ATELIER DE NEIGE', CARD_W / 2, 150);
  ctx.restore();

  ctx.strokeStyle = 'rgba(173,138,84,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CARD_W / 2 - 70, 172);
  ctx.lineTo(CARD_W / 2 + 70, 172);
  ctx.stroke();

  const domeCx = CARD_W / 2;
  const domeCy = 560;
  const domeSize = 620;
  ctx.drawImage(domeSource, domeCx - domeSize / 2, domeCy - domeSize / 2, domeSize, domeSize);

  drawPedestal(ctx, material, domeCx, domeCy + domeSize / 2 - 56);

  ctx.beginPath();
  ctx.ellipse(domeCx, domeCy + domeSize / 2 + 58, 190, 20, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(46,38,32,0.16)';
  ctx.fill();

  const trimmed = message.trim();
  if (trimmed) {
    ctx.fillStyle = '#2e2620';
    ctx.font = 'italic 500 44px "Shippori Mincho", serif';
    ctx.textAlign = 'center';
    wrapCenteredText(ctx, trimmed, CARD_W / 2, 1130, CARD_W - 220, 56);
  }

  ctx.fillStyle = '#8a6b3d';
  ctx.font = '500 15px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  const dateStr = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
  ctx.fillText(`Atelier de Neige · ${dateStr}`, CARD_W / 2, CARD_H - 92);
}

function wrapCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const chars = Array.from(text);
  const lines: string[] = [];
  let current = '';
  for (const ch of chars) {
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  const totalHeight = lines.length * lineHeight;
  let y = startY - totalHeight / 2 + lineHeight / 2;
  for (const line of lines) {
    ctx.fillText(`“${line}”`, cx, y);
    y += lineHeight;
  }
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
