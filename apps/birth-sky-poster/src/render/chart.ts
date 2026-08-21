import type { ComputedSky } from '../astro/compute';
import type { PosterInputs, PosterTextOverrides } from '../types';
import { svgEl } from './svg-utils';
import { buildDial } from './dial';
import { buildStarfield } from './starfield';
import { buildFooter, buildLegend, buildMasthead } from './legend';
import { POSTER_CSS } from './posterStyle';
import { POSTER_H, POSTER_W } from './layout';

export { POSTER_W, POSTER_H };

/** Builds the full poster as a standalone SVG element (ready to mount, or to serialize for export). */
export function buildPosterSvg(
  inputs: PosterInputs,
  sky: ComputedSky,
  text: PosterTextOverrides,
): SVGSVGElement {
  const svg = svgEl('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${POSTER_W} ${POSTER_H}`,
    width: POSTER_W,
    height: POSTER_H,
    class: 'poster-root',
    role: 'img',
    'aria-label': `${text.title} — ${text.placeLine} ${text.dateLine} の星図ポスター`,
  });

  const style = svgEl('style');
  style.textContent = POSTER_CSS;
  svg.appendChild(style);

  svg.appendChild(
    svgEl('rect', { x: 0, y: 0, width: POSTER_W, height: POSTER_H, class: 'poster-bg' }),
  );

  svg.appendChild(buildMasthead(text));
  svg.appendChild(buildDial());
  svg.appendChild(buildStarfield(sky, inputs.showStarNames));
  svg.appendChild(buildLegend(inputs, sky));
  svg.appendChild(buildFooter());

  return svg;
}
