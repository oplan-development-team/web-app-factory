// Pure burn-curve and particle physics logic. No DOM/canvas references here —
// keeps the simulation testable and swappable independent of rendering code.

export type StageName = 'bud' | 'peony' | 'matsuba' | 'chiri';

export const TOTAL_BURN_SECONDS = 45;

/** Percent-of-total-progress boundaries: [start, end] for each stage. */
export const STAGE_RANGES: Record<StageName, [number, number]> = {
  bud: [0, 9],
  peony: [9, 38],
  matsuba: [38, 78],
  chiri: [78, 100],
};

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const COLOR = {
  whiteHot: { r: 255, g: 246, b: 224 } satisfies RGB,
  yellow: { r: 255, g: 216, b: 115 } satisfies RGB,
  orange: { r: 255, g: 140, b: 66 } satisfies RGB,
  red: { r: 194, g: 59, b: 46 } satisfies RGB,
  emberDark: { r: 58, g: 22, b: 17 } satisfies RGB,
} as const;

interface StageParams {
  /** particles spawned per second at full intensity */
  spawnRate: number;
  lifespanMin: number;
  lifespanMax: number;
  /** radian spread of emission angle; 2*PI = full sphere */
  angleSpread: number;
  speedMin: number;
  speedMax: number;
  gravityScale: number;
  dragCoefficient: number;
  /** 0..1 duty-cycle multiplier applied to spawnRate (intermittency) */
  emissionGate: number;
  colorStart: RGB;
  colorEnd: RGB;
}

const STAGE_PARAMS: Record<StageName, StageParams> = {
  bud: {
    spawnRate: 0,
    lifespanMin: 0,
    lifespanMax: 0,
    angleSpread: 0,
    speedMin: 0,
    speedMax: 0,
    gravityScale: 1,
    dragCoefficient: 1.2,
    emissionGate: 0,
    colorStart: COLOR.emberDark,
    colorEnd: COLOR.emberDark,
  },
  peony: {
    spawnRate: 650,
    lifespanMin: 0.3,
    lifespanMax: 0.6,
    angleSpread: Math.PI * 2,
    speedMin: 90,
    speedMax: 230,
    gravityScale: 0.7,
    dragCoefficient: 1.7,
    emissionGate: 1,
    colorStart: COLOR.whiteHot,
    colorEnd: COLOR.orange,
  },
  matsuba: {
    spawnRate: 260,
    lifespanMin: 0.8,
    lifespanMax: 1.5,
    angleSpread: Math.PI * 1.15,
    speedMin: 140,
    speedMax: 260,
    gravityScale: 0.9,
    dragCoefficient: 0.9,
    emissionGate: 1,
    colorStart: COLOR.orange,
    colorEnd: COLOR.red,
  },
  chiri: {
    spawnRate: 90,
    lifespanMin: 0.5,
    lifespanMax: 1.0,
    angleSpread: Math.PI * 1.4,
    speedMin: 35,
    speedMax: 100,
    gravityScale: 1.6,
    dragCoefficient: 1.1,
    emissionGate: 0.35,
    colorStart: COLOR.red,
    colorEnd: COLOR.emberDark,
  },
};

const STAGE_ORDER: StageName[] = ['bud', 'peony', 'matsuba', 'chiri'];
/** width, in percent-of-progress, of the crossfade band around each boundary */
const CROSSFADE_BAND = 4;

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Returns a weight (0..1) for each stage at the given progress percent.
 * Weights sum to 1 and crossfade smoothly across boundaries instead of
 * switching abruptly.
 */
