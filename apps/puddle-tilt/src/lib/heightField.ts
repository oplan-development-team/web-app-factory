/**
 * Shallow-water-ish height field simulation.
 *
 * Two passes run every fixed step:
 *  1. A standard two-buffer ripple pass (4-neighbour average * 2 - previous
 *     frame value, damped) — this is what produces local ripples/waves from
 *     impulses.
 *  2. A semi-Lagrangian advection pass that shifts the field along the
 *     current gravity vector — this is what makes water "flow downhill" and
 *     pool against the low wall when the device is tilted.
 *
 * The grid uses clamped (edge-replicate) boundaries for advection, so
 * tilted water visibly piles up against the low edge instead of draining
 * away — that pooling behaviour is the point of the toy.
 *
 * The square grid extends slightly past the circular puddle that actually
 * gets drawn on screen. Without extra care, ripples reflect cleanly off the
 * four corners of that square and build up into a persistent square
 * standing-wave pattern (a real artifact observed during QA) instead of
 * settling like water. A radial "sponge" — extra damping applied outside
 * the visible circle — absorbs that energy at the corners so the visible
 * area keeps behaving like an open puddle rather than a closed resonant box.
 */

export interface WaveFieldOptions {
  /** Grid is size x size cells. */
  size: number;
  /** 0..1, energy retained per ripple pass. Lower = water calms faster. */
  damping?: number;
  /** How strongly the field advects along the gravity vector per second. */
  advectionSpeed?: number;
}

const DEFAULT_DAMPING = 0.985;
const DEFAULT_ADVECTION_SPEED = 1.6;
/** Normalized radius (0..1 of half the grid) where the sponge begins. */
const SPONGE_START = 0.92;
/** Damping multiplier at the very corners of the grid. */
const SPONGE_MIN_FACTOR = 0.55;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function clampIndex(value: number, max: number): number {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

export class WaveField {
  readonly size: number;
  private damping: number;
  private advectionSpeed: number;

  private current: Float32Array;
  private previous: Float32Array;
  private scratch: Float32Array;
  private sponge: Float32Array;

  constructor(options: WaveFieldOptions) {
    if (!Number.isInteger(options.size) || options.size < 4) {
      throw new Error('WaveField size must be an integer >= 4');
    }
    this.size = options.size;
    this.damping = options.damping ?? DEFAULT_DAMPING;
    this.advectionSpeed = options.advectionSpeed ?? DEFAULT_ADVECTION_SPEED;

    const cellCount = this.size * this.size;
    this.current = new Float32Array(cellCount);
    this.previous = new Float32Array(cellCount);
    this.scratch = new Float32Array(cellCount);
    this.sponge = this.buildSponge();
  }

  private buildSponge(): Float32Array {
    const n = this.size;
    const center = (n - 1) / 2;
    const halfSize = n / 2;
    const out = new Float32Array(n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const r = Math.hypot(x - center, y - center) / halfSize;
        const t = smoothstep(SPONGE_START, Math.SQRT2, r);
        out[y * n + x] = 1 - t * (1 - SPONGE_MIN_FACTOR);
      }
    }
    return out;
  }

  /** Read-only view of the current height field, row-major, length size*size. */
  get heights(): Float32Array {
    return this.current;
  }

  /**
   * Adds a smooth (gaussian falloff) bump/dip centered at normalized
   * coordinates nx,ny in [0,1]. radiusCells is in grid cells.
   */
  addImpulse(nx: number, ny: number, radiusCells: number, strength: number): void {
    const n = this.size;
    const cx = clampIndex(Math.round(nx * (n - 1)), n - 1);
    const cy = clampIndex(Math.round(ny * (n - 1)), n - 1);
    const r = Math.max(1, radiusCells);
    const r2 = r * r;
    const minX = clampIndex(cx - Math.ceil(r), n - 1);
    const maxX = clampIndex(cx + Math.ceil(r), n - 1);
    const minY = clampIndex(cy - Math.ceil(r), n - 1);
    const maxY = clampIndex(cy + Math.ceil(r), n - 1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const falloff = Math.exp(-d2 / (r2 * 0.5));
        const idx = y * n + x;
        this.current[idx] = (this.current[idx] ?? 0) + strength * falloff;
      }
    }
  }

  /**
   * Advances the simulation by one fixed step.
   *
   * @param gravityX downhill direction x component, roughly -1..1
   * @param gravityY downhill direction y component, roughly -1..1
   * @param dt fixed timestep in seconds
   * @param tiltBoost extra multiplier on advection speed (e.g. from slosh)
   */
  step(gravityX: number, gravityY: number, dt: number, tiltBoost = 1): void {
    this.ripplePass();
    const gMag = Math.hypot(gravityX, gravityY);
    if (gMag > 1e-4) {
      this.advectPass(gravityX / gMag, gravityY / gMag, gMag, dt, tiltBoost);
    }
  }

  private ripplePass(): void {
    const n = this.size;
    const cur = this.current;
    const prev = this.previous;
    const damping = this.damping;

    // Compute the new field into `prev` (safe in-place reuse: each cell's
    // new value only reads prev at its own index, never a neighbour's).
    for (let y = 0; y < n; y++) {
      const yUp = y > 0 ? y - 1 : 0;
      const yDown = y < n - 1 ? y + 1 : n - 1;
      for (let x = 0; x < n; x++) {
        const xLeft = x > 0 ? x - 1 : 0;
        const xRight = x < n - 1 ? x + 1 : n - 1;
        const idx = y * n + x;

        const up = cur[yUp * n + x] as number;
        const down = cur[yDown * n + x] as number;
        const left = cur[y * n + xLeft] as number;
        const right = cur[y * n + xRight] as number;

        let h = (up + down + left + right) * 0.5 - (prev[idx] as number);
        h *= damping * (this.sponge[idx] as number);
        prev[idx] = h;
      }
    }

    // Swap: the freshly computed field (in `prev`) becomes `current`.
    this.previous = cur;
    this.current = prev;
  }

  private advectPass(dirX: number, dirY: number, gMag: number, dt: number, tiltBoost: number): void {
    const n = this.size;
    const cur = this.current;
    const out = this.scratch;
    const speed = this.advectionSpeed * Math.min(gMag, 1) * tiltBoost * dt * (n / 32);

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        // Sample backward from the upstream (uphill) side so the field
        // shifts toward the downhill direction over time.
        const srcX = clampIndex(x - dirX * speed, n - 1);
        const srcY = clampIndex(y - dirY * speed, n - 1);

        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = clampIndex(x0 + 1, n - 1);
        const y1 = clampIndex(y0 + 1, n - 1);
        const fx = srcX - x0;
        const fy = srcY - y0;

        const h00 = cur[y0 * n + x0] as number;
        const h10 = cur[y0 * n + x1] as number;
        const h01 = cur[y1 * n + x0] as number;
        const h11 = cur[y1 * n + x1] as number;

        const top = h00 + (h10 - h00) * fx;
        const bottom = h01 + (h11 - h01) * fx;
        out[y * n + x] = top + (bottom - top) * fy;
      }
    }

    this.scratch = cur;
    this.current = out;
  }
}
