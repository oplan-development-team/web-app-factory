import type { Zone, Vec2 } from './types';
import { VIRTUAL_W, VIRTUAL_H } from './board';
import { SmokeTrail } from './trail';

export const COLOR_BG_BASE = '#0b0908';
export const COLOR_VERMILLION = '#b3332b';
export const COLOR_VERMILLION_DIM = '#7a2521';
export const COLOR_GOLD = '#c9a44c';
export const COLOR_GOLD_BRIGHT = '#f0cf82';
export const COLOR_PAPER_TEXT = '#ede6d8';
export const COLOR_INK = '#1a1512';

const KANA_FONT = (size: number) => `${size}px "Yuji Syuku", serif`;

export interface RenderState {
  zones: Zone[];
  coinPos: Vec2;
  activeFingers: Vec2[]; // 仮想座標系に変換済みの指位置
  landedZoneId: string | null;
  hintZoneId: string | null; // ドリフト中に最も引力の強いゾーン（微発光）
  phase: string;
  trail: SmokeTrail;
  boardAlpha: number; // setup フェーズ中は少し減光
}

function drawTorii(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number): void {
  const w = 108 * scale;
  const h = 84 * scale;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = COLOR_VERMILLION;
  ctx.lineCap = 'round';

  // 柱
  ctx.lineWidth = 9 * scale;
  ctx.beginPath();
  ctx.moveTo(-w * 0.32, -h * 0.1);
  ctx.lineTo(-w * 0.36, h * 0.55);
  ctx.moveTo(w * 0.32, -h * 0.1);
  ctx.lineTo(w * 0.36, h * 0.55);
  ctx.stroke();

  // 貫（下の横木）
  ctx.lineWidth = 6 * scale;
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, h * 0.14);
  ctx.lineTo(w * 0.3, h * 0.14);
  ctx.stroke();

  // 笠木（上の反った横木）
  ctx.lineWidth = 11 * scale;
  ctx.beginPath();
  ctx.moveTo(-w * 0.52, -h * 0.28);
  ctx.quadraticCurveTo(0, -h * 0.5, w * 0.52, -h * 0.28);
  ctx.stroke();

  // 島木（笠木の下、少し細く金の縁）
  ctx.strokeStyle = COLOR_GOLD;
  ctx.lineWidth = 3.4 * scale;
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, -h * 0.16);
  ctx.quadraticCurveTo(0, -h * 0.34, w * 0.5, -h * 0.16);
  ctx.stroke();

  // 額束（中央の短い縦木）
  ctx.strokeStyle = COLOR_GOLD;
  ctx.lineWidth = 4 * scale;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.28);
  ctx.lineTo(0, -h * 0.02);
  ctx.stroke();

  ctx.restore();
}