export function getStageWeights(progressPercent: number): Record<StageName, number> {
  const p = Math.min(100, Math.max(0, progressPercent));
  const raw: Record<StageName, number> = { bud: 0, peony: 0, matsuba: 0, chiri: 0 };

  for (let i = 0; i < STAGE_ORDER.length; i++) {
    const stage = STAGE_ORDER[i]!;
    const [start, end] = STAGE_RANGES[stage];
    const bandStart = start - CROSSFADE_BAND / 2;
    const bandEnd = end + CROSSFADE_BAND / 2;
    if (p < bandStart || p > bandEnd) continue;

    // The first/last stage has nothing to crossfade from/to on that edge —
    // using +/-Infinity there would make smoothstep divide Infinity by
    // Infinity (NaN), so those edges are just always-fully-risen/fallen.
    const isFirstStage = i === 0;
    const isLastStage = i === STAGE_ORDER.length - 1;
    const rising = isFirstStage ? 1 : smoothstep(start - CROSSFADE_BAND / 2, start + CROSSFADE_BAND / 2, p);
    const falling = isLastStage ? 1 : 1 - smoothstep(end - CROSSFADE_BAND / 2, end + CROSSFADE_BAND / 2, p);
    raw[stage] = Math.min(rising, falling);
  }

  const total = STAGE_ORDER.reduce((sum, s) => sum + raw[s], 0);
  if (total <= 0) return { bud: 1, peony: 0, matsuba: 0, chiri: 0 };

  return {
    bud: raw.bud / total,
    peony: raw.peony / total,
    matsuba: raw.matsuba / total,
    chiri: raw.chiri / total,
  };
}

/** Dominant stage at the given progress (for UI indicator/labeling). */
export function getDominantStage(progressPercent: number): StageName {
  const weights = getStageWeights(progressPercent);
  return STAGE_ORDER.reduce((best, s) => (weights[s] > weights[best] ? s : best), 'bud');
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) };
}

/** Weighted blend of every stage's numeric params for a smooth crossfade. */
export function interpolateStageParams(progressPercent: number): StageParams {
  const weights = getStageWeights(progressPercent);
  const acc: StageParams = {
    spawnRate: 0,
    lifespanMin: 0,
    lifespanMax: 0,
    angleSpread: 0,
    speedMin: 0,
    speedMax: 0,
    gravityScale: 0,
    dragCoefficient: 0,
    emissionGate: 0,
    colorStart: { r: 0, g: 0, b: 0 },
    colorEnd: { r: 0, g: 0, b: 0 },
  };

  for (const stage of STAGE_ORDER) {
    const w = weights[stage];
    if (w <= 0) continue;
    const p = STAGE_PARAMS[stage];
    acc.spawnRate += p.spawnRate * w;
    acc.lifespanMin += p.lifespanMin * w;
    acc.lifespanMax += p.lifespanMax * w;
    acc.angleSpread += p.angleSpread * w;
    acc.speedMin += p.speedMin * w;
    acc.speedMax += p.speedMax * w;
    acc.gravityScale += p.gravityScale * w;
    acc.dragCoefficient += p.dragCoefficient * w;
    acc.emissionGate += p.emissionGate * w;
  }

  // Colors: weighted average across active stages (small integer ranges, safe to sum).
  let cr1 = 0, cg1 = 0, cb1 = 0, cr2 = 0, cg2 = 0, cb2 = 0;
  for (const stage of STAGE_ORDER) {
    const w = weights[stage];
    const p = STAGE_PARAMS[stage];
    cr1 += p.colorStart.r * w;
    cg1 += p.colorStart.g * w;
    cb1 += p.colorStart.b * w;
    cr2 += p.colorEnd.r * w;
    cg2 += p.colorEnd.g * w;
    cb2 += p.colorEnd.b * w;
  }
  acc.colorStart = { r: cr1, g: cg1, b: cb1 };
  acc.colorEnd = { r: cr2, g: cg2, b: cb2 };

  return acc;
}

/**
 * Branch probability (per second) for a mid-life particle, ramping up
 * across the matsuba (pine-needle) stage only. Outside that stage the
 * generic weighting in interpolateStageParams keeps this irrelevant since
 * branching is gated by matsuba's own weight in ParticleSystem.
 */
export function branchProbabilityForMatsuba(progressPercent: number): number {
  const [start, end] = STAGE_RANGES.matsuba;
  const local = (progressPercent - start) / (end - start);
  return lerp(0.15, 1.4, Math.min(1, Math.max(0, local)));
}

/**
 * Rolling render-only trail of recent (jittered) positions, oldest first.
 * Capped short (not the particle's full lifetime) — just enough to draw a
 * jagged little filament segment behind each spark, which is what makes the
 * burst read as branching threads instead of point-sprite dots.
 */
const MAX_TRAIL_POINTS = 7;

export interface TrailPoint {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  lifespan: number;
  branched: boolean;
  colorStart: RGB;
  colorEnd: RGB;
  size: number;
  /** Render-only jittered trail; physics always uses x/y, never this. */
  path: TrailPoint[];
  /** Per-particle phase/frequency so the jag wobble is stable, not flicker. */
  jitterPhase: number;
  jitterFreq: number;
}

