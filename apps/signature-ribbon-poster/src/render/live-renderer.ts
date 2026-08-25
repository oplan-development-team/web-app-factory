import { POSTER_HEIGHT, POSTER_WIDTH } from "../core/poster";
import type { Stroke } from "../core/stroke";
import { BloomPipeline, PREVIEW_BLOOM_LEVELS } from "./bloom";
import { RibbonPainter } from "./ribbon-painter";
import { composeScene } from "./scene";
import { type CanvasFactory, type CanvasLike, type Ctx2D, require2d } from "./types";

/**
 * Upper bound on the preview backing store. Beyond this the extra pixels buy no
 * visible detail but cost real fill time every frame (NFR-001.3).
 */
export const MAX_BACKING_WIDTH = 1400;
const MAX_PIXEL_RATIO = 2;

export interface LiveRendererOptions {
  readonly display: CanvasLike;
  readonly createCanvas: CanvasFactory;
  readonly backgroundHex: string;
  readonly maxSpeed: number;
  /** Initial on-screen width in CSS pixels. */
  readonly cssWidth: number;
  readonly pixelRatio: number;
}

type Dirty = "none" | "append" | "full";

interface BackingSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Preview backing store size. Derived from the poster aspect so stroke
 * coordinates never depend on the window, and capped so a large window cannot
 * turn every frame into a multi-megapixel fill.
 */
function backingSize(cssWidth: number, pixelRatio: number): BackingSize {
  const ratio = Math.min(Math.max(pixelRatio, 1), MAX_PIXEL_RATIO);
  const width = Math.max(1, Math.min(MAX_BACKING_WIDTH, Math.round(cssWidth * ratio)));
  return { width, height: Math.max(1, Math.round((width * POSTER_HEIGHT) / POSTER_WIDTH)) };
}

/**
 * Owns the on-screen layer stack and decides how little work each frame needs.
 * Nothing is drawn unless something actually changed, and while a stroke is being
 * drawn only the new segments are committed to the core layer.
 */
export class LiveRenderer {
  private readonly display: CanvasLike;
  private readonly displayCtx: Ctx2D;
  private readonly createCanvas: CanvasFactory;
  private readonly bloom: BloomPipeline;

  // Both are built by buildLayers(), which the constructor always runs.
  private core!: CanvasLike;
  private painter!: RibbonPainter;

  private backgroundHex: string;
  private maxSpeed: number;
  private strokes: readonly Stroke[] = [];
  private openTail = false;
  private dirty: Dirty = "full";
  private frame: number | null = null;

  constructor(options: LiveRendererOptions) {
    this.display = options.display;
    this.displayCtx = require2d(options.display);
    this.createCanvas = options.createCanvas;
    this.backgroundHex = options.backgroundHex;
    this.maxSpeed = options.maxSpeed;
    this.bloom = new BloomPipeline(options.createCanvas, PREVIEW_BLOOM_LEVELS);
    this.buildLayers(backingSize(options.cssWidth, options.pixelRatio));
  }

  /** The core layer, exposed so the benchmark can drive it directly. */
  get coreCanvas(): CanvasLike {
    return this.core;
  }

  /**
   * Rebuilds the layer stack for a new on-screen size. The poster aspect ratio is
   * enforced here so stroke coordinates never need to change (FR-001.8, E-02).
   */
  setViewport(cssWidth: number, pixelRatio: number): void {
    const size = backingSize(cssWidth, pixelRatio);
    if (this.display.width === size.width && this.display.height === size.height) {
      return;
    }
    this.buildLayers(size);
  }

  private buildLayers(size: BackingSize): void {
    const { width, height } = size;
    this.display.width = width;
    this.display.height = height;

    this.core = this.createCanvas(width, height);
    this.painter = new RibbonPainter(require2d(this.core), {
      scale: width / POSTER_WIDTH,
      maxSpeed: this.maxSpeed,
      width,
      height,
    });
    this.bloom.resize(width, height);
    this.dirty = "full";
  }

  setBackground(hex: string): void {
    if (this.backgroundHex === hex) {
      return;
    }
    this.backgroundHex = hex;
    this.markDirty("full");
  }

  setMaxSpeed(maxSpeed: number): void {
    if (this.maxSpeed === maxSpeed) {
      return;
    }
    this.maxSpeed = maxSpeed;
    this.painter.setOptions({
      scale: this.display.width / POSTER_WIDTH,
      maxSpeed,
      width: this.display.width,
      height: this.display.height,
    });
    this.markDirty("full");
  }

  /** @param isLastOpen true while the final stroke is still being drawn. */
  setStrokes(strokes: readonly Stroke[], isLastOpen: boolean): void {
    this.strokes = strokes;
    this.openTail = isLastOpen;
    this.markDirty("append");
  }

  /** Forces a full repaint — required after undo, redo, clear or a draft restore. */
  invalidate(): void {
    this.markDirty("full");
  }

  private markDirty(level: Exclude<Dirty, "none">): void {
    // A pending full repaint always wins: it is never safe to downgrade it to an
    // append, since the layer still holds strokes that are about to change.
    if (level === "full") {
      this.dirty = "full";
    } else if (this.dirty === "none") {
      this.dirty = "append";
    }
  }

  /** @returns true when the frame was actually drawn. */
  render(): boolean {
    if (this.dirty === "none") {
      return false;
    }

    if (this.dirty === "full") {
      this.painter.repaint(this.strokes, this.openTail);
    } else {
      this.painter.appendPending(this.strokes, this.openTail);
    }
    this.dirty = "none";

    this.bloom.update(this.core);
    composeScene(this.displayCtx, {
      width: this.display.width,
      height: this.display.height,
      backgroundHex: this.backgroundHex,
      core: this.core,
      bloom: this.bloom,
    });
    return true;
  }

  start(): void {
    if (this.frame !== null) {
      return;
    }
    const loop = (): void => {
      this.render();
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.frame === null) {
      return;
    }
    cancelAnimationFrame(this.frame);
    this.frame = null;
  }
}
