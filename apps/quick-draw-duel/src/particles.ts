/** Canvas-based "dust burst" particle effect fired on the winning side of a round. */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const COLORS = ['#f2ede1', '#f2ede1', '#0a0a0a', '#e0142a'];

export class DustBurst {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private rafId = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** xRatio/yRatio are 0-1 fractions of the canvas's CSS size. */
  burst(xRatio: number, yRatio: number, color: 'bone' | 'blood' = 'bone'): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = rect.width * xRatio;
    const y = rect.height * yRatio;
    const count = 42;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 220;
      const life = 450 + Math.random() * 400;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life,
        maxLife: life,
        size: 2 + Math.random() * 4,
        color: color === 'blood' && Math.random() < 0.35 ? '#e0142a' : COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }
    if (!this.rafId) {
      let last = performance.now();
      const loop = (t: number) => {
        const dt = Math.min(48, t - last);
        last = t;
        this.step(dt);
        if (this.particles.length > 0) {
          this.rafId = requestAnimationFrame(loop);
        } else {
          this.rafId = 0;
        }
      };
      this.rafId = requestAnimationFrame(loop);
    }
  }

  private step(dt: number): void {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    const gravity = 320;
    const friction = 0.94;
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) return false;
      const s = dt / 1000;
      p.vy += gravity * s;
      p.vx *= friction;
      p.x += p.vx * s;
      p.y += p.vy * s;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      const size = p.size * (0.4 + alpha * 0.6);
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      return true;
    });
    ctx.globalAlpha = 1;
  }
}
