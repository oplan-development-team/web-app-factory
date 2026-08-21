import { svgEl, svgText } from './svg-utils';
import {
  CHART_CX,
  CHART_CY,
  CHART_R,
  RING_INNER,
  RING_LABEL_R,
  RING_MAJOR_TICK,
  RING_OUTER,
} from './layout';

const DEG2RAD = Math.PI / 180;

function pointOnCircle(radius: number, azDeg: number) {
  const a = azDeg * DEG2RAD;
  return { x: CHART_CX + radius * Math.sin(a), y: CHART_CY - radius * Math.cos(a) };
}

/** Builds the instrument-style dial: horizon circle, altitude rings, compass tick ring. */
export function buildDial(): SVGGElement {
  const g = svgEl('g', { class: 'dial' });

  // Altitude reference rings (30deg, 60deg above horizon), faint.
  for (const alt of [30, 60]) {
    const r = CHART_R * (1 - alt / 90);
    g.appendChild(
      svgEl('circle', {
        cx: CHART_CX,
        cy: CHART_CY,
        r,
        class: 'alt-ring',
      }),
    );
    const labelPt = pointOnCircle(r, 359);
    g.appendChild(
      svgText(labelPt.x + 6, labelPt.y - 4, `${alt}°`, { class: 'alt-ring-label' }),
    );
  }

  // Horizon circle -- the poster's functional red accent for "sea level".
  g.appendChild(
    svgEl('circle', { cx: CHART_CX, cy: CHART_CY, r: CHART_R, class: 'horizon-circle' }),
  );

  // Compass tick ring.
  g.appendChild(
    svgEl('circle', { cx: CHART_CX, cy: CHART_CY, r: RING_INNER, class: 'ring-line' }),
  );
  g.appendChild(
    svgEl('circle', { cx: CHART_CX, cy: CHART_CY, r: RING_OUTER, class: 'ring-line' }),
  );

  const cardinals: [number, string][] = [
    [0, 'N'],
    [90, 'E'],
    [180, 'S'],
    [270, 'W'],
  ];
  const cardinalSet = new Set(cardinals.map(([deg]) => deg));

  for (let deg = 0; deg < 360; deg += 5) {
    const isMajor = deg % 30 === 0;
    const isCardinal = cardinalSet.has(deg);
    const inner = pointOnCircle(RING_INNER, deg);
    const outer = pointOnCircle(isMajor ? RING_MAJOR_TICK : RING_OUTER, deg);
    g.appendChild(
      svgEl('line', {
        x1: inner.x,
        y1: inner.y,
        x2: outer.x,
        y2: outer.y,
        class: isCardinal ? 'tick tick-cardinal' : isMajor ? 'tick tick-major' : 'tick',
      }),
    );
    if (isMajor && !isCardinal) {
      const lp = pointOnCircle(RING_LABEL_R, deg);
      g.appendChild(
        svgText(lp.x, lp.y, String(deg).padStart(3, '0'), {
          class: 'ring-degree-label',
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
        }),
      );
    }
  }

  for (const [deg, label] of cardinals) {
    const lp = pointOnCircle(RING_LABEL_R + 6, deg);
    g.appendChild(
      svgText(lp.x, lp.y, label, {
        class: label === 'N' ? 'ring-cardinal-label ring-cardinal-label-north' : 'ring-cardinal-label',
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
      }),
    );
  }

  // North pointer -- the poster's "instrument needle" accent, frozen toward
  // true north as read at the observation moment.
  const needleTip = pointOnCircle(RING_INNER - 2, 0);
  g.appendChild(
    svgEl('line', {
      x1: CHART_CX,
      y1: CHART_CY,
      x2: needleTip.x,
      y2: needleTip.y,
      class: 'north-needle',
    }),
  );
  g.appendChild(svgEl('circle', { cx: CHART_CX, cy: CHART_CY, r: 3.4, class: 'zenith-mark' }));

  return g;
}
