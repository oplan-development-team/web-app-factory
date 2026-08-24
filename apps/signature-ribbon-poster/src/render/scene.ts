import type { BloomPipeline } from "./bloom";
import type { CanvasLike, Ctx2D } from "./types";

export interface SceneOptions {
  readonly width: number;
  readonly height: number;
  readonly backgroundHex: string;
  readonly core: CanvasLike;
  readonly bloom: BloomPipeline;
}

/**
 * Assembles the finished artwork: flat background, the glow halos on top of it,
 * then the crisp ribbon core last so the centre of the stroke stays sharp.
 */
export function composeScene(ctx: Ctx2D, options: SceneOptions): void {
  const { width, height, backgroundHex, core, bloom } = options;

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = backgroundHex;
  ctx.fillRect(0, 0, width, height);

  bloom.composite(ctx, width, height);

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1;
  ctx.drawImage(core, 0, 0, width, height);

  ctx.globalCompositeOperation = "source-over";
}
