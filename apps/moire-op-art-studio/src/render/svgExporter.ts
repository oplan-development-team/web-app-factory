import type { BlendMode, StudioState } from '../types';
import { buildGeometry } from '../layerPlan';

const BLEND_CSS: Record<BlendMode, string> = {
  'source-over': 'normal',
  multiply: 'multiply',
  difference: 'difference',
  exclusion: 'exclusion',
};

/** `<input type="color">` always yields "#rrggbb"; this guards against any
 * unexpected value ever reaching raw string interpolation into markup. */
function safeColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** Rebuilds every layer as plain SVG primitives (<line>/<circle>) using the
 * exact same geometry function the canvas preview uses, so the vector export
 * is structurally identical to what's on screen. */
export function buildStudioSVG(state: StudioState, size: number): string {
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
  );
  parts.push(`<defs><clipPath id="frame"><rect x="0" y="0" width="${size}" height="${size}" /></clipPath></defs>`);
  parts.push(`<g clip-path="url(#frame)">`);
  parts.push(`<rect x="0" y="0" width="${size}" height="${size}" fill="#ffffff" />`);

  state.layers.forEach((layer, index) => {
    const geoms = buildGeometry(layer, size);
    // Keep in sync with canvasRenderer.ts: the base layer always renders
    // Normal, matching how the live preview composites it.
    const mode: BlendMode = index === 0 ? 'source-over' : layer.blendOverride ? layer.blendMode : state.globalBlendMode;
    const color = safeColor(layer.color);
    const opacity = safeNumber(layer.opacity);
    const weight = Math.max(safeNumber(layer.thickness), 0.5);

    parts.push(`<g style="mix-blend-mode:${BLEND_CSS[mode]}" opacity="${opacity}">`);
    if (layer.type === 'lines') {
      for (const g of geoms) {
        if (g.kind !== 'line') continue;
        parts.push(
          `<line x1="${g.x1.toFixed(2)}" y1="${g.y1.toFixed(2)}" x2="${g.x2.toFixed(2)}" y2="${g.y2.toFixed(
            2
          )}" stroke="${color}" stroke-width="${weight}" />`
        );
      }
    } else if (layer.type === 'dots') {
      for (const g of geoms) {
        if (g.kind !== 'dot') continue;
        parts.push(`<circle cx="${g.cx.toFixed(2)}" cy="${g.cy.toFixed(2)}" r="${g.r.toFixed(2)}" fill="${color}" />`);
      }
    } else if (layer.type === 'circles') {
      for (const g of geoms) {
        if (g.kind !== 'ring') continue;
        parts.push(
          `<circle cx="${g.cx.toFixed(2)}" cy="${g.cy.toFixed(2)}" r="${g.r.toFixed(
            2
          )}" fill="none" stroke="${color}" stroke-width="${weight}" />`
        );
      }
    }
    parts.push('</g>');
  });

  parts.push('</g>');
  parts.push('</svg>');
  return parts.join('');
}
