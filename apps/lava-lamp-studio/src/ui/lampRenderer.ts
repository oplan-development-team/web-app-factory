import { LavaSimulation, METABALL_THRESHOLD } from '../lib/simulation';
import { extractCellPolygons } from '../lib/marchingSquares';

const GRID_W = 64;
const GRID_H = 92;
const RIPPLE_DURATION_MS = 620;

interface Ripple {
  nx: number;
  ny: number;
  start: number;
}

export class LampRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ripples: Ripple[] = [];
  private dpr = Math.min(window.devicePixelRatio || 1, 2.5);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  addRipple(nx: number, ny: number): void {
    this.ripples.push({ nx, ny, start: performance.now() });
  }

  private get cssWidth(): number {
    return this.canvas.width / this.dpr;
  }

  private get cssHeight(): number {
    return this.canvas.height / this.dpr;
  }

  render(sim: LavaSimulation, hue: number, now: number): void {
    const ctx = this.ctx;
    const w = this.cssWidth;
    const h = this.cssHeight;
    ctx.clearRect(0, 0, w, h);

    // Heater glow at the base — intensity communicates heat level even
    // before droplets visibly react.
    const heat = sim.params.heat;
    if (heat > 0.02) {
      const grad = ctx.createRadialGradient(w / 2, h * 0.98, 2, w / 2, h * 0.98, w * 0.6);
      grad.addColorStop(0, `hsla(${hue}, 95%, 60%, ${0.3 * heat})`);
      grad.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, h * 0.6, w, h * 0.4);
    }

    // Metaball blob field via marching squares.
    const field = sim.getMetaballField(GRID_W, GRID_H);
    const polygons = extractCellPolygons(field, GRID_W, GRID_H, METABALL_THRESHOLD);
    const sx = w / GRID_W;
    const sy = h / GRID_H;

    if (polygons.length > 0) {
      const path = new Path2D();
      for (const poly of polygons) {
        path.moveTo(poly[0].x * sx, poly[0].y * sy);
        for (let i = 1; i < poly.length; i++) {
          path.lineTo(poly[i].x * sx, poly[i].y * sy);
        }
        path.closePath();
      }

      ctx.save();
      ctx.fillStyle = `hsl(${hue}, 82%, 50%)`;
      ctx.shadowColor = `hsla(${hue}, 90%, 55%, 0.55)`;
      ctx.shadowBlur = 18;
      ctx.fill(path, 'nonzero');
      ctx.restore();

      // Glossy per-droplet highlight, clipped to the blob silhouette.
      ctx.save();
      ctx.clip(path, 'nonzero');
      ctx.globalCompositeOperation = 'overlay';
      for (const d of sim.getDroplets()) {
        const cx = d.x * w;
        const cy = d.y * h;
        const r = d.r * w * 1.3;
        const hx = cx - r * 0.35;
        const hy = cy - r * 0.45;
        const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
        glow.addColorStop(0, `hsla(${hue}, 90%, 88%, 0.85)`);
        glow.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(hx, hy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Click ripples: expanding ring + quick flash, independent of blobs so
    // the click feels instantly acknowledged even before droplets react.
    this.ripples = this.ripples.filter((r) => now - r.start < RIPPLE_DURATION_MS);
    for (const r of this.ripples) {
      const t = (now - r.start) / RIPPLE_DURATION_MS;
      const cx = r.nx * w;
      const cy = r.ny * h;
      const radius = 6 + t * 46;
      const alpha = 1 - t;
      ctx.save();
      ctx.strokeStyle = `hsla(${hue}, 95%, 75%, ${alpha * 0.9})`;
      ctx.lineWidth = 2.5 * (1 - t * 0.6);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      if (t < 0.35) {
        const flashAlpha = (1 - t / 0.35) * 0.55;
        const flash = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.4);
        flash.addColorStop(0, `hsla(${hue}, 100%, 90%, ${flashAlpha})`);
        flash.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
