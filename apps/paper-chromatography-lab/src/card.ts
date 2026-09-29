import { Band, Drop, Sim, rgb2hex } from './sim';
import { ACCENT, HAND, INK, InkLayers, MONO, PAPER, PaperTex, SERIF, drawPaper, drawTicks, makePaperTex, rng } from './render';

export interface CardData {
  no: string;
  date: string;
  sample: string;
  title: string;
  bands: Band[];
}

export const CARD_W = 1600;
export const CARD_H = 2000;
let cardTex: PaperTex | null = null;
let cardLayers: InkLayers | null = null;

function spaced(ctx: CanvasRenderingContext2D, px: number) {
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string,
  align: CanvasTextAlign = 'left', ls = 0) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  spaced(ctx, ls);
  ctx.fillText(s, x, y);
  spaced(ctx, 0);
}

function wrap(ctx: CanvasRenderingContext2D, s: string, maxW: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function wobble(ctx: CanvasRenderingContext2D, pts: [number, number][], r: () => number, amp = 1.6) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 18));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      ctx.lineTo(x0 + (x1 - x0) * t + (r() - 0.5) * amp * 2, y0 + (y1 - y0) * t + (r() - 0.5) * amp * 2);
    }
  }
  ctx.stroke();
}

export function pigmentList(drops: Drop[]): string[] {
  const out: string[] = [];
  for (const d of drops) for (const c of d.comps) if (!out.includes(c.name)) out.push(c.name);
  return out;
}

