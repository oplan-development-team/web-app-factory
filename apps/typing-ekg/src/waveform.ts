// Canvas-2D oscilloscope/EKG renderer.
//
// Model: the x-axis is elapsed real time (the "paper speed" of the trace).
// Every keystroke drops a stylised P-QRS-T "beat" kernel centred at the
// moment it happened. Between beats the line is a near-flat baseline. The
// interval since the previous keystroke controls how tall/sharp the beat is:
// short intervals (fast typing) produce a tall, narrow, sharp spike; long
// pauses produce a soft, low bump preceded by a long flat stretch — this is
// what reads as "sharp when fast, flat when slow" per the concept brief.
// Backspace keystrokes are rendered as an inverted, red "ectopic" beat so
// they read visually as an arrhythmia against the normal green trace.

export type BeatKind = 'normal' | 'backspace';

export interface Beat {
  /** ms since recording start */
  t: number;
  kind: BeatKind;
  /** 0..1, derived from the interval since the previous keystroke */
  intensity: number;
}

export interface WaveformColors {
  grid: string;
  gridStrong: string;
  baseline: string;
  trace: string;
  traceGlow: string;
  arrhythmia: string;
  arrhythmiaGlow: string;
}

const DEFAULT_COLORS: WaveformColors = {
  grid: 'rgba(57, 255, 136, 0.09)',
  gridStrong: 'rgba(57, 255, 136, 0.18)',
  baseline: 'rgba(57, 255, 136, 0.35)',
  trace: '#39ff88',
  traceGlow: 'rgba(57, 255, 136, 0.9)',
  arrhythmia: '#ff4d4d',
  arrhythmiaGlow: 'rgba(255, 77, 77, 0.9)',
};

const KERNEL_HALF_WIDTH_MS = 180;

/**
 * Evaluate the local shape of one beat kernel at `dt` ms from its centre.
 * Returns a value roughly in [-1, 1] (fraction of full amplitude).
 * Shape: small P bump -> Q dip -> tall R spike -> S dip -> small T bump.
 */
function qrsShape(dt: number, sharpness: number): number {
  // sharpness in (0, 1]: 1 = very narrow/sharp, ~0.15 = soft/wide bump.
  const w = 40 + (1 - sharpness) * 90; // kernel time-scale in ms
  const x = dt / w;
  if (Math.abs(x) > 2.4) return 0;

  // P wave: small rounded bump well before the spike.
  const p = 0.12 * gauss(x + 1.3, 0.35);
  // Q dip: brief negative notch just before R.
  const q = -0.18 * gauss(x + 0.28, 0.09) * sharpness;
  // R spike: the tall sharp peak.
  const r = 1.0 * gauss(x, 0.16);
  // S dip: undershoot right after R.
  const s = -0.32 * gauss(x - 0.32, 0.12) * sharpness;
  // T wave: broad recovery bump.
  const t = 0.22 * gauss(x - 1.1, 0.4);

  return p + q + r + s + t;
}

/** Inverted / distorted beat used for backspace ("ectopic beat"). */
function arrhythmiaShape(dt: number, sharpness: number): number {
  const w = 55 + (1 - sharpness) * 60;
  const x = dt / w;
  if (Math.abs(x) > 2.2) return 0;
  // Sharp downward plunge then an overshoot rebound — visually "wrong".
  const dip = -1.0 * gauss(x + 0.1, 0.22);
  const rebound = 0.55 * gauss(x - 0.55, 0.2);
  return dip + rebound;
}

function gauss(x: number, sigma: number): number {
  return Math.exp(-(x * x) / (2 * sigma * sigma));
}

export interface RenderWindow {
  /** left edge of the visible window, in ms since recording start */
  timeStart: number;
  /** right edge of the visible window, in ms since recording start */
  timeEnd: number;
}

export class WaveformEngine {
  private beats: Beat[] = [];
  private colors: WaveformColors;

  constructor(colors: Partial<WaveformColors> = {}) {
    this.colors = { ...DEFAULT_COLORS, ...colors };
  }

  reset(): void {
    this.beats = [];
  }

  addBeat(beat: Beat): void {
    this.beats.push(beat);
  }

  getBeats(): readonly Beat[] {
    return this.beats;
  }