export interface EmberState {
  /** 0..1 pulsing glow intensity used during the bud stage */
  pulse: number;
  /** overall glow brightness 0..1, dims toward extinguish */
  brightness: number;
}

export class ParticleSystem {
  particles: Particle[] = [];
  private spawnAccumulator = 0;
  private burstClockAcc = 0;
  private burstActive = true;

  constructor(
    private readonly originX: () => number,
    private readonly originY: () => number,
  ) {}

  get count(): number {
    return this.particles.length;
  }

  clear(): void {
    this.particles = [];
    this.spawnAccumulator = 0;
  }

  /**
   * Advances the whole system by dt seconds at the given burn progress.
   * `windAX`/`windAY` (px/s²) let a wind gust visibly push lit sparks —
   * see `integrateParticles`.
   */
  update(dt: number, progressPercent: number, windAX = 0, windAY = 0): void {
    this.updateBurstClock(dt, progressPercent);
    this.spawnParticles(dt, progressPercent);
    this.integrateParticles(dt, progressPercent, windAX, windAY);
  }

  private updateBurstClock(dt: number, progressPercent: number): void {
    const weights = getStageWeights(progressPercent);
    if (weights.chiri < 0.35) {
      this.burstActive = true;
      return;
    }
    this.burstClockAcc += dt;
    if (this.burstClockAcc >= 0.18) {
      this.burstClockAcc = 0;
      this.burstActive = Math.random() < 0.45;
    }
  }

  private spawnParticles(dt: number, progressPercent: number): void {
    const params = interpolateStageParams(progressPercent);
    const gate = this.burstActive ? params.emissionGate : params.emissionGate * 0.1;
    this.spawnAccumulator += params.spawnRate * gate * dt;

    while (this.spawnAccumulator >= 1) {
      this.spawnAccumulator -= 1;
      this.spawnOne(params);
    }
  }

