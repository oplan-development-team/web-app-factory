import type { ComputedSky } from '../astro/compute';
import { starDotRadius } from '../astro/compute';
import { svgEl, svgText } from './svg-utils';
import { CHART_CX, CHART_CY, CHART_R } from './layout';
import { layOutStarLabels } from './starLabels';

/** Builds the constellation lines, star dots and labels around the chart centre. */
export function buildStarfield(sky: ComputedSky, showStarNames: boolean): SVGGElement {
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
  // Faintest first, so a bright star's larger dot sits on top of its
  // neighbours rather than being nibbled by them.
  const ordered = [...sky.stars].sort((a, b) => b.star.mag - a.star.mag);
  for (const p of ordered) {
    starGroup.appendChild(
      svgEl('circle', {
        cx: CHART_CX + p.x,
        cy: CHART_CY + p.y,
        r: starDotRadius(p.star.mag),
        class: p.star.name === undefined ? 'star' : 'star star-named',
      }),
    );
  }
  g.appendChild(starGroup);

  if (showStarNames) {
    const labelGroup = svgEl('g', { class: 'star-labels' });
    for (const label of layOutStarLabels(sky.stars, CHART_R)) {
      labelGroup.appendChild(
        svgText(CHART_CX + label.x, CHART_CY + label.y, label.text, { class: 'star-label' }),
      );
    }
    g.appendChild(labelGroup);
  }

  return g;
}
