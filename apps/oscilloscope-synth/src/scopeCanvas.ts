import type { Point, Waveform } from './geometry';

const PHOSPHOR = '57, 255, 106';
const SCREEN_BG = '4, 18, 10';

export interface ScopeCanvasOptions {
  onStrokeStart: () => void;
  onStrokeComplete: (points: Point[]) => void;
}

export class ScopeCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(2, window.devicePixelRatio || 1);
  private radiusPx = 0;
  private cx = 0;
  private cy = 0;
  private drawing = false;
  private currentStroke: Point[] = [];
  private rafId: number | null = null;
  private opts: ScopeCanvasOptions;
  private lastStaticWaveform: Waveform | null = null;

  constructor(canvas: HTMLCanvasElement, opts: ScopeCanvasOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    this.opts = opts;

    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const size = Math.max(1, Math.min(rect.width, rect.height));
    this.canvas.width = Math.round(size * this.dpr);
    this.canvas.height = Math.round(size * this.dpr);
    this.cx = this.canvas.width / 2;
    this.cy = this.canvas.height / 2;
    this.radiusPx = size * this.dpr * 0.46;
    this.clearScreen(1);
    if (this.lastStaticWaveform) this.renderStaticWaveform(this.lastStaticWaveform);
  }

  private toNormalized(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * this.dpr;
    const py = (clientY - rect.top) * this.dpr;
    let x = (px - this.cx) / this.radiusPx;
    let y = (py - this.cy) / this.radiusPx;
    const mag = Math.sqrt(x * x + y * y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }
    return { x, y };
  }

  private handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.drawing = true;
    this.currentStroke = [this.toNormalized(e.clientX, e.clientY)];
    this.opts.onStrokeStart();
    this.renderLiveStroke();
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.drawing) return;
    e.preventDefault();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      this.currentStroke.push(this.toNormalized(ev.clientX, ev.clientY));
    }
    this.renderLiveStroke();
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (!this.drawing) return;
    this.drawing = false;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
    if (this.currentStroke.length >= 3) {
      this.opts.onStrokeComplete(this.currentStroke);
    }
    this.currentStroke = [];
  };

  private clearScreen(alpha: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(${SCREEN_BG}, ${alpha})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  private pointToPx(p: Point): [number, number] {
    return [this.cx + p.x * this.radiusPx, this.cy + p.y * this.radiusPx];
  }

  private strokePath(points: Point[], close: boolean, alpha: number, glow: number) {
    if (points.length < 2) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radiusPx, 0, Math.PI * 2);
    ctx.clip();

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${PHOSPHOR}, ${alpha})`;
    ctx.lineWidth = Math.max(1.5, this.radiusPx * 0.006);
    ctx.shadowColor = `rgba(${PHOSPHOR}, ${Math.min(1, alpha * 1.2)})`;
    ctx.shadowBlur = glow;

    ctx.beginPath();
    const [sx, sy] = this.pointToPx(points[0]);
    ctx.moveTo(sx, sy);
    for (let i = 1; i < points.length; i++) {
      const [x, y] = this.pointToPx(points[i]);
      ctx.lineTo(x, y);
    }
    if (close) ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  /** Live feedback for the stroke currently being drawn (no afterglow). */
  renderLiveStroke() {
    this.clearScreen(1);
    this.strokePath(this.currentStroke, false, 1, this.radiusPx * 0.08);
  }

  /** Full-brightness single-pass render of a committed waveform (idle state). */
  renderStaticWaveform(waveform: Waveform) {
    this.lastStaticWaveform = waveform;
    this.clearScreen(1);
    const points: Point[] = [];
    for (let i = 0; i < waveform.x.length; i++) {
      points.push({ x: waveform.x[i], y: waveform.y[i] });
    }
    this.strokePath(points, true, 1, this.radiusPx * 0.1);
  }

  /** Blank the screen (no committed path to show). */
  renderEmpty() {
    this.lastStaticWaveform = null;
    this.clearScreen(1);
  }

  /** Render a single frame of the live analyser trace with afterglow fade. */
  renderAnalyserFrame(bufL: Float32Array, bufR: Float32Array, fadeAlpha: number) {
    this.clearScreen(fadeAlpha);
    const points: Point[] = [];
    const n = Math.min(bufL.length, bufR.length);
    for (let i = 0; i < n; i++) {
      points.push({ x: bufL[i], y: bufR[i] });
    }
    this.strokePath(points, true, 1, this.radiusPx * 0.16);
  }

  getCanvasElement(): HTMLCanvasElement {
    return this.canvas;
  }

  startRaf(cb: (dt: number) => void) {
    this.stopRaf();
    let last = performance.now();
    const loop = (t: number) => {
      cb(t - last);
      last = t;
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stopRaf() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
