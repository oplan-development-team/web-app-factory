import type { VesselId } from './types';
import { VESSELS, computeTransform, buildCanvasPath } from './vessels';

/** Renders a small hairline silhouette icon for the vessel picker, reusing
 * the exact same bezier geometry as the main canvas so the icon is a true
 * miniature rather than a generic placeholder glyph. */
export function drawVesselIcon(canvas: HTMLCanvasElement, id: VesselId, selected: boolean): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const spec = VESSELS[id];
  const transform = computeTransform(w, h, spec, 0.72);
  const path = buildCanvasPath(spec, transform);

  ctx.fillStyle = selected ? 'rgba(212,175,55,0.18)' : 'rgba(255,255,255,0.045)';
  ctx.fill(path);
  ctx.strokeStyle = selected ? 'rgba(244,229,161,0.95)' : 'rgba(212,175,55,0.45)';
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.016);
  ctx.stroke(path);
}
