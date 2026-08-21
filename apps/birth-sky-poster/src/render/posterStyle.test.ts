// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { buildPosterSvg } from './chart';
import { POSTER_CSS } from './posterStyle';
import { computeSky } from '../astro/compute';
import { CONSTELLATIONS, STARS } from '../catalog';
import { CHART_R } from './layout';
import type { PosterInputs } from '../types';

const inputs: PosterInputs = {
  year: 2026,
  month: 8,
  day: 21,
  hour: 21,
  minute: 30,
  utcOffsetHours: 9,
  latitude: 35.6762,
  longitude: 139.6503,
  placeLabel: '東京',
  showConstellations: true,
  showStarNames: true,
};

function mountPoster(): SVGSVGElement {
  const style = document.createElement('style');
  style.textContent = POSTER_CSS;
  document.head.replaceChildren(style);

  const sky = computeSky(inputs, CHART_R, STARS, CONSTELLATIONS);
  const svg = buildPosterSvg(inputs, sky, {
    title: 'STAR CHART',
    dateLine: '2026.08.21',
    placeLine: 'TOKYO',
  });
  document.body.replaceChildren(svg);
  return svg;
}

/**
 * The font-family value that wins the cascade for the first matching element.
 *
 * jsdom does not substitute custom properties, so this returns the raw
 * `var(--font-...)` reference. That is precisely the thing under test: which
 * of the two variables the cascade selects. The face those variables resolve
 * to is checked in the browser by the Playwright suite.
 */
function familyVariableOf(selector: string): string {
  const node = document.querySelector(selector);
  if (node === null) throw new Error(`No element matched ${selector}`);
  return window.getComputedStyle(node).fontFamily;
}

beforeEach(() => {
  mountPoster();
});

/*
 * The design rests on an exceptionless split: a grotesque sans for language, a
 * monospace for every numeric or coordinate value.
 *
 * This was broken for the entire life of the prototype. A base rule written as
 * `.poster-root text { font-family: ... }` has specificity (0,1,1) and quietly
 * outranks every `.legend-value { font-family: ... }` rule (0,1,0), so the
 * whole poster rendered in the sans face while JetBrains Mono was still being
 * downloaded and embedded into every exported file. Nothing errored and the
 * difference is easy to miss by eye, so it is pinned here.
 */
describe('typographic split', () => {
  it.each([
    '.legend-value',
    '.star-label',
    '.date-text',
    '.place-text',
    '.title-subtext',
    '.ring-degree-label',
    '.alt-ring-label',
  ])('sets %s in the monospace face', (selector) => {
    expect(familyVariableOf(selector)).toBe('var(--font-mono)');
  });

  it.each(['.title-text', '.legend-label', '.ring-cardinal-label', '.footer-text'])(
    'sets %s in the sans face',
    (selector) => {
      expect(familyVariableOf(selector)).toBe('var(--font-sans)');
    },
  );
});

describe('editable text', () => {
  // Without this an SVG <text> only takes pointer events on its glyph
  // outlines, so a click between two letters falls through to the background
  // rect and the field looks unresponsive. WebKit hits this reliably.
  it('accepts pointer events across its whole box', () => {
    expect(window.getComputedStyle(document.querySelector('.editable')!).pointerEvents).toBe('all');
  });
});
