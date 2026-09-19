import { Flame } from './flame';
import { WaxDrips } from './wax';

/** Candle height expressed as a multiple of its own half-width ("unit"). */
const HEIGHT_UNITS = 7.6;

export class Candle {
  readonly id: number;
  readonly flame: Flame;
  readonly wax: WaxDrips;
  /** Horizontal position, 0..1 across the scene's candle row. */
  xFrac: number;
  extinguishedCounted = false;

  constructor(id: number, xFrac: number, seed: number) {
    this.id = id;
    this.xFrac = xFrac;
    this.flame = new Flame(seed);
    this.wax = new WaxDrips(seed);
  }

  get lit(): boolean {
    return this.flame.lit;
  }

  update(dt: number, rmsRatio: number, windDir: number): void {
    this.flame.update(dt, rmsRatio, windDir);
    if (this.flame.lit) this.wax.update(dt);
  }

  extinguish(windDir: number): void {
    this.flame.extinguish(windDir);
  }

  relight(): void {
    this.flame.relight();
    this.wax.reset();
    this.extinguishedCounted = false;
  }

  /** unit = candle half-width in px. Draws anchored at (x, yBase = candle's base). */
  draw(ctx: CanvasRenderingContext2D, x: number, yBase: number, unit: number): void {
    const halfWidth = unit;
    const height = unit * HEIGHT_UNITS;

    ctx.save();
    ctx.translate(x, yBase);

    // grounding shadow
    ctx.beginPath();
    ctx.ellipse(0, 4, halfWidth * 1.9, halfWidth * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.filter = 'blur(3px)';
    ctx.fill();
    ctx.filter = 'none';

    // candle body (cylindrical shading via a horizontal gradient)
    const bodyGrad = ctx.createLinearGradient(-halfWidth, 0, halfWidth, 0);
    bodyGrad.addColorStop(0, '#8a6f45');
    bodyGrad.addColorStop(0.18, '#e9d3a3');
    bodyGrad.addColorStop(0.5, '#f6e6bf');
    bodyGrad.addColorStop(0.82, '#dcc189');
    bodyGrad.addColorStop(1, '#7c6238');

    const r = Math.min(halfWidth * 0.4, 6);
    ctx.beginPath();
    roundRectPath(ctx, -halfWidth, -height, halfWidth * 2, height, r);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // subtle rim ellipse (top of the wax cylinder)
    ctx.beginPath();
    ctx.ellipse(0, -height, halfWidth, halfWidth * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f8ecc9';
    ctx.fill();

    // wax drips flow from the rim downward
    ctx.save();
    ctx.translate(0, -height);
    ctx.beginPath();
    roundRectPath(ctx, -halfWidth, 0, halfWidth * 2, height, r);
    ctx.clip();
    this.wax.draw(ctx, halfWidth, height);
    ctx.restore();

    // wick
    const wickTipY = -height - halfWidth * 0.85;
    ctx.beginPath();
    ctx.moveTo(0, -height + 2);
    ctx.lineTo(this.flame.lit ? -halfWidth * 0.05 : halfWidth * 0.18, wickTipY);
    ctx.strokeStyle = this.flame.lit ? '#2b2118' : '#1a140f';
    ctx.lineWidth = Math.max(1.4, halfWidth * 0.12);
    ctx.lineCap = 'round';
    ctx.stroke();

    // flame, anchored at the wick tip
    ctx.save();
    ctx.translate(0, wickTipY);
    this.flame.draw(ctx, unit);
    ctx.restore();

    ctx.restore();
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
