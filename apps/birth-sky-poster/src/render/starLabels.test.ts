import { describe, expect, it } from 'vitest';
import type { ProjectedStar } from '../astro/compute';
import { LABEL_MAGNITUDE_LIMIT, layOutStarLabels } from './starLabels';

const CHART_RADIUS = 322;

function star(
  overrides: Partial<{ name: string; mag: number; x: number; y: number }> = {},
): ProjectedStar {
  const { name, mag = 1, x = 0, y = 0 } = overrides;
  return {
    star: {
      id: `HIP${Math.random()}`,
      ra: 0,
      dec: 0,
      mag,
      ...(name === undefined ? {} : { name }),
    },
    x,
    y,
    altDeg: 45,
  };
}

describe('layOutStarLabels', () => {
  it('labels a named star bright enough to qualify', () => {
    const labels = layOutStarLabels([star({ name: 'Vega', mag: 0.03 })], CHART_RADIUS);

    expect(labels).toHaveLength(1);
    expect(labels[0]?.text).toBe('Vega');
  });

  it('skips stars without a proper name', () => {
    expect(layOutStarLabels([star({ mag: 0.5 })], CHART_RADIUS)).toEqual([]);
  });

  it('skips stars fainter than the label limit', () => {
    const tooFaint = layOutStarLabels(
      [star({ name: 'Faint', mag: LABEL_MAGNITUDE_LIMIT + 0.1 })],
      CHART_RADIUS,
    );
    const justBright = layOutStarLabels(
      [star({ name: 'Bright', mag: LABEL_MAGNITUDE_LIMIT })],
      CHART_RADIUS,
    );

    expect(tooFaint).toEqual([]);
    expect(justBright).toHaveLength(1);
  });

  it('places the label to the right of the star, clear of its dot', () => {
    const labels = layOutStarLabels([star({ name: 'Vega', mag: 0.03, x: 50, y: -20 })], CHART_RADIUS);

    expect(labels[0]!.x).toBeGreaterThan(50);
    expect(labels[0]!.y).toBeCloseTo(-20 + 9.5 / 3, 5);
  });

  // Overlapping labels are the single most visible way a dense star chart
  // stops looking like a drafted plate (FR-006.2).
  it('drops a label that would collide with one already placed', () => {
    const labels = layOutStarLabels(
      [
        star({ name: 'Brightest', mag: 0.0, x: 0, y: 0 }),
        star({ name: 'Dimmer', mag: 1.0, x: 2, y: 1 }),
      ],
      CHART_RADIUS,
    );

    expect(labels.map((l) => l.text)).toEqual(['Brightest']);
  });

  it('gives the brighter star priority regardless of input order', () => {
    const stars = [
      star({ name: 'Dimmer', mag: 2.0, x: 0, y: 0 }),
      star({ name: 'Brighter', mag: 0.1, x: 3, y: 2 }),
    ];

    expect(layOutStarLabels(stars, CHART_RADIUS).map((l) => l.text)).toEqual(['Brighter']);
  });

  it('keeps both labels when they are far enough apart', () => {
    const labels = layOutStarLabels(
      [
        star({ name: 'Vega', mag: 0.03, x: -100, y: -100 }),
        star({ name: 'Altair', mag: 0.76, x: 100, y: 100 }),
      ],
      CHART_RADIUS,
    );

    expect(labels.map((l) => l.text).sort()).toEqual(['Altair', 'Vega']);
  });

  it('drops a label that would spill outside the horizon circle', () => {
    const nearEdge = layOutStarLabels(
      [star({ name: 'Edgewise', mag: 0.5, x: CHART_RADIUS - 2, y: 0 })],
      CHART_RADIUS,
    );

    expect(nearEdge).toEqual([]);
  });

  it('never emits a label whose box leaves the chart', () => {
    const stars = Array.from({ length: 60 }, (_, i) => {
      const angle = (i / 60) * Math.PI * 2;
      return star({
        name: `S${i}`,
        mag: 0.5,
        x: CHART_RADIUS * 0.97 * Math.cos(angle),
        y: CHART_RADIUS * 0.97 * Math.sin(angle),
      });
    });

    for (const label of layOutStarLabels(stars, CHART_RADIUS)) {
      const width = label.text.length * 9.5 * 0.6;
      expect(Math.hypot(label.x + width, label.y)).toBeLessThanOrEqual(CHART_RADIUS);
    }
  });

  it('returns nothing for an empty sky', () => {
    expect(layOutStarLabels([], CHART_RADIUS)).toEqual([]);
  });

  it('produces no two overlapping boxes for a realistic crowded field', () => {
    const stars = Array.from({ length: 40 }, (_, i) =>
      star({ name: `Star${i}`, mag: i / 20, x: (i % 8) * 12, y: Math.floor(i / 8) * 6 }),
    );

    const labels = layOutStarLabels(stars, CHART_RADIUS);

    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i]!;
        const b = labels[j]!;
        const aRight = a.x + a.text.length * 9.5 * 0.6;
        const bRight = b.x + b.text.length * 9.5 * 0.6;

        const horizontallyApart = aRight <= b.x || bRight <= a.x;
        const verticallyApart = Math.abs(a.y - b.y) >= 9.5;

        expect(horizontallyApart || verticallyApart).toBe(true);
      }
    }
  });
});
