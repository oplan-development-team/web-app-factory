// Sand-grain particle simulation. Each grain drifts down the gradient of the
// squared displacement field (toward node lines where |z| = 0) and gains
// stochastic jitter proportional to the local amplitude |z| (more restless
// at antinodes, settling quietly at nodes) — the classic Chladni-sand
// behaviour, approximated for real-time Canvas 2D rendering.

import { fieldGradient, fieldValue, inDomain, type PlateShape } from './chladni';

export interface Particle {
  x: number; // normalized [-1, 1]
  y: number;
  vx: number;
  vy: number;
}

export interface SimParams {
  shape: PlateShape;
  /** live, possibly-animating mode numbers (can be fractional mid-transition) */
  n: number;
  m: number;
  /** 0..1 drive strength (how strongly grains are pulled toward nodes) */
  drive: number;
  /** 0..1 amplitude (scales antinode jitter) */
  amplitude: number;
}

const DAMPING = 0.86;

export function createParticles(count: number, shape: PlateShape): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push(randomPointOnPlate(shape));
  }
  return particles;
}

export function randomPointOnPlate(shape: PlateShape): Particle {
  if (shape === 'circle') {
    const r = Math.sqrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    return { x: r * Math.cos(theta), y: r * Math.sin(theta), vx: 0, vy: 0 };
  }
  return { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, vx: 0, vy: 0 };
}

/** Scatter existing particles in place (used for the "retry" burst effect). */
export function scatterInPlace(particles: Particle[], shape: PlateShape, strength: number): void {
  for (const p of particles) {
    const jitter = randomPointOnPlate(shape);
    p.x = p.x * (1 - strength) + jitter.x * strength;
    p.y = p.y * (1 - strength) + jitter.y * strength;
    p.vx = (Math.random() - 0.5) * strength;
    p.vy = (Math.random() - 0.5) * strength;
  }
}

export function resizeParticles(particles: Particle[], targetCount: number, shape: PlateShape): Particle[] {
  if (targetCount === particles.length) return particles;
  if (targetCount < particles.length) {
    return particles.slice(0, targetCount);
  }
  const next = particles.slice();
  while (next.length < targetCount) {
    next.push(randomPointOnPlate(shape));
  }
  return next;
}

/** Advance the simulation by one step (dt in arbitrary sim-time units). */
export function stepParticles(particles: Particle[], params: SimParams, dt: number): void {
  const { shape, n, m, drive, amplitude } = params;
  // Step size is expressed directly in normalized plate units per ~1/60s
  // frame, using only the *direction* of the field gradient (not its raw
  // magnitude, which grows without bound as n/m increase and would make a
  // force-integration approach numerically unstable). The step shrinks to
  // zero as |z| -> 0, so grains ease gently onto the node lines instead of
  // overshooting them.
  const maxStep = 0.05 * drive;
  const jitterScale = 0.03 * amplitude;

  for (const p of particles) {
    const z = fieldValue(n, m, p.x, p.y);
    const [gx, gy] = fieldGradient(n, m, p.x, p.y);
    const gnorm = Math.hypot(gx, gy) || 1;

    const pull = Math.min(1, Math.abs(z));
    const dirx = -Math.sign(z) * (gx / gnorm);
    const diry = -Math.sign(z) * (gy / gnorm);

    // Antinode jitter: restless where amplitude is high, quiet at nodes.
    const restless = pull * jitterScale;
    const jx = (Math.random() - 0.5) * restless;
    const jy = (Math.random() - 0.5) * restless;

    const targetVx = dirx * pull * maxStep + jx;
    const targetVy = diry * pull * maxStep + jy;

    // low-pass filter toward the target velocity for inertia / smoothness
    p.vx = p.vx * DAMPING + targetVx * (1 - DAMPING);
    p.vy = p.vy * DAMPING + targetVy * (1 - DAMPING);

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (!inDomain(shape, p.x, p.y)) {
      if (shape === 'circle') {
        const r = Math.hypot(p.x, p.y) || 1;
        p.x = (p.x / r) * 0.98;
        p.y = (p.y / r) * 0.98;
        p.vx *= -0.4;
        p.vy *= -0.4;
      } else {
        p.x = Math.max(-1, Math.min(1, p.x));
        p.y = Math.max(-1, Math.min(1, p.y));
        p.vx *= -0.4;
        p.vy *= -0.4;
      }
    }
  }
}
