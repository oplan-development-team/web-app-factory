export type ParticleStyle = 'snow' | 'glitter' | 'confetti';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  colorIndex: number;
  seed: number;
  rotation: number;
  settled: boolean;
  bucket: number;
}

const CONFETTI_COLORS = ['#C4384A', '#3E6B52', '#3C5A8A', '#D9A441', '#B8608C', '#F2F0E6'];
const GLITTER_COLORS = ['#F4DFA0', '#E9CB84', '#FFF3D6', '#C9A567'];
const SNOW_COLORS = ['#FFFFFF', '#F5F2EA', '#FBFAF6'];

const NUM_BUCKETS = 40;
const GRAVITY = 620; // px/s^2 in logical (400x400) space
const RESTITUTION = 0.42;
const SETTLE_SPEED = 34;
const DAMPING_PER_SEC = 0.6; // fraction of velocity retained per second (air drag)
const PACK_SPREAD = 0.42;

export class ParticleSystem {
  readonly size = 400;
  readonly cx = 200;
  readonly cy = 196;
  radius = 178;

  private particles: Particle[] = [];
  private floorHeights = new Float32Array(NUM_BUCKETS);
  private style: ParticleStyle = 'snow';
  private time = 0;

  constructor(style: ParticleStyle = 'snow') {
    this.setStyle(style);
  }

  setStyle(style: ParticleStyle): void {
    this.style = style;
    this.floorHeights.fill(0);
    const count = style === 'confetti' ? 85 : style === 'glitter' ? 120 : 150;
    const radiusRange: [number, number] =
      style === 'confetti' ? [2.6, 3.6] : style === 'glitter' ? [1.1, 2.1] : [1.6, 3.1];
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const radius = radiusRange[0] + Math.random() * (radiusRange[1] - radiusRange[0]);
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * (this.radius - radius - 4);
      const settleNow = Math.random() < 0.4;
      const p: Particle = {
        x: this.cx + Math.cos(angle) * dist,
        y: this.cy + Math.sin(angle) * dist * 0.6 - 20,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        radius,
        colorIndex: Math.floor(Math.random() * this.paletteFor(style).length),
        seed: Math.random() * 1000,
        rotation: Math.random() * Math.PI * 2,
        settled: false,
        bucket: 0,
      };
      particles.push(p);
      if (settleNow) {
        this.settleParticle(p);
      }
    }
    this.particles = particles;
  }

  private paletteFor(style: ParticleStyle): string[] {
    if (style === 'confetti') return CONFETTI_COLORS;
    if (style === 'glitter') return GLITTER_COLORS;
    return SNOW_COLORS;
  }

  private bucketForX(x: number): number {
    const t = (x - (this.cx - this.radius)) / (this.radius * 2);
    return Math.max(0, Math.min(NUM_BUCKETS - 1, Math.floor(t * NUM_BUCKETS)));
  }

  private floorYAt(x: number): number {
    const dx = x - this.cx;
    const inner = this.radius * this.radius - dx * dx;
    const localR = Math.sqrt(Math.max(0, inner));
    return this.cy + localR;
  }

  private settleParticle(p: Particle): void {
    const bucket = this.bucketForX(p.x);
    const baseY = this.floorYAt(p.x);
    const pileHeight = this.floorHeights[bucket];
    p.y = baseY - p.radius - pileHeight;
    p.x = Math.max(this.cx - this.radius + p.radius, Math.min(this.cx + this.radius - p.radius, p.x));
    p.vx = 0;
    p.vy = 0;
    p.settled = true;
    p.bucket = bucket;
    const rise = p.radius * PACK_SPREAD * 2;
    this.floorHeights[bucket] += rise;
    if (bucket > 0) this.floorHeights[bucket - 1] += rise * 0.35;
    if (bucket < NUM_BUCKETS - 1) this.floorHeights[bucket + 1] += rise * 0.35;
  }

  private unsettleParticle(p: Particle, kickVx: number, kickVy: number): void {
    const rise = p.radius * PACK_SPREAD * 2;
    this.floorHeights[p.bucket] = Math.max(0, this.floorHeights[p.bucket] - rise);
    if (p.bucket > 0) this.floorHeights[p.bucket - 1] = Math.max(0, this.floorHeights[p.bucket - 1] - rise * 0.35);
    if (p.bucket < NUM_BUCKETS - 1)
      this.floorHeights[p.bucket + 1] = Math.max(0, this.floorHeights[p.bucket + 1] - rise * 0.35);
    p.settled = false;
    p.vx = kickVx;
    p.vy = kickVy;
  }

  /** Apply a shake impulse. direction is a unit-ish vector, strength 0..1+. */
  applyImpulse(dirX: number, dirY: number, strength: number): void {
    const clamped = Math.max(0, Math.min(2.2, strength));
    if (clamped < 0.02) return;
    const liftChance = Math.min(0.85, clamped * 0.55);
    for (const p of this.particles) {
      if (p.settled) {
        if (Math.random() < liftChance) {
          const spread = (Math.random() - 0.5) * 140;
          this.unsettleParticle(
            p,
            dirX * 90 * clamped + spread,
            dirY * 90 * clamped - 60 * clamped - Math.random() * 60,
          );
        }
      } else {
        p.vx += dirX * 130 * clamped + (Math.random() - 0.5) * 40;
        p.vy += dirY * 130 * clamped + (Math.random() - 0.5) * 40 - 20 * clamped;
      }
    }
  }

  update(dtSeconds: number): void {
    const dt = Math.min(0.05, dtSeconds);
    this.time += dt;
    const damping = Math.pow(DAMPING_PER_SEC, dt);
    for (const p of this.particles) {
      if (p.settled) continue;
      p.vy += GRAVITY * dt;
      p.vx *= damping;
      p.vy *= damping;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vx * dt * 0.05;

      const dx = p.x - this.cx;
      const dy = p.y - this.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = this.radius - p.radius;
      if (dist > maxDist && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        p.x = this.cx + nx * maxDist;
        p.y = this.cy + ny * maxDist;
        const vDotN = p.vx * nx + p.vy * ny;
        p.vx = (p.vx - 2 * vDotN * nx) * RESTITUTION;
        p.vy = (p.vy - 2 * vDotN * ny) * RESTITUTION;
        const speed = Math.hypot(p.vx, p.vy);
        if (speed < SETTLE_SPEED && ny > -0.25) {
          this.settleParticle(p);
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, scale: number): void {
    const palette = this.paletteFor(this.style);
    ctx.save();
    ctx.scale(scale, scale);
    for (const p of this.particles) {
      const color = palette[p.colorIndex % palette.length];
      if (this.style === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.92;
        ctx.fillRect(-p.radius, -p.radius * 0.55, p.radius * 2, p.radius * 1.1);
        ctx.restore();
      } else if (this.style === 'glitter') {
        const twinkle = 0.55 + 0.45 * Math.sin(this.time * 6 + p.seed);
        ctx.globalAlpha = Math.max(0.25, twinkle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.85 + 0.15 * Math.sin(p.seed);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
