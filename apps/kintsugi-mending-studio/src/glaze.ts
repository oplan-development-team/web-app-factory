import type { GlazeId } from './types';

export interface GlazeSpec {
  id: GlazeId;
  label: string;
  base: string;
  mid: string;
  shadow: string;
  highlight: string;
  swatchCss: string;
}

export const GLAZES: Record<GlazeId, GlazeSpec> = {
  celadon: {
    id: 'celadon',
    label: '青磁',
    base: '#8fb6a3',
    mid: '#5f8873',
    shadow: '#2a4438',
    highlight: '#e2f2e8',
    swatchCss: 'radial-gradient(circle at 33% 28%, #e2f2e8, #8fb6a3 46%, #2a4438 100%)',
  },
  hakuji: {
    id: 'hakuji',
    label: '白磁',
    base: '#efe7d3',
    mid: '#cdbf9c',
    shadow: '#867a5d',
    highlight: '#fffdf6',
    swatchCss: 'radial-gradient(circle at 33% 28%, #fffdf6, #efe7d3 46%, #867a5d 100%)',
  },
  tenmoku: {
    id: 'tenmoku',
    label: '黒漆・天目',
    base: '#2b2622',
    mid: '#17130f',
    shadow: '#040403',
    highlight: '#6b6151',
    swatchCss: 'radial-gradient(circle at 33% 28%, #6b6151, #2b2622 46%, #040403 100%)',
  },
  shinsha: {
    id: 'shinsha',
    label: '辰砂・銅赤',
    base: '#a5402e',
    mid: '#752116',
    shadow: '#340c07',
    highlight: '#eb9770',
    swatchCss: 'radial-gradient(circle at 33% 28%, #eb9770, #a5402e 46%, #340c07 100%)',
  },
};

export const GLAZE_ORDER: GlazeId[] = ['celadon', 'hakuji', 'tenmoku', 'shinsha'];

/**
 * Paints the vessel with a radial gradient + specular highlight so the
 * glaze reads as a thick, lustrous surface rather than a flat fill.
 */
export function paintGlaze(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  glaze: GlazeSpec,
  cx: number,
  cy: number,
  radius: number,
): void {
  ctx.save();
  ctx.clip(path);

  const body = ctx.createRadialGradient(
    cx - radius * 0.26,
    cy - radius * 0.34,
    radius * 0.04,
    cx,
    cy,
    radius * 1.2,
  );
  body.addColorStop(0, glaze.highlight);
  body.addColorStop(0.32, glaze.base);
  body.addColorStop(0.74, glaze.mid);
  body.addColorStop(1, glaze.shadow);
  ctx.fillStyle = body;
  ctx.fillRect(cx - radius * 2.2, cy - radius * 2.2, radius * 4.4, radius * 4.4);

  const specular = ctx.createRadialGradient(
    cx - radius * 0.34,
    cy - radius * 0.46,
    0,
    cx - radius * 0.34,
    cy - radius * 0.46,
    radius * 0.55,
  );
  specular.addColorStop(0, 'rgba(255,255,255,0.4)');
  specular.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specular;
  ctx.fillRect(cx - radius * 2.2, cy - radius * 2.2, radius * 4.4, radius * 4.4);

  const rimShade = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius * 1.05);
  rimShade.addColorStop(0, 'rgba(0,0,0,0)');
  rimShade.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = rimShade;
  ctx.fillRect(cx - radius * 2.2, cy - radius * 2.2, radius * 4.4, radius * 4.4);

  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = Math.max(1, radius * 0.007);
  ctx.stroke(path);
  ctx.restore();
}
