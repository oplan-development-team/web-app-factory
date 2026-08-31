import { ValueNoise3D } from './noise';

export interface AudioVisualState {
  /** Curated hue in degrees, already resolved from pitch (see mapping.ts). */
  hue: number;
  /** 0..1, driven by combined volume of everything currently sounding. */
  brightness: number;
  /** 0..1, driven by gesture speed; distorts the noise field. */
  turbulence: number;
  /** 0..1, overall "how much sound is happening" for saturation/contrast. */
  energy: number;
}

// Low-res simulation grid, upscaled + blurred onto the real canvas. Keeping
// this small is what makes 60fps possible with a hand-rolled noise field.
const GRID_W = 128;
const GRID_H = 72;

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.min(1, Math.max(0, s));
  const light = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const hp = hue / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = light - c / 2;
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

export class AuroraRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buffer: HTMLCanvasElement;
  private bufferCtx: CanvasRenderingContext2D;
  private imageData: ImageData;
  private noise = new ValueNoise3D(20260829);
  private time = 0;
  private driftX = 0;
  private driftY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;

    this.buffer = document.createElement('canvas');
    this.buffer.width = GRID_W;
    this.buffer.height = GRID_H;
    const bufferCtx = this.buffer.getContext('2d');
    if (!bufferCtx) throw new Error('2D canvas context unavailable (buffer)');
    this.bufferCtx = bufferCtx;
    this.imageData = this.bufferCtx.createImageData(GRID_W, GRID_H);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
  }

  render(dtMs: number, state: AudioVisualState): void {
    const dt = Math.min(64, dtMs) / 1000;
    this.time += dt * (0.1 + state.turbulence * 0.5);
    this.driftX += dt * 0.018;
    this.driftY += dt * 0.013;

    const data = this.imageData.data;
    const warpAmt = 0.4 + state.turbulence * 1.9;
    const baseLightness = 0.065 + state.brightness * 0.2;
    const satBase = 0.4 + state.energy * 0.34;

    let idx = 0;
    for (let gy = 0; gy < GRID_H; gy++) {
      const ny = gy / GRID_H;
      const warpPhaseY = ny * 5.4 + this.time * 0.8;
      for (let gx = 0; gx < GRID_W; gx++) {
        const nx = gx / GRID_W;

        // Cheap analytic domain warp (trig, not extra noise samples) keeps
        // this affordable at 60fps while still reading as fluid turbulence.
        const wx = Math.sin(warpPhaseY + nx * 2.1) * warpAmt;
        const wy = Math.cos(nx * 5.4 - this.time * 0.6) * warpAmt;

        const sampleX = nx * 2.6 + this.driftX + wx * 0.3;
        const sampleY = ny * 2.6 + this.driftY + wy * 0.3;

        const n = this.noise.fbm(sampleX, sampleY, this.time, 3, 0.55, 2.15);

        const hue = state.hue + (n - 0.5) * 44;
        const l = baseLightness + n * (0.15 + state.brightness * 0.28);
        const s = satBase + (n - 0.5) * 0.14;

        const [r, g, b] = hslToRgb(hue, s, l);
        data[idx++] = r;
        data[idx++] = g;
        data[idx++] = b;
        data[idx++] = 255;
      }
    }
    this.bufferCtx.putImageData(this.imageData, 0, 0);

    const ctx = this.ctx;
    ctx.save();
    ctx.filter = 'blur(2px)';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }
}
