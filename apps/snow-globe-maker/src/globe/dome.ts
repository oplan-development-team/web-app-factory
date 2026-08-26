import { ParticleSystem, type ParticleStyle } from './particles';
import { fitCanvasToDisplaySize } from '../utils/canvas';

/** Logical drawing space for the interior scene + particle simulation (matches ParticleSystem.size). */
const SCENE_SIZE = 400;
/** Where the 400x400 scene sits inside the (larger) dome canvas, to leave room for the glass rim glow. */
const OFFSET = 20;
const OUTER_RADIUS = 182;
/**
 * Fixed logical coordinate space the dome is drawn in (independent of the
 * canvas element's actual on-screen CSS size, which is responsive). All the
 * drawing math above assumes this space; renderFrame() scales it down/up to
 * whatever the canvas is actually displayed at.
 */
const LOGICAL_SIZE = OFFSET * 2 + OUTER_RADIUS * 2 + 20;

export class Dome {
  readonly particles: ParticleSystem;
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scene: HTMLCanvasElement | null = null;
  private lastTime = 0;
  private rafId = 0;

  constructor(canvas: HTMLCanvasElement, particleStyle: ParticleStyle = 'snow') {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context is not available');
    this.ctx = ctx;
    this.particles = new ParticleSystem(particleStyle);
    fitCanvasToDisplaySize(canvas);
    window.addEventListener('resize', () => fitCanvasToDisplaySize(canvas));
  }

  setScene(scene: HTMLCanvasElement | null): void {
    this.scene = scene;
  }

  setParticleStyle(style: ParticleStyle): void {
    this.particles.setStyle(style);
  }

  applyImpulse(dirX: number, dirY: number, strength: number): void {
    this.particles.applyImpulse(dirX, dirY, strength);
  }

  start(): void {
    if (this.rafId) return;
    this.lastTime = performance.now();
    const loop = (now: number) => {
      const dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      this.particles.update(dt);
      this.renderFrame();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private renderFrame(): void {
    const ctx = this.ctx;
    const dpr = this.canvas.width / LOGICAL_SIZE;
    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.scale(dpr, dpr);
    ctx.translate(OFFSET, OFFSET + 4);

    // --- interior (scene + particles), clipped to the glass sphere ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(200, 196, OUTER_RADIUS - 4, 0, Math.PI * 2);
    ctx.clip();

    if (this.scene) {
      ctx.drawImage(this.scene, 0, 0, SCENE_SIZE, SCENE_SIZE);
    } else {
      const bg = ctx.createLinearGradient(0, 0, 0, SCENE_SIZE);
      bg.addColorStop(0, '#dce8f2');
      bg.addColorStop(1, '#f4f1ea');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, SCENE_SIZE, SCENE_SIZE);
    }

    // gentle vignette so scene edges blend into the glass
    const vignette = ctx.createRadialGradient(200, 196, OUTER_RADIUS * 0.55, 200, 196, OUTER_RADIUS);
    vignette.addColorStop(0, 'rgba(46,38,32,0)');
    vignette.addColorStop(1, 'rgba(46,38,32,0.16)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, SCENE_SIZE, SCENE_SIZE);

    this.particles.render(ctx, 1);
    ctx.restore();

    // --- glass surface effects (rim shade, spotlight, glint, brass seam) ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(200, 196, OUTER_RADIUS, 0, Math.PI * 2);
    ctx.clip();

    const rim = ctx.createRadialGradient(200, 196, OUTER_RADIUS * 0.72, 200, 196, OUTER_RADIUS);
    rim.addColorStop(0, 'rgba(46,38,32,0)');
    rim.addColorStop(1, 'rgba(35,28,22,0.45)');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(200, 196, OUTER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    const spotlight = ctx.createRadialGradient(148, 108, 4, 148, 108, 190);
    spotlight.addColorStop(0, 'rgba(255,255,255,0.55)');
    spotlight.addColorStop(0.5, 'rgba(255,255,255,0.14)');
    spotlight.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spotlight;
    ctx.beginPath();
    ctx.arc(200, 196, OUTER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    const glint = ctx.createRadialGradient(126, 82, 1, 126, 82, 34);
    glint.addColorStop(0, 'rgba(255,255,255,0.85)');
    glint.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glint;
    ctx.beginPath();
    ctx.arc(126, 82, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // brass seam ring
    ctx.beginPath();
    ctx.arc(200, 196, OUTER_RADIUS - 1.5, 0, Math.PI * 2);
    const seam = ctx.createLinearGradient(200 - OUTER_RADIUS, 0, 200 + OUTER_RADIUS, 0);
    seam.addColorStop(0, '#8a6b3d');
    seam.addColorStop(0.5, '#e2c68d');
    seam.addColorStop(1, '#8a6b3d');
    ctx.strokeStyle = seam;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }
}
