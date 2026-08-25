import type { BloomPipeline } from "./bloom";
import type { CanvasLike, Ctx2D } from "./types";

export interface SceneOptions {
  readonly width: number;
  readonly height: number;
  readonly backgroundHex: string;
  /** The ribbon body, in pure hue. Also the source the bloom was built from. */
  readonly body: CanvasLike;
  readonly bloom: BloomPipeline;
  /** The hot-core highlight, drawn last. Omitted when it is painted separately. */
  readonly highlight?: CanvasLike;
}

/**
 * Assembles the finished artwork: flat background, the glow halos over it, the
 * ribbon body, and finally the hot core so the centre of the stroke stays sharp.
 */
export function composeScene(ctx: Ctx2D, options: SceneOptions): void {
  const { width, height, backgroundHex, body, bloom, highlight } = options;

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = backgroundHex;
  ctx.fillRect(0, 0, width, height);

  bloom.composite(ctx, width, height);

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1;
  ctx.drawImage(body, 0, 0, width, height);
  if (highlight) {
    ctx.drawImage(highlight, 0, 0, width, height);
  }

  ctx.globalCompositeOperation = "source-over";
}
