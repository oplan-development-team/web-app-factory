import type { StudioState } from '../types';
import { buildGeometry } from '../layerPlan';

/** Draws the current studio state onto any canvas 2D context, at any pixel
 * size (used both for the live preview canvas and for the higher-resolution
 * PNG export canvas — same function, different `size`/`ctx`). */
export function renderStudio(ctx: CanvasRenderingContext2D, state: StudioState, size: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  state.layers.forEach((layer, index) => {
    const geoms = buildGeometry(layer, size);
    // The bottom-most layer has nothing beneath it but blank white canvas.
    // Blend modes describe how a layer interacts with what's already
    // painted, so applying e.g. 'difference'/'exclusion' to the base layer
    // is a near no-op against white (diff(white, black) = white — the ink
    // vanishes) or an identity against black. Every real layer stack
    // (Photoshop, CSS mix-blend-mode, etc.) treats the base as Normal.
    const mode: GlobalCompositeOperation =
      index === 0 ? 'source-over' : layer.blendOverride ? layer.blendMode : state.globalBlendMode;
    ctx.save();
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = layer.opacity;
    ctx.strokeStyle = layer.color;
    ctx.fillStyle = layer.color;
    ctx.lineCap = 'butt';

    for (const g of geoms) {
      if (g.kind === 'line') {
        ctx.lineWidth = Math.max(layer.thickness, 0.5);
        ctx.beginPath();
        ctx.moveTo(g.x1, g.y1);
        ctx.lineTo(g.x2, g.y2);
        ctx.stroke();
      } else if (g.kind === 'dot') {
        ctx.beginPath();
        ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (g.kind === 'ring') {
        ctx.lineWidth = Math.max(layer.thickness, 0.5);
        ctx.beginPath();
        ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  });
  ctx.restore();
}
