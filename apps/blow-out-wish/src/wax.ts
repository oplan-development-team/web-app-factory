import { mulberry32 } from './noise';

interface Drip {
  xOffset: number; // -1..1 across the candle's rim width
  y: number; // 0 at the rim, 1 at the candle base (fraction of candle height)
  speed: number; // fraction of candle height per second, jittered per-drip
  width: number;
  frozen: boolean;
}

/**
 * Procedural wax-drip accumulation for one candle.
 *
 * While lit, drips spawn probabilistically at the rim and flow downward,
 * slowing and eventually "freezing" in place (wax cooling as it runs),
 * building up a permanent trail on the candle body. This is the melting
 * half of the flame+wax physics that is the core of this prototype — it is
 * deliberately a simulation (spawn/flow/freeze over time), not a fixed
 * pre-baked animation.
 */
export class WaxDrips {
  private readonly rand: () => number;
  private drips: Drip[] = [];
  private burnTime = 0;
  private readonly maxActive = 4;
  private readonly maxTotal = 16;

  constructor(seed: number) {
    this.rand = mulberry32(seed + 999);
  }

  update(dt: number): void {
    this.burnTime += dt;

    const spawnChance = Math.min(0.22, 0.05 + this.burnTime * 0.012);
    if (this.drips.length < this.maxTotal && this.activeCount() < this.maxActive && this.rand() < spawnChance * dt * 8) {
      this.drips.push({
        xOffset: (this.rand() - 0.5) * 1.7,
        y: 0,
        speed: 0.05 + this.rand() * 0.07,
        width: 0.055 + this.rand() * 0.05,
        frozen: false,
      });
    }

    for (const d of this.drips) {
      if (d.frozen) continue;
      d.y += d.speed * dt;
      // wax cools and slows as it runs further from the flame
      d.speed *= 1 - dt * 0.18;
      const freezeChance = d.y > 0.35 ? (d.y - 0.35) * dt * 0.9 : 0;
      if (d.y >= 0.97 || this.rand() < freezeChance) {
        d.frozen = true;
        d.y = Math.min(d.y, 0.98);
      }
    }
  }

  private activeCount(): number {
    let n = 0;
    for (const d of this.drips) if (!d.frozen) n++;
    return n;
  }

  reset(): void {
    this.drips = [];
    this.burnTime = 0;
  }

  /**
   * Draws drips over a candle body occupying local rect
   * x: [-halfWidth, halfWidth], y: [0, candleHeightPx] (0 = rim/top).
   */
  draw(ctx: CanvasRenderingContext2D, halfWidth: number, candleHeightPx: number): void {
    ctx.save();
    for (const d of this.drips) {
      const x = d.xOffset * halfWidth;
      const w = Math.max(2, d.width * halfWidth * 2);
      const len = Math.max(4, d.y * candleHeightPx);
      const grad = ctx.createLinearGradient(0, 0, 0, len);
      grad.addColorStop(0, 'rgba(255,229,186,0.95)');
      grad.addColorStop(1, 'rgba(238,206,150,0.85)');
      ctx.beginPath();
      ctx.moveTo(x - w / 2, 0);
      ctx.quadraticCurveTo(x - w / 2, len * 0.6, x - w * 0.32, len);
      ctx.quadraticCurveTo(x, len + w * 0.55, x + w * 0.32, len);
      ctx.quadraticCurveTo(x + w / 2, len * 0.6, x + w / 2, 0);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.restore();
  }
}
