import { distance, type Vec2 } from "./geometry";
import type { RibbonHueId } from "./palette";
import { SpeedSmoother, rawSpeed } from "./speed";

/**
 * Minimum poster-space travel before a pointermove is accepted as a new point.
 * Keeps stroke data compact and avoids jittery zero-length segments (FR-001.5).
 */
export const MIN_POINT_DISTANCE = 1.5;

export interface RibbonPoint extends Vec2 {
  /** Event timestamp in ms. */
  readonly t: number;
  /** Smoothed speed in poster px/ms. */
  readonly speed: number;
}

export interface Stroke {
  readonly points: RibbonPoint[];
  readonly colorId: RibbonHueId;
}

/** Accumulates one stroke from pointerdown to pointerup. */
export class StrokeBuilder {
  private readonly stroke: Stroke;
  private readonly smoother = new SpeedSmoother();
  private last: RibbonPoint;

  constructor(colorId: RibbonHueId, origin: Vec2, timestamp: number) {
    const first: RibbonPoint = { x: origin.x, y: origin.y, t: timestamp, speed: 0 };
    this.stroke = { points: [first], colorId };
    this.last = first;
  }

  get pointCount(): number {
    return this.stroke.points.length;
  }

  /**
   * Live view of the stroke being drawn. The incremental painter reads this
   * directly so it can append only the segments it has not drawn yet.
   */
  get live(): Stroke {
    return this.stroke;
  }

  /** @returns true when the sample was far enough from the previous point to be kept. */
  extend(position: Vec2, timestamp: number): boolean {
    const travelled = distance(this.last, position);
    if (travelled < MIN_POINT_DISTANCE) {
      return false;
    }

    const speed = this.smoother.push(rawSpeed(travelled, timestamp - this.last.t));
    const point: RibbonPoint = { x: position.x, y: position.y, t: timestamp, speed };
    this.stroke.points.push(point);
    this.last = point;
    return true;
  }

  /** Detached copy, safe to hand to the immutable history stack. */
  snapshot(): Stroke {
    return { points: [...this.stroke.points], colorId: this.stroke.colorId };
  }
}
