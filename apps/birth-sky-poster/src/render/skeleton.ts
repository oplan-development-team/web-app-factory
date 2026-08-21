import { svgEl } from './svg-utils';
import { POSTER_CSS } from './posterStyle';
import { CHART_CX, CHART_CY, CHART_R, POSTER_H, POSTER_W, RING_INNER, RING_OUTER } from './layout';

const DEG2RAD = Math.PI / 180;

/**
 * The placeholder shown before the first render, and behind the error state.
 *
 * A generic spinner would be a library default dropped into a page that
 * otherwise has a point of view, so the loading state is drawn in the same
 * language as the product: the instrument dial with its readings not yet
 * taken. It occupies exactly the poster's aspect ratio, so swapping the real
 * chart in shifts nothing (FR-009.2, FR-010.1).
 */
export function buildSkeletonSvg(): SVGSVGElement {
  const svg = svgEl('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${POSTER_W} ${POSTER_H}`,
    class: 'poster-root poster-skeleton',
    'aria-hidden': 'true',
    focusable: 'false',
  });

  const style = svgEl('style');
  style.textContent = POSTER_CSS;
  svg.appendChild(style);

  svg.appendChild(
    svgEl('rect', { x: 0, y: 0, width: POSTER_W, height: POSTER_H, class: 'poster-bg' }),
  );

  // The dial's two framing rings, and the horizon circle, with nothing plotted.
  for (const r of [RING_INNER, RING_OUTER]) {
    svg.appendChild(svgEl('circle', { cx: CHART_CX, cy: CHART_CY, r, class: 'ring-line' }));
  }
  svg.appendChild(
    svgEl('circle', { cx: CHART_CX, cy: CHART_CY, r: CHART_R, class: 'skeleton-horizon' }),
  );
  for (const alt of [30, 60]) {
    svg.appendChild(
      svgEl('circle', {
        cx: CHART_CX,
        cy: CHART_CY,
        r: CHART_R * (1 - alt / 90),
        class: 'alt-ring',
      }),
    );
  }

  // Cardinal ticks only: enough to read as an instrument, sparse enough to
  // read as "not yet measured".
  for (const deg of [0, 90, 180, 270]) {
    const a = deg * DEG2RAD;
    svg.appendChild(
      svgEl('line', {
        x1: CHART_CX + RING_INNER * Math.sin(a),
        y1: CHART_CY - RING_INNER * Math.cos(a),
        x2: CHART_CX + RING_OUTER * Math.sin(a),
        y2: CHART_CY - RING_OUTER * Math.cos(a),
        class: 'tick tick-cardinal',
      }),
    );
  }

  return svg;
}