  get backspaceCount(): number {
    return this.beats.filter((b) => b.kind === 'backspace').length;
  }

  /** Evaluate the trace's normalized amplitude (-1..1) at time t (ms). */
  private amplitudeAt(t: number): number {
    let sum = 0;
    for (const beat of this.beats) {
      const dt = t - beat.t;
      if (Math.abs(dt) > KERNEL_HALF_WIDTH_MS * 2.4) continue;
      const sharpness = 0.2 + beat.intensity * 0.8;
      sum +=
        beat.kind === 'backspace'
          ? arrhythmiaShape(dt, sharpness) * (0.7 + beat.intensity * 0.5)
          : qrsShape(dt, sharpness) * (0.55 + beat.intensity * 0.6);
    }
    // Gentle idle jitter so the flat sections read as "alive", not dead.
    sum += Math.sin(t / 850) * 0.015 + Math.sin(t / 233) * 0.008;
    return Math.max(-1.3, Math.min(1.3, sum));
  }

  /** Which beat kind (if any) dominates near time t — used for trace color. */
  private dominantKindAt(t: number): BeatKind | null {
    let best: Beat | null = null;
    let bestWeight = 0;
    for (const beat of this.beats) {
      const dt = Math.abs(t - beat.t);
      if (dt > KERNEL_HALF_WIDTH_MS * 2.4) continue;
      const weight = 1 / (1 + dt);
      if (weight > bestWeight) {
        bestWeight = weight;
        best = beat;
      }
    }
    return best?.kind ?? null;
  }

  drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cell = 24,
  ): void {
    ctx.save();
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += cell) {
      const strong = Math.round(x / cell) % 5 === 0;
      ctx.strokeStyle = strong ? this.colors.gridStrong : this.colors.grid;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += cell) {
      const strong = Math.round(y / cell) % 5 === 0;
      ctx.strokeStyle = strong ? this.colors.gridStrong : this.colors.grid;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Draw the trace for the given time window into a rect of the canvas.
   * `centerY`/`ampPx` control vertical placement and scale in pixels.
   */
  drawTrace(
    ctx: CanvasRenderingContext2D,
    win: RenderWindow,
    rect: { x: number; y: number; width: number; height: number },
    opts: { glow?: boolean } = {},
  ): void {
    const { timeStart, timeEnd } = win;
    const span = Math.max(1, timeEnd - timeStart);
    const centerY = rect.y + rect.height / 2;
    const ampPx = rect.height / 2.6;
    const stepPx = 2; // sample every 2px for a smooth but cheap trace
    const glow = opts.glow ?? true;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // We draw in colored segments so backspace regions can be tinted red.
    let segKind: BeatKind | null = null;
    let segPoints: Array<[number, number]> = [];

    const flush = () => {
      if (segPoints.length < 2) {
        segPoints = [];
        return;
      }
      const isArr = segKind === 'backspace';
      ctx.beginPath();
      ctx.strokeStyle = isArr ? this.colors.arrhythmia : this.colors.trace;
      ctx.lineWidth = isArr ? 2.4 : 2;
      if (glow) {
        ctx.shadowBlur = isArr ? 14 : 10;
        ctx.shadowColor = isArr
          ? this.colors.arrhythmiaGlow
          : this.colors.traceGlow;
      }
      ctx.moveTo(segPoints[0]![0], segPoints[0]![1]);
      for (let i = 1; i < segPoints.length; i++) {
        ctx.lineTo(segPoints[i]![0], segPoints[i]![1]);
      }
      ctx.stroke();
      segPoints = [];
    };

    for (let x = rect.x; x <= rect.x + rect.width; x += stepPx) {
      const frac = (x - rect.x) / rect.width;
      const t = timeStart + frac * span;
      const amp = this.amplitudeAt(t);
      const y = centerY - amp * ampPx;
      const kind = this.dominantKindAt(t);

      if (kind !== segKind) {
        // Extend the outgoing segment to this boundary point first so the
        // two colored segments join with no visual gap, then start the new
        // segment from the same point.
        segPoints.push([x, y]);
        flush();
        segKind = kind;
      }
      segPoints.push([x, y]);
    }
    flush();
    ctx.restore();
  }
}