function drawZoneGlyph(ctx: CanvasRenderingContext2D, zone: Zone, opts: { active: boolean; hinted: boolean }): void {
  const { active, hinted } = opts;
  ctx.save();

  if (zone.type === 'kana' || zone.type === 'digit') {
    const fontSize = zone.radius * 1.5;
    if (active) {
      ctx.shadowColor = 'rgba(240, 207, 130, 0.95)';
      ctx.shadowBlur = zone.radius * 1.4;
    } else if (hinted) {
      ctx.shadowColor = 'rgba(201, 164, 76, 0.5)';
      ctx.shadowBlur = zone.radius * 0.6;
    }
    ctx.fillStyle = active ? COLOR_GOLD_BRIGHT : hinted ? COLOR_GOLD_BRIGHT : COLOR_GOLD;
    ctx.globalAlpha = active ? 1 : hinted ? 0.95 : 0.82;
    ctx.font = KANA_FONT(fontSize);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(zone.label, zone.x, zone.y);
  } else {
    // はい/いいえ/さようなら: 縦書き風に一文字ずつ積む短冊
    const chars = Array.from(zone.label);
    const fontSize = zone.radius * 0.62;
    const lineHeight = fontSize * 1.08;
    const totalH = lineHeight * (chars.length - 1);
    ctx.font = KANA_FONT(fontSize);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 短冊の背景
    const padX = fontSize * 0.55;
    const boxW = fontSize + padX;
    const boxH = totalH + fontSize * 1.3;
    ctx.fillStyle = 'rgba(20, 15, 11, 0.32)';
    ctx.strokeStyle = active ? COLOR_GOLD_BRIGHT : 'rgba(201, 164, 76, 0.55)';
    ctx.lineWidth = active ? 2.6 : 1.4;
    roundRect(ctx, zone.x - boxW / 2, zone.y - boxH / 2, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    if (active) {
      ctx.shadowColor = 'rgba(240, 207, 130, 0.9)';
      ctx.shadowBlur = 18;
    }
    ctx.fillStyle = zone.type === 'sayonara' ? COLOR_VERMILLION : active ? COLOR_GOLD_BRIGHT : COLOR_PAPER_TEXT;
    chars.forEach((c, i) => {
      ctx.fillText(c, zone.x, zone.y - totalH / 2 + i * lineHeight);
    });
  }

  ctx.restore();
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

function drawArcGuideline(ctx: CanvasRenderingContext2D, zones: Zone[]): void {
  const kana = zones.filter((z) => z.type === 'kana');
  if (kana.length < 2) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(201, 164, 76, 0.35)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  kana.forEach((z, i) => {
    if (i === 0) ctx.moveTo(z.x, z.y + z.radius + 14);
    else ctx.lineTo(z.x, z.y + z.radius + 14);
  });
  ctx.stroke();

  const digits = zones.filter((z) => z.type === 'digit');
  ctx.beginPath();
  digits.forEach((z, i) => {
    if (i === 0) ctx.moveTo(z.x, z.y - z.radius - 14);
    else ctx.lineTo(z.x, z.y - z.radius - 14);
  });
  ctx.stroke();
  ctx.restore();
}

function drawCoin(ctx: CanvasRenderingContext2D, pos: Vec2, phase: string): void {
  const r = 22;
  ctx.save();
  ctx.translate(pos.x, pos.y);

  const pulsing = phase === 'drifting';
  const glowR = pulsing ? r * 2.6 : r * 2.1;
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
  glow.addColorStop(0, 'rgba(240, 207, 130, 0.55)');
  glow.addColorStop(0.5, 'rgba(179, 51, 43, 0.28)');
  glow.addColorStop(1, 'rgba(179, 51, 43, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, glowR, 0, Math.PI * 2);
  ctx.fill();

  // 玉本体（金縁の漆黒の勾玉風円盤）
  const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  body.addColorStop(0, '#3a2f1e');
  body.addColorStop(0.55, '#1c150d');
  body.addColorStop(1, '#0c0906');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = COLOR_GOLD_BRIGHT;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(240, 207, 130, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

export function render(
  ctx: CanvasRenderingContext2D,
  texture: HTMLCanvasElement,
  state: RenderState,
): void {
  ctx.clearRect(0, 0, VIRTUAL_W, VIRTUAL_H);

  ctx.save();
  ctx.globalAlpha = state.boardAlpha;

  // 盤面パネル(縁取り)
  ctx.fillStyle = '#120e0b';
  roundRect(ctx, 4, 4, VIRTUAL_W - 8, VIRTUAL_H - 8, 18);
  ctx.fill();
  ctx.drawImage(texture, 4, 4, VIRTUAL_W - 8, VIRTUAL_H - 8);

  // 金の外枠と朱の内枠
  ctx.strokeStyle = COLOR_GOLD;
  ctx.lineWidth = 3;
  roundRect(ctx, 10, 10, VIRTUAL_W - 20, VIRTUAL_H - 20, 14);
  ctx.stroke();
  ctx.strokeStyle = COLOR_VERMILLION_DIM;
  ctx.lineWidth = 1.4;
  roundRect(ctx, 18, 18, VIRTUAL_W - 36, VIRTUAL_H - 36, 10);
  ctx.stroke();

  drawArcGuideline(ctx, state.zones);

  for (const zone of state.zones) {
    if (zone.type === 'torii') continue;
    drawZoneGlyph(ctx, zone, {
      active: state.landedZoneId === zone.id,
      hinted: state.hintZoneId === zone.id,
    });
  }

  const torii = state.zones.find((z) => z.type === 'torii');
  if (torii) {
    const isActive = state.landedZoneId === torii.id;
    ctx.save();
    if (isActive) {
      ctx.shadowColor = 'rgba(179, 51, 43, 0.9)';
      ctx.shadowBlur = 26;
    }
    drawTorii(ctx, torii.x, torii.y, 1);
    ctx.restore();
  }

  // 指の接触点（控えめな微光インジケーター）
  ctx.save();
  for (const f of state.activeFingers) {
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 20);
    g.addColorStop(0, 'rgba(224, 190, 120, 0.22)');
    g.addColorStop(1, 'rgba(224, 190, 120, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  state.trail.draw(ctx);
  drawCoin(ctx, state.coinPos, state.phase);

  ctx.restore();
}
