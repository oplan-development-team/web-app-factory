import type { ComputedSky } from '../astro/compute';
import { starDotRadius } from '../astro/compute';
import { svgEl, svgText } from './svg-utils';
import { CHART_CX, CHART_CY } from './layout';

/** Builds the constellation lines + star field, positioned around the chart center. */
export function buildStarfield(sky: ComputedSky): SVGGElement {
  const g = svgEl('g', { class: 'starfield' });

  const lineGroup = svgEl('g', { class: 'constellation-lines' });
  for (const seg of sky.segments) {
    lineGroup.appendChild(
      svgEl('line', {
        x1: CHART_CX + seg.a.x,
        y1: CHART_CY + seg.a.y,
        x2: CHART_CX + seg.b.x,
        y2: CHART_CY + seg.b.y,
      }),
    );
  }
  g.appendChild(lineGroup);

  const starGroup = svgEl('g', { class: 'stars' });
  // Draw fainter stars first so bright named stars sit on top.
  const ordered = [...sky.stars].sort((a, b) => b.star.mag - a.star.mag);
  for (const p of ordered) {
    const r = starDotRadius(p.star.mag);
    starGroup.appendChild(
      svgEl('circle', {
        cx: CHART_CX + p.x,
        cy: CHART_CY + p.y,
        r,
        class: p.star.name ? 'star star-named' : 'star',
      }),
    );
    if (p.star.name && r > 2.4) {
      starGroup.appendChild(
        svgText(CHART_CX + p.x + r + 4, CHART_CY + p.y + 3, p.star.name, {
          class: 'star-label',
        }),
      );
    }
  }
  g.appendChild(starGroup);

  return g;
}
