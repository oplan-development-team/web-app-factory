import { createWashiTexture } from './texture';

export interface CharmData {
  question: string;
  sequence: string;
  startedAt: number;
  endedAt: number;
}

// 怪談札にしか登場しない漢字（怪談札・卦・封）は、盤面側で一度も描画されて
// いないため、この時点まで該当するフォントのサブセットチャンクが読み込まれて
// いない可能性がある。canvas の fillText はフォント読み込みを待たずに即座に
// 代替フォントで描画してしまい、しかも読み込み完了後の再描画も行われないため、
// 事前に document.fonts.load() で明示的に読み込みを待ってから描画する。
export async function ensureCharmFontsReady(question: string, sequence: string): Promise<void> {
  const yujiText = `怪談札卦封${sequence}0123456789`;
  const kleeText = question || '　';
  await Promise.allSettled([
    document.fonts.load('16px "Yuji Syuku"', yujiText),
    document.fonts.load('46px "Yuji Syuku"', yujiText),
    document.fonts.load('16px "Klee One"', kleeText),
  ]);
}

const W = 900;
const H = 1260;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [''];
  const lines: string[] = [];
  let current = '';
  for (const ch of Array.from(text)) {
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 怪談札を Canvas 上に合成して返す（プレビュー表示 → ダウンロードの前段で使用）。 */
export function renderCharm(data: CharmData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 背景: 漆黒 + 和紙テクスチャ
  ctx.fillStyle = '#0c0906';
  ctx.fillRect(0, 0, W, H);
  const texture = createWashiTexture(W, H, 99);
  ctx.drawImage(texture, 0, 0);

  // 金の外枠 + 朱の内枠
  ctx.strokeStyle = '#c9a44c';
  ctx.lineWidth = 10;
  roundRect(ctx, 28, 28, W - 56, H - 56, 6);
  ctx.stroke();
  ctx.strokeStyle = '#b3332b';
  ctx.lineWidth = 2.5;
  roundRect(ctx, 46, 46, W - 92, H - 92, 4);
  ctx.stroke();

  // 四隅の飾り
  ctx.strokeStyle = '#c9a44c';
  ctx.lineWidth = 3;
  const corner = 34;
  const inset = 46;
  [
    [inset, inset, 1, 1],
    [W - inset, inset, -1, 1],
    [inset, H - inset, 1, -1],
    [W - inset, H - inset, -1, -1],
  ].forEach(([x, y, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(x! + corner * dx!, y!);
    ctx.lineTo(x!, y!);
    ctx.lineTo(x!, y! + corner * dy!);
    ctx.stroke();
  });

  // タイトル（縦書き風、右上）
  ctx.fillStyle = '#b3332b';
  ctx.font = '54px "Yuji Syuku", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const title = ['怪', '談', '札'];
  title.forEach((c, i) => ctx.fillText(c, W - 100, 150 + i * 66));

  // 朱印風スタンプ（左上、角印）
  ctx.save();
  ctx.translate(150, 130);
  ctx.rotate(-0.09);
  ctx.strokeStyle = 'rgba(179, 51, 43, 0.92)';
  ctx.lineWidth = 5;
  ctx.strokeRect(-70, -70, 140, 140);
  ctx.fillStyle = 'rgba(179, 51, 43, 0.92)';
  ctx.font = '46px "Yuji Syuku", serif';
  ctx.fillText('卦', 0, -18);
  ctx.fillText('封', 0, 30);
  ctx.restore();

  // 質問
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ede6d8';
  ctx.font = '30px "Klee One", serif';
  const qLines = wrapText(ctx, `問い　${data.question || '（無題の問い）'}`, W - 200);
  qLines.forEach((line, i) => ctx.fillText(line, 100, 330 + i * 44));

  // 区切り線
  ctx.strokeStyle = 'rgba(201, 164, 76, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(100, 500 + qLines.length * 10);
  ctx.lineTo(W - 100, 500 + qLines.length * 10);
  ctx.stroke();

  // 着地シーケンス（主役: 大きく金文字で中央）
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0cf82';
  ctx.shadowColor = 'rgba(240, 207, 130, 0.55)';
  ctx.shadowBlur = 20;
  const seq = data.sequence || '（無回答）';
  const seqFont = seq.length > 8 ? 64 : 92;
  ctx.font = `${seqFont}px "Yuji Syuku", serif`;
  const seqLines = wrapText(ctx, seq, W - 160);
  const seqStartY = 700;
  seqLines.forEach((line, i) => ctx.fillText(line, W / 2, seqStartY + i * (seqFont + 20)));
  ctx.shadowBlur = 0;

  // 日付
  ctx.font = '26px "Zen Kaku Gothic New", sans-serif';
  ctx.fillStyle = 'rgba(237, 230, 216, 0.75)';
  const durationSec = Math.max(0, Math.round((data.endedAt - data.startedAt) / 1000));
  ctx.fillText(`${formatDate(data.endedAt)}　所要 ${durationSec}秒`, W / 2, H - 130);

  ctx.font = '20px "Zen Kaku Gothic New", sans-serif';
  ctx.fillStyle = 'rgba(201, 164, 76, 0.7)';
  ctx.fillText('指先の集会 — コイン・セアンス', W / 2, H - 90);

  return canvas;
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
