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
  repaint(strokes: readonly Stroke[]): void {
    this.ctx.clearRect(0, 0, this.options.width, this.options.height);
    this.prepare();
    for (const stroke of strokes) {
      this.drawStroke(stroke, 0, stroke.points.length - 1);
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
