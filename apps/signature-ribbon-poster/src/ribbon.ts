import { lighten, rgba } from "./palette";

export interface RibbonPoint {
  x: number;
  y: number;
  t: number;
  speed: number;
}

export interface Stroke {
  points: RibbonPoint[];
  color: string;
}

export const CANVAS_WIDTH = 1800;
export const CANVAS_HEIGHT = 2545;

// Speed (px/ms, already smoothed) that saturates the width/glow mapping.
const MAX_SPEED = 1.6;
const MIN_WIDTH = 5;
const MAX_WIDTH = 34;
const MIN_BLUR = 6;
const MAX_BLUR = 40;
const MIN_ALPHA = 0.38;
const MAX_ALPHA = 0.95;

// Only accept a new point once the pointer has moved at least this far, to
// keep stroke data compact and avoid jittery zero-distance segments.
const MIN_POINT_DISTANCE = 1.5;

// Number of recent raw speed samples averaged to smooth out sensor noise.
const SMOOTHING_WINDOW = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Draws the background and all accumulated ribbon strokes onto a given
 * canvas context. Shared by the live drawing surface and the high-resolution
 * export composite so the two never drift apart.
 */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  backgroundHex: string,
  strokes: Stroke[]
): void {
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
  ctx.fillStyle = backgroundHex;
  ctx.fillRect(0, 0, width, height);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "lighter";

  for (const stroke of strokes) {
    drawStroke(ctx, stroke);
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const { points, color } = stroke;
  if (points.length < 2) {
    if (points.length === 1) {
      drawDot(ctx, points[0], color);
    }
    return;
  }

  const hotCore = lighten(color, 0.72);

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const speedNorm = clamp(curr.speed / MAX_SPEED, 0, 1);

    const width = lerp(MAX_WIDTH, MIN_WIDTH, speedNorm);
    const blur = lerp(MAX_BLUR, MIN_BLUR, speedNorm);
    const alpha = lerp(MAX_ALPHA, MIN_ALPHA, speedNorm);

    // Pass 1: wide, soft outer bloom.
    strokeSegment(ctx, prev, curr, {
      lineWidth: width * 1.7,
      strokeStyle: rgba(color, alpha * 0.32),
      shadowBlur: blur * 1.5,
      shadowColor: color,
    });

    // Pass 2: the ribbon's visible core.
    strokeSegment(ctx, prev, curr, {
      lineWidth: width,
      strokeStyle: rgba(color, alpha),
      shadowBlur: blur * 0.6,
      shadowColor: color,
    });

    // Pass 3: bright hot-core highlight for a neon-tube feel.
    strokeSegment(ctx, prev, curr, {
      lineWidth: Math.max(1.2, width * 0.32),
      strokeStyle: rgba(hotCore, alpha * 0.85),
      shadowBlur: blur * 0.25,
      shadowColor: hotCore,
    });
  }
}

interface SegmentStyle {
  lineWidth: number;
  strokeStyle: string;
  shadowBlur: number;
  shadowColor: string;
}

function strokeSegment(
  ctx: CanvasRenderingContext2D,
  from: RibbonPoint,
  to: RibbonPoint,
  style: SegmentStyle
): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.lineWidth = style.lineWidth;
  ctx.strokeStyle = style.strokeStyle;
  ctx.shadowBlur = style.shadowBlur;
  ctx.shadowColor = style.shadowColor;
  ctx.stroke();
}

function drawDot(ctx: CanvasRenderingContext2D, point: RibbonPoint, color: string): void {
  ctx.beginPath();
  ctx.fillStyle = rgba(color, 0.85);
  ctx.shadowBlur = MAX_BLUR * 0.5;
  ctx.shadowColor = color;
  ctx.arc(point.x, point.y, MIN_WIDTH / 2, 0, Math.PI * 2);
  ctx.fill();
}

export class RibbonEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private strokes: Stroke[] = [];
  private currentStroke: Stroke | null = null;
  private activePointerId: number | null = null;
  private recentSpeeds: number[] = [];
  private lastPoint: RibbonPoint | null = null;
  private needsRedraw = true;
  private backgroundHex: string;
  private ribbonHex: string;

  constructor(canvas: HTMLCanvasElement, backgroundHex: string, ribbonHex: string) {
    this.canvas = canvas;
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D canvas context is not available");
    }
    this.ctx = ctx;
    this.backgroundHex = backgroundHex;
    this.ribbonHex = ribbonHex;

    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerUp);
    this.canvas.addEventListener("pointerleave", this.handlePointerLeave);

    requestAnimationFrame(this.loop);
  }

  setBackground(hex: string): void {
    this.backgroundHex = hex;
    this.needsRedraw = true;
  }

  setRibbonHue(hex: string): void {
    this.ribbonHex = hex;
  }

  getStrokeCount(): number {
    return this.strokes.length;
  }

  undo(): void {
    this.strokes.pop();
    this.needsRedraw = true;
  }

  clear(): void {
    this.strokes = [];
    this.currentStroke = null;
    this.needsRedraw = true;
  }

  getSnapshot(): { backgroundHex: string; strokes: Stroke[] } {
    return { backgroundHex: this.backgroundHex, strokes: this.strokes };
  }

  private toCanvasPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.activePointerId !== null) {
      return;
    }
    this.activePointerId = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    this.recentSpeeds = [];

    const { x, y } = this.toCanvasPoint(event);
    const point: RibbonPoint = { x, y, t: event.timeStamp, speed: 0 };
    this.currentStroke = { points: [point], color: this.ribbonHex };
    this.lastPoint = point;
    this.needsRedraw = true;
    event.preventDefault();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId || !this.currentStroke || !this.lastPoint) {
      return;
    }

    const { x, y } = this.toCanvasPoint(event);
    const dist = distance(this.lastPoint, { x, y });
    if (dist < MIN_POINT_DISTANCE) {
      return;
    }

    const dt = Math.max(1, event.timeStamp - this.lastPoint.t);
    const rawSpeed = dist / dt;

    this.recentSpeeds.push(rawSpeed);
    if (this.recentSpeeds.length > SMOOTHING_WINDOW) {
      this.recentSpeeds.shift();
    }
    const smoothedSpeed =
      this.recentSpeeds.reduce((sum, value) => sum + value, 0) / this.recentSpeeds.length;

    const point: RibbonPoint = { x, y, t: event.timeStamp, speed: smoothedSpeed };
    this.currentStroke.points.push(point);
    this.lastPoint = point;
    this.needsRedraw = true;
    event.preventDefault();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    this.finishStroke();
  };

  private handlePointerLeave = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    this.finishStroke();
  };

  private finishStroke(): void {
    if (this.currentStroke && this.currentStroke.points.length > 0) {
      this.strokes.push(this.currentStroke);
    }
    this.currentStroke = null;
    this.activePointerId = null;
    this.lastPoint = null;
    this.recentSpeeds = [];
    this.needsRedraw = true;
  }

  private loop = (): void => {
    if (this.needsRedraw) {
      const allStrokes = this.currentStroke
        ? [...this.strokes, this.currentStroke]
        : this.strokes;
      renderScene(this.ctx, CANVAS_WIDTH, CANVAS_HEIGHT, this.backgroundHex, allStrokes);
      this.needsRedraw = false;
    }
    requestAnimationFrame(this.loop);
  };
}
