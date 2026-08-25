import { type CanvasFactory, type CanvasLike, type Ctx2D, require2d, supportsCanvasFilter } from "./types";

export interface BloomLevel {
  /** How much smaller than the core layer this level is rendered. */
  readonly divisor: number;
  /** Blur radius applied in *this level's* pixels, so it widens with the divisor. */
  readonly blur: number;
  /** Opacity used when the level is added back over the artwork. */
  readonly alpha: number;
}

/**
 * Two levels are enough on screen: a tight halo hugging the ribbon and a wide
 * atmospheric one. Export adds a third, very wide level because a still image is
 * inspected closely and the extra falloff is essentially free there (NFR-001.4).
 */
export const PREVIEW_BLOOM_LEVELS: readonly BloomLevel[] = [
  { divisor: 4, blur: 3, alpha: 0.62 },
  { divisor: 16, blur: 3, alpha: 0.45 },
];

export const EXPORT_BLOOM_LEVELS: readonly BloomLevel[] = [
  { divisor: 4, blur: 3.5, alpha: 0.62 },
  { divisor: 16, blur: 3.5, alpha: 0.45 },
  { divisor: 48, blur: 3, alpha: 0.3 },
];

interface Layer {
  readonly canvas: CanvasLike;
  readonly ctx: Ctx2D;
  readonly level: BloomLevel;
}

/**
 * Turns the core layer into a glow by downscaling and blurring it a handful of
 * times, then adding the results back over the artwork.
 *
 * The cost is fixed per frame — a couple of `drawImage` calls on small canvases —
 * whereas the prototype's per-segment `shadowBlur` grew with the number of points
 * (NFR-001.1). Stacking two or three falloffs also produces a wider, smoother
 * halo than a single shadow radius could (NFR-001.6).
 */
export class BloomPipeline {
  private layers: Layer[] = [];
  private width = 0;
  private height = 0;
  private filterSupported: boolean | null = null;

  constructor(
    private readonly createCanvas: CanvasFactory,
    private readonly levels: readonly BloomLevel[]
  ) {}

  resize(width: number, height: number): void {
    if (this.width === width && this.height === height && this.layers.length > 0) {
      return;
    }
    this.width = width;
    this.height = height;
    this.layers = this.levels.map((level) => {
      const canvas = this.createCanvas(
        Math.max(1, Math.ceil(width / level.divisor)),
        Math.max(1, Math.ceil(height / level.divisor))
      );
      return { canvas, ctx: require2d(canvas), level };
    });
    this.filterSupported = null;
  }

  /** Rebuilds every level from the current contents of the core layer. */
  update(core: CanvasLike): void {
    let source: CanvasLike = core;
    for (const layer of this.layers) {
      this.renderLevel(layer, source);
      // Chaining off the previous (already smaller) level keeps the wide halo cheap.
      source = layer.canvas;
    }
  }

  private renderLevel(layer: Layer, source: CanvasLike): void {
    const { ctx, canvas, level } = layer;
    if (this.filterSupported === null) {
      this.filterSupported = supportsCanvasFilter(ctx);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    // Bilinear downscaling is itself a mild blur, and it is the only blurring
    // available when ctx.filter is unsupported (E-16).
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (this.filterSupported) {
      ctx.filter = `blur(${level.blur}px)`;
    }
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    ctx.filter = "none";
  }

  /** Adds every level back over `target`, widest halo first. */
  composite(target: Ctx2D, width: number, height: number): void {
    if (this.layers.length === 0) {
      return;
    }

    target.imageSmoothingEnabled = true;
    target.imageSmoothingQuality = "high";
    target.globalCompositeOperation = "lighter";
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i]!;
      target.globalAlpha = layer.level.alpha;
      target.drawImage(layer.canvas, 0, 0, width, height);
    }
    target.globalAlpha = 1;
    target.globalCompositeOperation = "source-over";
  }
}