export function renderCard(canvas: HTMLCanvasElement, data: CardData, sim: Sim) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  cardTex ??= makePaperTex(1000, 21);
  cardLayers ??= new InkLayers();
  cardLayers.update(sim, 1);
  const seed = data.no.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7);
  const r = rng(seed);
  const letters = 'abcde';

  // 地
  ctx.fillStyle = '#F1EBDD';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.6;
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) ctx.drawImage(cardTex.grain, tx * 1000, ty * 1000);
  ctx.restore();

  // 枠
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, CARD_W - 96, CARD_H - 96);
  ctx.lineWidth = 1;
  ctx.strokeRect(64, 64, CARD_W - 128, CARD_H - 128);

  // ヘッダー
  text(ctx, 'PAPER CHROMATOGRAPHY LABORATORY', 96, 118, `22px ${MONO}`, INK, 'left', 5);
  text(ctx, 'SPECIMEN PLATE · WATER DEVELOPMENT', CARD_W - 96, 118, `22px ${MONO}`, INK, 'right', 3);
  ctx.beginPath(); ctx.moveTo(96, 142); ctx.lineTo(CARD_W - 96, 142); ctx.lineWidth = 1; ctx.stroke();

  text(ctx, 'SPECIMEN No.', 96, 204, `22px ${MONO}`, ACCENT, 'left', 5);
  text(ctx, data.no, 90, 356, `800 176px ${SERIF}`, INK, 'left', -3);
  text(ctx, 'DATE', CARD_W - 96, 204, `20px ${MONO}`, ACCENT, 'right', 5);
  text(ctx, data.date, CARD_W - 96, 252, `34px ${MONO}`, INK, 'right', 2);

  // 手書き風タイトル
  ctx.save();
  ctx.translate(100, 446);
  ctx.rotate(-0.018);
  let fs = 64;
  ctx.font = `italic ${fs}px ${HAND}`;
  const tw = ctx.measureText(data.title || ' ').width;
  if (tw > 1080) fs = Math.floor((fs * 1080) / tw);
  text(ctx, data.title, 0, 0, `italic ${fs}px ${HAND}`, ACCENT);
  ctx.font = `italic ${fs}px ${HAND}`;
  const w2 = Math.min(1080, ctx.measureText(data.title || ' ').width);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2.2;
  wobble(ctx, [[-6, 16], [w2 * 0.5, 20], [w2 + 10, 14]], r, 1.8);
  ctx.restore();

  // 濾紙
  const cx = 800, cy = 1000, R = 450;
  ctx.save();
  ctx.shadowColor = 'rgba(28,26,23,0.42)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = PAPER;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  drawPaper(ctx, cx, cy, R, cardLayers, cardTex, 1);
  ctx.strokeStyle = 'rgba(28,26,23,0.65)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, R + 18, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.stroke();
  drawTicks(ctx, cx, cy, R + 18, 1.1, INK);

  // 原点マーク + 引き出し線
  const d0 = sim.drops[0];
  if (d0) {
    const ox = cx + d0.x * R, oy = cy + d0.y * R;
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ox - 12, oy); ctx.lineTo(ox + 12, oy); ctx.moveTo(ox, oy - 12); ctx.lineTo(ox, oy + 12); ctx.stroke();
    text(ctx, 'ORIGIN', ox + 16, oy - 14, `16px ${MONO}`, ACCENT, 'left', 2);
    const n = data.bands.length;
    data.bands.forEach((b, k) => {
      const th = n === 1 ? 0 : -0.95 + (1.9 * k) / (n - 1);
      const px = ox + Math.cos(th) * b.rNorm * R, py = oy + Math.sin(th) * b.rNorm * R;
      const want = R + 84;
      const cur = Math.hypot(px - cx, py - cy);
      const t = Math.max(30, want - cur);
      const ex = px + Math.cos(th) * t, ey = py + Math.sin(th) * t;
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2.2;
      wobble(ctx, [[px, py], [ex, ey], [ex + 56, ey]], r, 1.4);
      ctx.fillStyle = ACCENT;
      ctx.beginPath(); ctx.arc(px, py, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#F7F2E6'; ctx.lineWidth = 2; ctx.stroke();
      text(ctx, letters[k], ex + 66, ey + 14, `italic 700 46px ${SERIF}`, ACCENT);
    });
  }

  // データブロック
  const top = 1590;
  ctx.strokeStyle = INK; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(96, top - 30); ctx.lineTo(CARD_W - 96, top - 30); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(820, top - 6); ctx.lineTo(820, top + 240); ctx.stroke();

  let y = top + 14;
  const row = (label: string, value: string, maxLines = 1) => {
    text(ctx, label, 96, y, `17px ${MONO}`, ACCENT, 'left', 4);
    ctx.font = `28px ${SERIF}`;
    const lines = wrap(ctx, value, 660).slice(0, maxLines);
    lines.forEach((ln, i) => text(ctx, ln, 96, y + 32 + i * 32, `28px ${SERIF}`, INK));
    y += 32 + lines.length * 32 + 12;
  };
  const pig = pigmentList(sim.drops).join(' / ');
  const vols = sim.drops.map((d) => d.volume);
  const volTxt = vols.every((v) => v === vols[0])
    ? `${vols[0].toFixed(1)} µL x ${vols.length} drop${vols.length > 1 ? 's' : ''}`
    : `${vols.length} drops (${Math.min(...vols).toFixed(1)}-${Math.max(...vols).toFixed(1)} µL)`;
  row('SAMPLE', data.sample || '-');
  row('PIGMENTS', pig || '-', 2);
  row('DROP VOLUME', volTxt);
  row('DEVELOPED', `${sim.t.toFixed(1)} s   /   ${data.bands.length} band${data.bands.length === 1 ? '' : 's'}`);

  text(ctx, 'Rf LEGEND', 880, top + 14, `18px ${MONO}`, ACCENT, 'left', 4);
  if (!data.bands.length) {
    text(ctx, 'no resolved bands', 880, top + 70, `italic 32px ${SERIF}`, 'rgba(28,26,23,0.6)');
  }
  data.bands.forEach((b, k) => {
    const yy = top + 62 + k * 52;
    text(ctx, letters[k], 880, yy + 12, `italic 700 40px ${SERIF}`, ACCENT);
    ctx.fillStyle = rgb2hex(b.rgb);
    ctx.fillRect(934, yy - 20, 96, 36);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.strokeRect(934, yy - 20, 96, 36);
    text(ctx, `Rf ${b.rf.toFixed(2)}`, 1058, yy + 8, `30px ${MONO}`, INK, 'left', 1);
    text(ctx, rgb2hex(b.rgb).toUpperCase(), CARD_W - 96, yy + 6, `20px ${MONO}`, 'rgba(28,26,23,0.62)', 'right', 2);
  });

  // フッター
  ctx.beginPath(); ctx.moveTo(96, 1900); ctx.lineTo(CARD_W - 96, 1900); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke();
  text(ctx, 'FIG. 1 — CIRCULAR PAPER CHROMATOGRAM, SOLVENT: WATER. AUTOGENERATED PROTOTYPE.', 96, 1924, `17px ${MONO}`, 'rgba(28,26,23,0.7)', 'left', 2);
  text(ctx, data.no, CARD_W - 96, 1924, `18px ${MONO}`, INK, 'right', 3);
}
