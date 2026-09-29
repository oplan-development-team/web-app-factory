import { fbm1D } from './noise';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

/**
 * A single candle flame: continuous idle flicker driven by hand-rolled value
 * noise (no physics/noise library), plus a reactive response to the live
 * breath RMS ratio (tilt / stretch / ember tear-off), and a short
 * extinguish -> smoke transition.
 */
export class Flame {
  private readonly seed: number;
  private t = 0;
  private tilt = 0;
  private stretch = 0;
  private tearAmount = 0;
  private embers: Particle[] = [];
  private smoke: Particle[] = [];

  lit = true;
  private extinguishProgress = 0;
  private afterglow = 0;

  constructor(seed: number) {
    this.seed = seed;
  }

  /** rmsRatio: 0 at silence, ~1 at the blow threshold, can exceed 1. */
  update(dt: number, rmsRatio: number, windDir: number): void {
    if (this.lit) {
      this.t += dt;
      const flickerA = fbm1D(this.t * 2.2, 3, this.seed) * 2 - 1;
      const flickerB = fbm1D(this.t * 3.7 + 50, 2, this.seed + 11) * 2 - 1;
      const wind = clamp(rmsRatio, 0, 1.6);

      const targetTilt = flickerA * 0.14 + wind * 0.95 * windDir;
      this.tilt += (targetTilt - this.tilt) * clamp(dt * 11, 0, 1);

      const targetStretch = clamp(wind * 0.6 + Math.abs(flickerB) * 0.16, 0, 1.15);
      this.stretch += (targetStretch - this.stretch) * clamp(dt * 8, 0, 1);

      const targetTear = clamp((wind - 0.5) / 0.5, 0, 1);
      this.tearAmount += (targetTear - this.tearAmount) * clamp(dt * 6, 0, 1);

      if (this.tearAmount > 0.05 && Math.random() < this.tearAmount * dt * 16) {
        this.spawnEmber(windDir);
      }
    } else {
      this.extinguishProgress = Math.min(1, this.extinguishProgress + dt / 0.22);
      this.afterglow = Math.max(0, this.afterglow - dt / 0.55);
    }

    this.stepParticles(this.embers, dt);
    this.stepParticles(this.smoke, dt);
  }

  private stepParticles(list: Particle[], dt: number): void {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 8 * dt; // gentle upward buoyancy accel
      p.life -= dt;
      if (p.life <= 0) list.splice(i, 1);
    }
  }

  private spawnEmber(windDir: number): void {
    this.embers.push({
      x: (Math.random() - 0.5) * 4,
      y: -10 - Math.random() * 6,
      vx: windDir * (18 + Math.random() * 26),
      vy: -(20 + Math.random() * 20),
      life: 0.25 + Math.random() * 0.35,
      maxLife: 0.5,
      size: 1 + Math.random() * 1.6,
    });
  }

  /** Snuffs the flame out, kicking off the smoke-wisp + afterglow transition. */
  extinguish(windDir: number): void {
    if (!this.lit) return;
    this.lit = false;
    this.extinguishProgress = 0;
    this.afterglow = 1;
    const count = 7 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      this.smoke.push({
        x: (Math.random() - 0.5) * 6,
        y: -6 - Math.random() * 4,
        vx: windDir * (6 + Math.random() * 14) + (Math.random() - 0.5) * 10,
        vy: -(24 + Math.random() * 26),
        life: 0.9 + Math.random() * 0.8,
        maxLife: 1.6,
        size: 5 + Math.random() * 7,
      });
    }
  }

  /** Re-lights an extinguished candle (used by "relight" reset). */
  relight(): void {
    this.lit = true;
    this.extinguishProgress = 0;
    this.afterglow = 0;
    this.embers = [];
    this.smoke = [];
    this.stretch = 0;
    this.tilt = 0;
    this.tearAmount = 0;
  }

  get isSettled(): boolean {
    return !this.lit && this.afterglow <= 0 && this.smoke.length === 0;
  }

  /**
   * Draws the flame anchored at local origin (0,0) = wick tip, with +y
   * pointing down. `unit` is the candle's radius in px, used to scale the
   * whole flame proportionally to the candle's on-screen size.
   */
  draw(ctx: CanvasRenderingContext2D, unit: number): void {
    ctx.save();

    const shrink = this.lit ? 1 : 1 - this.extinguishProgress;
    if (shrink > 0.01) {
      const h = unit * (3.4 + this.stretch * 1.3) * shrink;
      const w = unit * (1.55 - this.stretch * 0.35) * Math.max(0.4, shrink);
      const tipX = this.tilt * unit * 1.7;
      const bulgeX = this.tilt * unit * 0.9;

      // outer glow (bloom via shadowBlur)
      ctx.shadowColor = 'rgba(255,157,66,0.85)';
      ctx.shadowBlur = unit * 2.6;

      const grad = ctx.createLinearGradient(0, 0, 0, -h);
      grad.addColorStop(0, 'rgba(255,140,50,0.0)');
      grad.addColorStop(0.18, 'rgba(255,120,40,0.92)');
      grad.addColorStop(0.55, 'rgba(255,170,64,0.96)');
      grad.addColorStop(0.85, 'rgba(255,220,140,0.98)');
      grad.addColorStop(1, 'rgba(255,247,222,1)');

      ctx.beginPath();
      ctx.moveTo(-w * 0.55, 0);
      ctx.quadraticCurveTo(-w * 0.95 + bulgeX * 0.5, -h * 0.42, bulgeX * 0.4, -h * 0.66);
      ctx.quadraticCurveTo(w * 0.5 + tipX * 0.6, -h * 0.86, tipX, -h);
      ctx.quadraticCurveTo(-w * 0.35 + tipX * 0.6, -h * 0.86, bulgeX * 0.4 - w * 0.25, -h * 0.6);
      ctx.quadraticCurveTo(w * 0.9 + bulgeX * 0.4, -h * 0.38, w * 0.55, 0);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // inner hot core
      ctx.shadowBlur = unit * 1.1;
      ctx.shadowColor = 'rgba(255,235,190,0.9)';
      const innerH = h * 0.6;
      const innerW = w * 0.42;
      ctx.beginPath();
      ctx.moveTo(-innerW * 0.5, 0);
      ctx.quadraticCurveTo(-innerW * 0.7 + bulgeX * 0.3, -innerH * 0.5, tipX * 0.5, -innerH);
      ctx.quadraticCurveTo(innerW * 0.7 + bulgeX * 0.3, -innerH * 0.5, innerW * 0.5, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,246,222,0.95)';
      ctx.fill();

      // cool blue base where the wick meets the flame
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.ellipse(0, -unit * 0.15, w * 0.3, unit * 0.42, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,170,255,0.35)';
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    // embers tearing off in strong wind
    for (const p of this.embers) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,180,90,${a})`;
      ctx.fill();
    }

    // afterglow ember at the wick right after being blown out
    if (this.afterglow > 0) {
      ctx.beginPath();
      ctx.arc(0, -unit * 0.1, unit * 0.5 * this.afterglow, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,120,50,${this.afterglow * 0.9})`;
      ctx.shadowColor = 'rgba(255,120,50,0.8)';
      ctx.shadowBlur = unit * 1.4 * this.afterglow;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // smoke wisps drifting up after extinguish
    for (const p of this.smoke) {
      const a = clamp(p.life / p.maxLife, 0, 1) * 0.35;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,196,190,${a})`;
      ctx.fill();
    }

    ctx.restore();
  }
}
