import { midpoint, type Vec2 } from "../core/geometry";
import { lighten, resolveHue, rgba } from "../core/palette";
import { MIN_RIBBON_WIDTH, metricsForSpeed } from "../core/ribbon-metrics";
import type { RibbonPoint, Stroke } from "../core/stroke";
import type { Ctx2D } from "./types";

export interface RibbonPaintOptions {
  /** Poster units → layer pixels. */
  readonly scale: number;
  /** Speed at which the width/glow mapping saturates. */
  readonly maxSpeed: number;
  /** Size of the core layer this painter draws into, in layer pixels. */
  readonly width: number;
  readonly height: number;
}

/** How far the hot-core highlight is mixed toward white. */
const HOT_CORE_MIX = 0.72;
const HOT_CORE_WIDTH_RATIO = 0.32;
const MIN_HOT_CORE_WIDTH = 1.2;
const HOT_CORE_ALPHA = 0.85;
const DOT_ALPHA = 0.85;

/**
 * Paints ribbons onto the *core* layer: plain variable-width strokes, no shadow
 * blur. Glow is produced afterwards by {@link BloomPipeline} from this layer as a
 * whole, which is what decouples cost from segment count (NFR-001.1).
 */
export class RibbonPainter {
  private options: RibbonPaintOptions;
  /** Next segment to commit: `segment` within `stroke`. Segment 0 is the lone-point dot. */
  private cursor = { stroke: 0, segment: 0 };

  constructor(
    private readonly ctx: Ctx2D,
    options: RibbonPaintOptions
  ) {
    this.options = options;
  }

  setOptions(options: RibbonPaintOptions): void {
    this.options = options;
  }

  /** Clears the layer and draws every stroke from scratch. */
  repaint(strokes: readonly Stroke[], isLastOpen = false): void {
    this.ctx.clearRect(0, 0, this.options.width, this.options.height);
    this.cursor = { stroke: 0, segment: 0 };
    this.appendPending(strokes, isLastOpen);
  }

  /**
   * Draws only the segments that have not been committed yet, leaving what is
   * already on the layer untouched. This is what keeps the cost of a drag
   * proportional to the points just added rather than to the whole artwork
   * (NFR-001.2).
   *
   * A segment is the arc centred on point `i`, so it can only be drawn once
   * point `i + 1` exists. While a stroke is still open its trailing segment is
   * therefore held back until the next point arrives, or until the stroke closes.
   */
  appendPending(strokes: readonly Stroke[], isLastOpen = false): void {
    this.prepare();

    for (let index = this.cursor.stroke; index < strokes.length; index++) {
      const stroke = strokes[index];
      if (!stroke) {
        continue;
      }

      const isOpen = isLastOpen && index === strokes.length - 1;
      const lastPoint = stroke.points.length - 1;
      const drawableTo = isOpen ? lastPoint - 1 : lastPoint;
      const from = index === this.cursor.stroke ? this.cursor.segment : 0;

      this.drawStroke(stroke, from, drawableTo);

      if (isOpen) {
        this.cursor = { stroke: index, segment: Math.max(from, drawableTo + 1) };
        return;
      }
      this.cursor = { stroke: index + 1, segment: 0 };
    }
  }

  protected prepare(): void {
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.globalCompositeOperation = "lighter";
  }

  /**
   * Draws segments `from`..`to` of a stroke, where segment `i` is the arc centred
   * on point `i`. Segment 0 is the lone-point dot.
   */
  protected drawStroke(stroke: Stroke, from: number, to: number): void {
    const { points } = stroke;
    const hex = resolveHue(stroke.colorId).hex;

    for (let i = from; i <= to; i++) {
      if (i === 0) {
        if (points.length === 1) {
          this.drawDot(points[0]!, hex);
        }
        continue;
      }
      const current = points[i];
      const previous = points[i - 1];
      if (!current || !previous) {
        continue;
      }
      const next = points[i + 1];
      const start = i === 1 ? previous : midpoint(previous, current);
      const end = next ? midpoint(current, next) : current;
      this.drawSegment(start, current, end, current.speed, hex);
    }
  }

  private drawSegment(
    start: Vec2,
    control: Vec2,
    end: Vec2,
    speed: number,
    hex: string
  ): void {
    const { scale, maxSpeed } = this.options;
    const metrics = metricsForSpeed(speed, maxSpeed);
    const ctx = this.ctx;

    const path = (): void => {
      ctx.beginPath();
      ctx.moveTo(start.x * scale, start.y * scale);
      ctx.quadraticCurveTo(
        control.x * scale,
        control.y * scale,
        end.x * scale,
        end.y * scale
      );
    };

    // Core: the ribbon's visible body.
    path();
    ctx.lineWidth = metrics.width * scale;
    ctx.strokeStyle = rgba(hex, metrics.alpha);
    ctx.stroke();

    // Hot core: the neon-tube highlight running down the middle.
    path();
    ctx.lineWidth = Math.max(MIN_HOT_CORE_WIDTH, metrics.width * HOT_CORE_WIDTH_RATIO) * scale;
    ctx.strokeStyle = rgba(lighten(hex, HOT_CORE_MIX), metrics.alpha * HOT_CORE_ALPHA * metrics.glow);
    ctx.stroke();
  }

  private drawDot(point: RibbonPoint, hex: string): void {
    const { scale } = this.options;
    this.ctx.beginPath();
    this.ctx.fillStyle = rgba(hex, DOT_ALPHA);
    this.ctx.arc(point.x * scale, point.y * scale, (MIN_RIBBON_WIDTH / 2) * scale, 0, Math.PI * 2);
    this.ctx.fill();
  }
}
