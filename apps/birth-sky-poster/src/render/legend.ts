import type { ComputedSky } from '../astro/compute';
import type { PosterInputs, PosterTextOverrides } from '../types';
import { svgEl, svgText } from './svg-utils';
import {
  FOOTER_TOP,
  LEGEND_COLS,
  LEGEND_ROWS,
  LEGEND_ROW_H,
  LEGEND_TOP,
  MARGIN,
  POSTER_W,
  legendCell,
} from './layout';
import {
  formatDate,
  formatLat,
  formatLon,
  formatSiderealTime,
  formatUtcOffset,
} from './format';

export const EDITABLE_IDS = {
  title: 'poster-editable-title',
  date: 'poster-editable-date',
  place: 'poster-editable-place',
} as const;

export function buildMasthead(text: PosterTextOverrides): SVGGElement {
  const g = svgEl('g', { class: 'masthead' });

  g.appendChild(
    svgText(MARGIN, 108, text.title, {
      id: EDITABLE_IDS.title,
      class: 'title-text editable',
    }),
  );
  g.appendChild(
    svgText(MARGIN, 140, 'CELESTIAL POSITION CHART — AZIMUTHAL EQUIDISTANT PROJECTION', {
      class: 'title-subtext',
    }),
  );

  g.appendChild(
    svgText(POSTER_W - MARGIN, 100, text.dateLine, {
      id: EDITABLE_IDS.date,
      class: 'date-text editable',
      'text-anchor': 'end',
    }),
  );
  g.appendChild(
    svgText(POSTER_W - MARGIN, 128, text.placeLine, {
      id: EDITABLE_IDS.place,
      class: 'place-text editable',
      'text-anchor': 'end',
    }),
  );

  g.appendChild(
    svgEl('line', {
      x1: MARGIN,
      y1: 160,
      x2: POSTER_W - MARGIN,
      y2: 160,
      class: 'rule rule-strong',
    }),
  );

  return g;
}

interface LegendField {
  label: string;
  value: string;
}

function buildFields(inputs: PosterInputs, sky: ComputedSky): LegendField[] {
  return [
    { label: 'LOCAL TIME', value: `${String(inputs.hour).padStart(2, '0')}:${String(inputs.minute).padStart(2, '0')} ${formatUtcOffset(inputs.utcOffsetHours)}` },
    { label: 'LATITUDE', value: formatLat(inputs.latitude) },
    { label: 'LONGITUDE', value: formatLon(inputs.longitude) },
    { label: 'EPOCH', value: 'J2000.0' },
    { label: 'JULIAN DATE', value: sky.jd.toFixed(5) },
    { label: 'GREENWICH SIDEREAL TIME', value: formatSiderealTime(sky.gstDeg) },
    { label: 'LOCAL SIDEREAL TIME', value: formatSiderealTime(sky.lstDeg) },
    { label: 'STARS SHOWN (≤ 4.5m)', value: String(sky.stars.length) },
  ];
}

export function buildLegend(inputs: PosterInputs, sky: ComputedSky): SVGGElement {
  const g = svgEl('g', { class: 'legend' });

  g.appendChild(
    svgEl('line', {
      x1: MARGIN,
      y1: LEGEND_TOP,
      x2: POSTER_W - MARGIN,
      y2: LEGEND_TOP,
      class: 'rule rule-strong',
    }),
  );

  const fields = buildFields(inputs, sky);
  for (const [i, field] of fields.entries()) {
    const row = Math.floor(i / LEGEND_COLS);
    const col = i % LEGEND_COLS;
    const cell = legendCell(row, col);

    g.appendChild(
      svgText(cell.x, cell.y + 26, field.label, { class: 'legend-label' }),
    );
    g.appendChild(
      svgText(cell.x, cell.y + 58, field.value, { class: 'legend-value' }),
    );

    if (col > 0) {
      g.appendChild(
        svgEl('line', {
          x1: cell.x,
          y1: cell.y + 6,
          x2: cell.x,
          y2: cell.y + cell.h - 18,
          class: 'rule rule-faint',
        }),
      );
    }
  }

  for (let r = 1; r < LEGEND_ROWS; r++) {
    const y = LEGEND_TOP + r * LEGEND_ROW_H;
    g.appendChild(
      svgEl('line', { x1: MARGIN, y1: y, x2: POSTER_W - MARGIN, y2: y, class: 'rule rule-faint' }),
    );
  }

  const bottomY = LEGEND_TOP + LEGEND_ROWS * LEGEND_ROW_H;
  g.appendChild(
    svgEl('line', { x1: MARGIN, y1: bottomY, x2: POSTER_W - MARGIN, y2: bottomY, class: 'rule rule-strong' }),
  );

  return g;
}

export function buildFooter(): SVGGElement {
  const g = svgEl('g', { class: 'footer' });
  const lines = [
    '簡易恒星暦（J2000.0平均位置）による計算です。歳差・固有運動・大気差の補正は行っていません。',
    '入力された日時・位置情報はすべてブラウザ内で計算され、外部に送信されません。',
  ];
  lines.forEach((line, i) => {
    g.appendChild(svgText(MARGIN, FOOTER_TOP + i * 22, line, { class: 'footer-text' }));
  });
  return g;
}

export function defaultTitle(): string {
  return 'STAR CHART';
}

export function defaultDateLine(inputs: PosterInputs): string {
  return formatDate(inputs.year, inputs.month, inputs.day);
}

export function defaultPlaceLine(inputs: PosterInputs): string {
  return inputs.placeLabel.trim() ? inputs.placeLabel.trim().toUpperCase() : 'UNSPECIFIED LOCATION';
}
