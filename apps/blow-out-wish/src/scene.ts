import { Candle } from './candle';
import { fbm1D } from './noise';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Owns the canvas, the cake pedestal, the row of candles, and the render
 * loop. Pure presentation + local flame/wax physics — breath detection and
 * game-mode rules live in main.ts and call into this via extinguishBurst /
 * startRound.
 */
export class Scene {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly wrap: HTMLElement;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;

  private candles: Candle[] = [];
  private nextSeed = 1;
  private breathRatio = 0;
  private readonly windDir = 1;
  private rafId = 0;
  private lastTime = performance.now();
  private ambientT = 0;

  onAllExtinguished: (() => void) | null = null;
  private notifiedAllOut = false;

  constructor(canvas: HTMLCanvasElement, wrap: HTMLElement) {
    this.canvas = canvas;
    this.wrap = wrap;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(wrap);
    this.resize();
  }

  private resize(): void {
    const rect = this.wrap.getBoundingClientRect();
    this.cssWidth = Math.max(1, rect.width);
    this.cssHeight = Math.max(1, rect.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  start(): void {
    this.lastTime = performance.now();
    const loop = (now: number) => {
      const dt = clamp((now - this.lastTime) / 1000, 0, 0.05);
      this.lastTime = now;
      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  setBreath(ratio: number): void {
    this.breathRatio = ratio;
  }

  get litCount(): number {
    return this.candles.filter((c) => c.lit).length;
  }

  get totalCount(): number {
    return this.candles.length;
  }

  /** (Re)builds the candle row with `count` freshly lit candles. */
  startRound(count: number): void {
    this.candles = [];
    this.notifiedAllOut = false;
    for (let i = 0; i < count; i++) {
      const xFrac = count === 1 ? 0.5 : i / (count - 1);
      this.candles.push(new Candle(i, xFrac, this.nextSeed++));
    }
  }

  /** Relights every candle in the current round (used by "relight" reset). */
  relightAll(): void {
    this.notifiedAllOut = false;
    for (const c of this.candles) c.relight();
  }

  /**
   * Extinguishes up to `count` currently-lit candles (in on-screen order)
   * and returns how many were actually put out.
   */
  extinguishBurst(count: number): number {
    let remaining = count;
    let extinguished = 0;
    for (const c of this.candles) {
      if (remaining <= 0) break;
      if (c.lit) {
        c.extinguish(this.windDir);
        remaining--;
        extinguished++;
      }
    }
    return extinguished;
  }

  private update(dt: number): void {
    this.ambientT += dt;
    const ratio = this.breathRatio;
    for (const c of this.candles) {
      c.update(dt, ratio, this.windDir);
    }
    if (!this.notifiedAllOut && this.candles.length > 0 && this.litCount === 0) {
      this.notifiedAllOut = true;
      this.onAllExtinguished?.();
    }
  }

  private render(): void {
    const ctx = this.ctx;
    const w = this.cssWidth;
    const h = this.cssHeight;
    ctx.clearRect(0, 0, w, h);

    // ambient warm pool of light beneath the candles, gently breathing
    const litCount = this.litCount;
    const glowStrength = clamp(litCount / Math.max(1, this.candles.length || 1), 0, 1);
    const breathe = 0.85 + fbm1D(this.ambientT * 0.6, 2, 4) * 0.3;

    const groundY = h * 0.76;
    const cakeTopY = groundY;
    const cakeHeight = clamp(h * 0.16, 26, 64);

    if (litCount > 0) {
      const radial = ctx.createRadialGradient(
        w / 2,
        cakeTopY,
        4,
        w / 2,
        cakeTopY,
        Math.max(w, h) * 0.55 * breathe,
      );
      radial.addColorStop(0, `rgba(255,157,66,${0.16 * glowStrength})`);
      radial.addColorStop(1, 'rgba(255,157,66,0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, w, h);
    }

    // cake pedestal
    const cakeWidth = clamp(w * 0.62, 220, 620);
    const cakeX = w / 2 - cakeWidth / 2;
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, cakeX, cakeTopY, cakeWidth, cakeHeight, 10);
    const cakeGrad = ctx.createLinearGradient(0, cakeTopY, 0, cakeTopY + cakeHeight);
    cakeGrad.addColorStop(0, '#241a12');
    cakeGrad.addColorStop(1, '#140e0a');
    ctx.fillStyle = cakeGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(212,168,86,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cakeX + 10, cakeTopY + 1);
    ctx.lineTo(cakeX + cakeWidth - 10, cakeTopY + 1);
    ctx.strokeStyle = 'rgba(212,168,86,0.75)';
    ctx.stroke();
    ctx.restore();

    // candle row
    const count = this.candles.length;
    if (count > 0) {
      const rowPadding = cakeWidth * 0.14;
      const rowWidth = cakeWidth - rowPadding * 2;
      // clamp by both available row width and available headroom above the
      // cake (flame + wick can reach ~13x the candle's half-width), so tall
      // flames never get clipped by the canvas edge on short viewports.
      const widthLimit = rowWidth / Math.max(count, 1) / 2.6;
      const heightLimit = cakeTopY * 0.07;
      const unit = clamp(Math.min(widthLimit, heightLimit), 8, 30);

      for (const c of this.candles) {
        const x = count === 1 ? w / 2 : cakeX + rowPadding + c.xFrac * rowWidth;
        c.draw(ctx, x, cakeTopY, unit);
      }
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
