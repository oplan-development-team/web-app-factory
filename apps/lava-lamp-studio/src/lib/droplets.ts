/**
 * Droplet buoyancy/viscosity simulation — pure logic, no DOM/Canvas.
 *
 * Each droplet holds its own position, velocity, radius and temperature.
 * Temperature lags the sampled field value (thermal inertia / heat
 * capacity), which is what gives lava-lamp blobs their slow, deliberate
 * motion instead of snapping instantly to the local field temperature.
 * Buoyancy is an Archimedes-style upward force proportional to how much
 * hotter the droplet is than the ambient temperature; viscosity acts as a
 * drag coefficient that damps velocity and caps top speed.
 */

export interface Droplet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  temp: number;
}

export interface DropletBounds {
  /** Normalized chamber bounds droplets are confined to, in [0,1]. */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface DropletStepParams {
  /** 0 (thin/fast) .. 1 (thick/slow). */
  viscosity: number;
  /** Ambient temperature droplets settle toward when unheated. */
  ambient?: number;
  /** Strength of the upward buoyant force. */
  buoyancy?: number;
  /** Constant downward pull. */
  gravity?: number;
  /** How quickly droplet.temp chases the sampled field temperature. */
  heatExchange?: number;
}

const DEFAULTS = {
  ambient: 0.15,
  buoyancy: 6.0,
  gravity: 0.4,
  heatExchange: 1.6,
};

let seedCounter = 1;
/** Deterministic pseudo-random in [0,1), seeded so tests are reproducible. */
function rand(): number {
  seedCounter = (seedCounter * 1103515245 + 12345) & 0x7fffffff;
  return (seedCounter % 10000) / 10000;
}

export function createDroplets(count: number, bounds: DropletBounds): Droplet[] {
  const droplets: Droplet[] = [];
  for (let i = 0; i < count; i++) {
    const spreadX = bounds.minX + (bounds.maxX - bounds.minX) * (0.2 + 0.6 * rand());
    const spreadY = bounds.minY + (bounds.maxY - bounds.minY) * (0.5 + 0.45 * rand());
    droplets.push({
      x: spreadX,
      y: spreadY,
      vx: (rand() - 0.5) * 0.02,
      vy: 0,
      r: 0.09 + rand() * 0.07,
      temp: 0.2 + rand() * 0.1,
    });
  }
  return droplets;
}

/** Anything exposing a normalized bilinear `sample(nx, ny)` lookup. */
export interface TemperatureSampler {
  sample(nx: number, ny: number): number;
}

export function stepDroplets(
  droplets: Droplet[],
  field: TemperatureSampler,
  dt: number,
  bounds: DropletBounds,
  params: DropletStepParams,
): void {
  const ambient = params.ambient ?? DEFAULTS.ambient;
  const buoyancy = params.buoyancy ?? DEFAULTS.buoyancy;
  const gravity = params.gravity ?? DEFAULTS.gravity;
  const heatExchange = params.heatExchange ?? DEFAULTS.heatExchange;
  // Higher viscosity -> stronger drag -> slower, heavier-feeling motion.
  const drag = 0.6 + params.viscosity * 4.5;
  const maxSpeed = 0.9 - params.viscosity * 0.55;

  for (const d of droplets) {
    // d.x/d.y are already normalized to the same [0,1] chamber space the
    // thermal field covers, so sample directly (no bounds-relative
    // remapping — bounds only constrain motion, they don't redefine the
    // field's coordinate space).
    const fieldTemp = field.sample(d.x, d.y);
    d.temp += (fieldTemp - d.temp) * Math.min(1, heatExchange * dt);

    const buoyantForce = (d.temp - ambient) * buoyancy;
    // y grows downward: buoyancy (upward) subtracts, gravity adds.
    const ay = gravity - buoyantForce;
    const ax = (rand() - 0.5) * 0.15; // gentle thermal jitter, keeps motion organic

    d.vx += ax * dt;
    d.vy += ay * dt;

    // Viscous drag.
    const dragFactor = Math.max(0, 1 - drag * dt);
    d.vx *= dragFactor;
    d.vy *= dragFactor;

    // Speed cap (thicker fluid can't move as fast, regardless of force).
    const speed = Math.hypot(d.vx, d.vy);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      d.vx *= scale;
      d.vy *= scale;
    }

    d.x += d.vx * dt;
    d.y += d.vy * dt;

    // Walls: reflect and clamp.
    if (d.x < bounds.minX) {
      d.x = bounds.minX;
      d.vx *= -0.5;
    } else if (d.x > bounds.maxX) {
      d.x = bounds.maxX;
      d.vx *= -0.5;
    }

    // Floor/ceiling: reflect. Near the floor the droplet re-enters the hot
    // base zone (heats back up via field sampling next step); near the
    // ceiling it has cooled and sinks again — this pairing is what drives
    // the convective loop without any explicit "heating/cooling switch".
    if (d.y < bounds.minY) {
      d.y = bounds.minY;
      d.vy *= -0.4;
    } else if (d.y > bounds.maxY) {
      d.y = bounds.maxY;
      d.vy *= -0.4;
    }
  }
}
