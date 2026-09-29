/**
 * LavaSimulation — glues ThermalField + droplets + the metaball field
 * together behind one small UI-independent API. Still pure logic (no
 * Canvas): the renderer asks for `getMetaballField()` / `getDroplets()`
 * each frame and does the actual drawing.
 */
import { ThermalField } from './thermalField';
import {
  createDroplets,
  stepDroplets,
  type Droplet,
  type DropletBounds,
} from './droplets';
import { computeScalarField, type Point } from './marchingSquares';

export interface SimParams {
  /** 0-360 */
  hue: number;
  /** 0-1, higher = thicker/slower */
  viscosity: number;
  /** 0-1, higher = more vigorous convection */
  heat: number;
  /** 4-10 */
  dropletCount: number;
}

const CHAMBER_BOUNDS: DropletBounds = {
  minX: 0.1,
  maxX: 0.9,
  minY: 0.07,
  maxY: 0.93,
};

const FIELD_W = 48;
const FIELD_H = 96;

export const METABALL_THRESHOLD = 1.05;

export class LavaSimulation {
  readonly field: ThermalField;
  droplets: Droplet[];
  params: SimParams;

  constructor(params: SimParams) {
    this.field = new ThermalField(FIELD_W, FIELD_H);
    this.params = { ...params };
    this.droplets = createDroplets(params.dropletCount, CHAMBER_BOUNDS);
    this.warmUp();
  }

  /**
   * A real lava lamp is normally encountered already warmed up and
   * convecting. Fast-forward a chunk of simulated time synchronously at
   * startup (cheap: a few hundred fixed steps on a small grid) so the
   * first frame already shows an active lamp instead of a cold, still one.
   */
  private warmUp(): void {
    const steps = 260; // ~8.5s of simulated time at 1/30s per step
    for (let i = 0; i < steps; i++) this.step(1 / 30);
  }

  setParams(partial: Partial<SimParams>): void {
    this.params = { ...this.params, ...partial };
    if (partial.dropletCount !== undefined) {
      this.setDropletCount(partial.dropletCount);
    }
  }

  private setDropletCount(count: number): void {
    const clamped = Math.max(4, Math.min(10, Math.round(count)));
    const current = this.droplets.length;
    if (clamped === current) return;
    if (clamped > current) {
      const extra = createDroplets(clamped - current, CHAMBER_BOUNDS);
      this.droplets.push(...extra);
    } else {
      this.droplets.length = clamped;
    }
  }

  /** Injects a temperature pulse at normalized chamber coordinates. */
  addPulse(nx: number, ny: number, strength = 1.4): void {
    this.field.addPulse(nx, ny, strength, 8);
  }

  step(dt: number): void {
    const clampedDt = Math.min(dt, 1 / 20); // avoid huge steps after a tab freeze
    this.field.step(clampedDt, {
      heatInput: this.params.heat,
      diffusion: 2.2,
      rise: 4 + this.params.heat * 2.5,
      cooling: 0.22,
    });
    stepDroplets(this.droplets, this.field, clampedDt, CHAMBER_BOUNDS, {
      viscosity: this.params.viscosity,
      gravity: 0.4,
      buoyancy: 5.2 + this.params.heat * 3,
      heatExchange: 0.45,
    });
  }

  getDroplets(): Droplet[] {
    return this.droplets;
  }

  /**
   * Scalar field for metaball rendering, evaluated on a gridW x gridH
   * lattice covering the full [0,1]x[0,1] chamber (not just the droplet
   * bounds, so blobs never look clipped near the glass wall).
   */
  getMetaballField(gridW: number, gridH: number): Float32Array {
    const sources = this.droplets.map((d) => ({ x: d.x, y: d.y, r: d.r }));
    const toGridSpace = (p: Point): Point => ({
      x: p.x * gridW,
      y: p.y * gridH,
    });
    return computeScalarField(sources, gridW, gridH, toGridSpace);
  }
}
