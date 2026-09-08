// 玉の移動に伴う「線香の煙」のような減衰トレイル。

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export class SmokeTrail {
  private particles: Particle[] = [];
  private spawnCooldown = 0;

  /** 玉が動いた量に応じてパーティクルを発生させる */
  update(dt: number, coinX: number, coinY: number, moved: number): void {
    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0 && moved > 0.02) {
      this.spawnCooldown = 0.02;
      const count = 1 + Math.min(2, Math.floor(moved / 3));
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: coinX + (Math.random() - 0.5) * 6,
          y: coinY + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 6,
          vy: -8 - Math.random() * 10,
          life: 0,
          maxLife: 0.9 + Math.random() * 0.6,
          size: 5 + Math.random() * 7,
        });
      }
    }

    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    this.particles = this.particles.filter((p) => p.life < p.maxLife);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      const alpha = (1 - t) * 0.22;
      const size = p.size * (1 + t * 1.6);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
      grad.addColorStop(0, `rgba(224, 190, 120, ${alpha})`);
      grad.addColorStop(0.5, `rgba(180, 90, 60, ${alpha * 0.5})`);
      grad.addColorStop(1, 'rgba(120, 40, 30, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  clear(): void {
    this.particles = [];
  }
}
