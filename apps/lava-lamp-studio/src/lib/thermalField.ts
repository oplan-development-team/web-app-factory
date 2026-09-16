/**
 * ThermalField — a 2D temperature grid representing the inside of the lamp.
 *
 * Pure, UI-independent logic: no DOM, no Canvas. Deliberately hand-rolled
 * (no fluid/physics library) per the prototype's constraints. It models
 * three effects each step:
 *  1. heat injection at the base (bottom rows) proportional to `heatInput`
 *  2. diffusion (simple 4-neighbour averaging) + upward advection (hot
 *     regions transport a fraction of their heat to the cell above them)
 *  3. ambient cooling decay applied to the whole field
 *
 * Coordinates: grid cell (0,0) is top-left, y grows downward, matching
 * canvas pixel space. `sample()` accepts normalized [0,1]x[0,1] coordinates
 * (0,0 = top-left of the chamber, 1,1 = bottom-right) so callers don't need
 * to know the grid resolution.
 */

export interface ThermalStepParams {
  /** Heat added per second at the base row, roughly in [0, 1]. */
  heatInput: number;
  /** Diffusion rate per second, roughly in [0, 4]. */
  diffusion?: number;
  /** Fraction of a cell's heat that rises to the cell above it, per second. */
  rise?: number;
  /** Ambient cooling decay per second, roughly in [0, 1]. */
  cooling?: number;
}

const DEFAULTS = {
  diffusion: 2.2,
  rise: 5,
  cooling: 0.22,
};

export class ThermalField {
  readonly width: number;
  readonly height: number;
  data: Float32Array;
  private scratch: Float32Array;
  /** Per-column heat bias so the base doesn't heat perfectly uniformly —
   *  a real coil/bulb heater has hotter and cooler spots, which is what
   *  seeds asymmetric convection cells instead of every droplet rising in
   *  perfect lockstep. Deterministic function of column index (no RNG). */
  private readonly baseBias: Float32Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Float32Array(width * height);
    this.scratch = new Float32Array(width * height);
    this.baseBias = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      const u = x / Math.max(1, width - 1);
      this.baseBias[x] =
        1 + 0.25 * Math.sin(u * 9.1 + 0.6) + 0.14 * Math.sin(u * 21.7 + 2.1);
    }
  }

  reset(): void {
    this.data.fill(0);
  }

  private idx(x: number, y: number): number {
    return y * this.width + x;
  }

  /** Injects a soft, localized burst of heat, e.g. from a glass-tap. */
  addPulse(nx: number, ny: number, strength: number, radius = 6): void {
    const cx = nx * (this.width - 1);
    const cy = ny * (this.height - 1);
    const r2 = radius * radius;
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const falloff = 1 - d2 / r2;
        this.data[this.idx(x, y)] += strength * falloff;
      }
    }
  }

  /** Advances the field by `dt` seconds using explicit finite differences. */
  step(dt: number, params: ThermalStepParams): void {
    const { width, height, data, scratch } = this;
    const diffusion = params.diffusion ?? DEFAULTS.diffusion;
    const rise = params.rise ?? DEFAULTS.rise;
    const cooling = params.cooling ?? DEFAULTS.cooling;

    // 1. Heat injection along the base (bottom two rows), tapered so it
    //    reads as a rounded burner rather than a hard edge.
    const baseRows = 3;
    for (let r = 0; r < baseRows; r++) {
      const y = height - 1 - r;
      const taper = 1 - r / baseRows;
      for (let x = 0; x < width; x++) {
        data[this.idx(x, y)] += params.heatInput * taper * dt * 2.2 * this.baseBias[x];
      }
    }

    // 2. Diffusion (4-neighbour Laplacian) + upward advection, written into
    //    `scratch` so every cell reads only last frame's values.
    scratch.set(data);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = this.idx(x, y);
        const left = data[this.idx(x > 0 ? x - 1 : x, y)];
        const right = data[this.idx(x < width - 1 ? x + 1 : x, y)];
        const up = data[this.idx(x, y > 0 ? y - 1 : y)];
        const down = data[this.idx(x, y < height - 1 ? y + 1 : y)];
        const laplacian = left + right + up + down - 4 * data[i];
        scratch[i] = data[i] + diffusion * laplacian * dt;
      }
    }

    // Upward advection: transfer a fraction of each cell's heat to the cell
    // directly above it (hot fluid rises). Processed top-to-bottom reading
    // from `data` (previous frame) and accumulating into `scratch` so a
    // cell's own outgoing transfer doesn't double-count incoming transfer.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (y === 0) continue;
        const i = this.idx(x, y);
        const above = this.idx(x, y - 1);
        const transfer = data[i] * rise * dt * 0.5;
        scratch[above] += transfer;
        scratch[i] -= transfer;
      }
    }

    // 3. Ambient cooling decay, slightly stronger near the top (cap acts as
    //    a heat sink), and clamp to keep the simulation numerically stable.
    for (let y = 0; y < height; y++) {
      const topBias = 1 + (1 - y / height) * 0.4;
      const decay = 1 - cooling * topBias * dt;
      for (let x = 0; x < width; x++) {
        const i = this.idx(x, y);
        let v = scratch[i] * decay;
        if (v < 0) v = 0;
        if (v > 4) v = 4;
        data[i] = v;
      }
    }
  }

  /** Bilinear sample at normalized coordinates nx,ny in [0,1]. */
  sample(nx: number, ny: number): number {
    const fx = Math.min(Math.max(nx, 0), 1) * (this.width - 1);
    const fy = Math.min(Math.max(ny, 0), 1) * (this.height - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, this.width - 1);
    const y1 = Math.min(y0 + 1, this.height - 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const v00 = this.data[this.idx(x0, y0)];
    const v10 = this.data[this.idx(x1, y0)];
    const v01 = this.data[this.idx(x0, y1)];
    const v11 = this.data[this.idx(x1, y1)];
    const top = v00 + (v10 - v00) * tx;
    const bottom = v01 + (v11 - v01) * tx;
    return top + (bottom - top) * ty;
  }

  /** Mean temperature across the whole field, used for tests/diagnostics. */
  average(): number {
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) sum += this.data[i];
    return sum / this.data.length;
  }
}
