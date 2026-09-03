import { formatPx } from '../core/output';
import { GRADE_LABEL, alignmentRatio, gradeCost } from '../core/quality';
import { el, setText } from './dom';
import type { SeamState } from './store';

export interface SeamRow {
  readonly element: HTMLElement;
  update(seam: SeamState): void;
}

/**
 * Colour carries the measurement: amber for a seam that still needs work,
 * cyan for one that is pixel-identical, and a continuous mix in between. The
 * mix is done in oklab so the midpoints stay evenly bright instead of dipping
 * through a muddy olive.
 */
function tintFor(ratio: number): string {
  const percent = Math.round(ratio * 100);
  return `color-mix(in oklab, var(--align) ${percent}%, var(--drift))`;
}

export function createSeamRow(index: number, onOpen: (index: number) => void): SeamRow {
  const value = el('span', { class: 'seam__value mono', text: '0' });
  const unit = el('span', { class: 'seam__unit', text: 'px' });
  const grade = el('span', { class: 'seam__grade' });
  const delta = el('span', { class: 'seam__delta mono' });
  const fill = el('span', { class: 'seam__bar-fill' });

  const element = el(
    'button',
    {
      class: 'seam',
      type: 'button',
      attrs: { 'data-seam-row': index, 'aria-label': `継ぎ目 ${index + 1} を調整` },
      on: { click: () => onOpen(index) },
    },
    [
      el('span', { class: 'seam__rail', attrs: { 'aria-hidden': 'true' } }),
      el('span', { class: 'seam__body' }, [
        el('span', { class: 'seam__head' }, [
          el('span', { class: 'seam__caption', text: `継ぎ目 ${index + 1}` }),
          grade,
        ]),
        el('span', { class: 'seam__readout' }, [value, unit, delta]),
        el('span', { class: 'seam__bar' }, [fill]),
      ]),
      el('span', { class: 'seam__chevron', text: '›', attrs: { 'aria-hidden': 'true' } }),
    ],
  );

  return {
    element,
    update(seam) {
      const ratio = alignmentRatio(seam.cost);
      const kind = gradeCost(seam.cost);
      element.style.setProperty('--seam-tint', tintFor(ratio));
      element.dataset.grade = kind;
      setText(value, formatPx(seam.overlapPx));
      setText(grade, GRADE_LABEL[kind]);
      setText(
        delta,
        seam.cost === null || !Number.isFinite(seam.cost) ? '' : `Δ${seam.cost.toFixed(2)}`,
      );
      fill.style.width = `${Math.round(ratio * 100)}%`;
      unit.hidden = false;
    },
  };
}