  private spawnOne(params: StageParams): void {
    const angle = Math.random() * params.angleSpread - params.angleSpread / 2 - Math.PI / 2;
    const speed = lerp(params.speedMin, params.speedMax, Math.random());
    const x = this.originX();
    const y = this.originY();
    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      lifespan: lerp(params.lifespanMin, params.lifespanMax, Math.random()),
      branched: false,
      colorStart: params.colorStart,
      colorEnd: params.colorEnd,
      size: lerp(1.1, 2.4, Math.random()),
      path: [{ x, y }],
      jitterPhase: Math.random() * Math.PI * 2,
      jitterFreq: lerp(14, 26, Math.random()),
    });
  }

  /** Appends a render-only jittered trail point derived from the particle's true position. */
  private pushTrailPoint(particle: Particle): void {
    const speed = Math.hypot(particle.vx, particle.vy) || 1;
    const perpX = -particle.vy / speed;
    const perpY = particle.vx / speed;
    const wobble = Math.sin(particle.age * particle.jitterFreq + particle.jitterPhase);
    const jitterMag = wobble * (particle.size * 1.6 + 0.5);
    particle.path.push({
      x: particle.x + perpX * jitterMag,
      y: particle.y + perpY * jitterMag,
    });
    if (particle.path.length > MAX_TRAIL_POINTS) particle.path.shift();
  }

  /**
   * Advances the physics for one step. `windAX`/`windAY` are an optional
   * external acceleration (px/s²) — used to visibly blow lit sparks sideways
   * during a wind gust so the disturbance mechanic reads in the burst itself,
   * not just in the stability meter.
   */
  private integrateParticles(dt: number, progressPercent: number, windAX = 0, windAY = 0): void {
    const params = interpolateStageParams(progressPercent);
    const branchChance = getStageWeights(progressPercent).matsuba * branchProbabilityForMatsuba(progressPercent);
    const gravity = 260 * params.gravityScale;
    const next: Particle[] = [];

    for (const particle of this.particles) {
      particle.vy += gravity * dt;
      particle.vx += windAX * dt;
      particle.vy += windAY * dt;
      const dragFactor = Math.max(0, 1 - params.dragCoefficient * dt);
      particle.vx *= dragFactor;
      particle.vy *= dragFactor;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.age += dt;
      this.pushTrailPoint(particle);

      if (particle.age >= particle.lifespan) continue;

      const lifeRatio = particle.age / particle.lifespan;
      if (!particle.branched && lifeRatio > 0.35 && lifeRatio < 0.75 && branchChance > 0) {
        if (Math.random() < branchChance * dt) {
          particle.branched = true;
          const spread = (Math.random() - 0.5) * (Math.PI / 2.2);
          const cos = Math.cos(spread);
          const sin = Math.sin(spread);
          const childVx = particle.vx * cos - particle.vy * sin;
          const childVy = particle.vx * sin + particle.vy * cos;
          next.push({
            x: particle.x,
            y: particle.y,
            vx: childVx * 0.65,
            vy: childVy * 0.65,
            age: 0,
            lifespan: particle.lifespan * lerp(0.5, 0.85, Math.random()),
            branched: true,
            colorStart: particle.colorStart,
            colorEnd: particle.colorEnd,
            size: particle.size * 0.85,
            path: [{ x: particle.x, y: particle.y }],
            jitterPhase: Math.random() * Math.PI * 2,
            jitterFreq: lerp(14, 26, Math.random()),
          });
        }
      }

      next.push(particle);
    }

    this.particles = next;
  }

  /** Advances existing particles only — no new spawns. Used once the flame is out. */
  decay(dt: number, progressPercent: number): void {
    this.integrateParticles(dt, progressPercent);
  }

  /** One-off downward-biased burst used for the misfire ("失火") animation. */
  emitMisfireBurst(count = 18): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.9);
      const speed = lerp(60, 160, Math.random());
      const x = this.originX();
      const y = this.originY();
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        lifespan: lerp(0.4, 0.8, Math.random()),
        branched: true,
        colorStart: COLOR.orange,
        colorEnd: COLOR.emberDark,
        size: lerp(1.2, 2.2, Math.random()),
        path: [{ x, y }],
        jitterPhase: Math.random() * Math.PI * 2,
        jitterFreq: lerp(14, 26, Math.random()),
      });
    }
  }

  /** Gentle final embers used when the sparkler burns out naturally. */
  emitFinalEmbers(count = 8): void {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const speed = lerp(20, 60, Math.random());
      const x = this.originX();
      const y = this.originY();
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        lifespan: lerp(0.8, 1.4, Math.random()),
        branched: true,
        colorStart: COLOR.red,
        colorEnd: COLOR.emberDark,
        size: lerp(1, 1.8, Math.random()),
        path: [{ x, y }],
        jitterPhase: Math.random() * Math.PI * 2,
        jitterFreq: lerp(14, 26, Math.random()),
      });
    }
  }
}

export function colorAt(particle: Particle): RGB {
  const t = Math.min(1, particle.age / particle.lifespan);
  return lerpColor(particle.colorStart, particle.colorEnd, t);
}

/** Alpha fade curve: holds bright, then fades faster near end of life. */
export function alphaAt(particle: Particle): number {
  const t = Math.min(1, particle.age / particle.lifespan);
  if (t < 0.6) return 1;
  const tail = (t - 0.6) / 0.4;
  return 1 - tail * tail;
}

/** Overall glow brightness (0..1) for the ember ball itself, across the whole burn. */
export function emberBrightnessForProgress(progressPercent: number): number {
  const p = Math.min(100, Math.max(0, progressPercent));
  if (p <= STAGE_RANGES.bud[1]) {
    return lerp(0.14, 0.4, p / STAGE_RANGES.bud[1]);
  }
  if (p <= STAGE_RANGES.peony[1]) {
    const local = (p - STAGE_RANGES.peony[0]) / (STAGE_RANGES.peony[1] - STAGE_RANGES.peony[0]);
    return lerp(0.55, 1.0, local);
  }
  if (p <= STAGE_RANGES.matsuba[1]) {
    const local = (p - STAGE_RANGES.matsuba[0]) / (STAGE_RANGES.matsuba[1] - STAGE_RANGES.matsuba[0]);
    return lerp(1.0, 0.85, local);
  }
  const local = (p - STAGE_RANGES.chiri[0]) / (STAGE_RANGES.chiri[1] - STAGE_RANGES.chiri[0]);
  return lerp(0.85, 0.22, local);
}

export const EMBER_COLORS = COLOR;
