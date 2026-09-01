import { formatPx } from '../core/output';
import { GRADE_LABEL, alignmentRatio, gradeCost } from '../core/quality';
import type { FrontLayer } from '../core/types';
import { el, setText, toggleAttr } from './dom';
import { draggable } from './pointer';
import { seamList, type AppState, type SeamState } from './store';

/** Ratio of loupe CSS pixels to composed image pixels. */
export type PaintLoupe = (canvas: HTMLCanvasElement, index: number, diff: boolean) => number;

export interface SheetCallbacks {
  readonly onOverlap: (index: number, value: number) => void;
  readonly onFront: (index: number, front: FrontLayer) => void;
  readonly onDiff: (diff: boolean) => void;
  readonly onRedetect: (index: number) => void;
  readonly onClose: () => void;
  readonly paint: PaintLoupe;
}

export interface SeamSheet {
  readonly element: HTMLElement;
  update(state: AppState): void;
}

const DISMISS_PX = 96;

function segmented(
  label: string,
  options: readonly { value: string; text: string }[],
  onPick: (value: string) => void,
): { root: HTMLElement; select: (value: string) => void } {
  const buttons = options.map((option) =>
    el('button', {
      class: 'segmented__btn',
      type: 'button',
      text: option.text,
      attrs: { 'data-value': option.value, role: 'radio', 'aria-checked': 'false' },
      on: { click: () => onPick(option.value) },
    }),
  );
  const root = el(
    'div',
    { class: 'segmented', attrs: { role: 'radiogroup', 'aria-label': label } },
    buttons,
  );
  return {
    root,
    select(value) {
      for (const button of buttons) {
        button.setAttribute('aria-checked', String(button.dataset.value === value));
      }
    },
  };
}

/**
 * The per-seam adjustment sheet.
 *
 * Everything needed to judge and fix one seam lives here: a full-resolution
 * crop of the join, the number, and the controls. The crop is the point — the
 * whole-page preview is drawn small, and a one-pixel misalignment is invisible
 * at that size.
 */
export function createSeamSheet(callbacks: SheetCallbacks): SeamSheet {
  let index = 0;
  let scale = 1;
  let dragStart = 0;

  const title = el('h2', { class: 'sheet__title' });
  const grade = el('span', { class: 'sheet__grade' });
  const canvas = el('canvas', { class: 'loupe__canvas' });
  const band = el('div', { class: 'loupe__band', attrs: { 'aria-hidden': 'true' } });
  const loupe = el('div', { class: 'loupe' }, [canvas, band]);

  const value = el('span', { class: 'sheet__value mono', text: '0' });
  const max = el('span', { class: 'sheet__max mono' });

  const input = el('input', {
    class: 'sheet__input mono',
    type: 'number',
    attrs: { min: 0, step: 1, inputmode: 'numeric', 'aria-label': '重なり量（px）' },
  });

  const commit = (next: number) => {
    if (!Number.isFinite(next)) return;
    callbacks.onOverlap(index, Math.round(next));
  };

  input.addEventListener('change', () => commit(Number(input.value)));
  input.addEventListener('keydown', (event) => {
    const key = (event as KeyboardEvent).key;
    if (key !== 'ArrowUp' && key !== 'ArrowDown') return;
    event.preventDefault();
    const step = (event as KeyboardEvent).shiftKey ? 10 : 1;
    commit(Number(input.value) + (key === 'ArrowUp' ? step : -step));
  });

  const stepButton = (delta: number) =>
    el('button', {
      class: 'sheet__step',
      type: 'button',
      text: `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`,
      attrs: { 'aria-label': `重なりを${Math.abs(delta)}px${delta > 0 ? '増やす' : '減らす'}` },
      on: { click: () => commit(Number(input.value) + delta) },
    });

  const front = segmented(
    '重なり部分で前面に出すショット',
    [
      { value: 'upper', text: '上を前面' },
      { value: 'lower', text: '下を前面' },
    ],
    (picked) => callbacks.onFront(index, picked as FrontLayer),
  );

  const view = segmented(
    '表示モード',
    [
      { value: 'normal', text: '合成' },
      { value: 'diff', text: '差分' },
    ],
    (picked) => callbacks.onDiff(picked === 'diff'),
  );

  const redetect = el('button', {
    class: 'btn btn--ghost',
    type: 'button',
    text: 'この継ぎ目を再検出',
    on: { click: () => callbacks.onRedetect(index) },
  });

  const close = el('button', {
    class: 'sheet__close',
    type: 'button',
    text: '完了',
    on: { click: () => callbacks.onClose() },
  });

  const handle = el('div', { class: 'sheet__handle', attrs: { 'aria-hidden': 'true' } });

  const panel = el('div', { class: 'sheet__panel' }, [
    handle,
    el('div', { class: 'sheet__head' }, [
      el('div', {}, [title, grade]),
      close,
    ]),
    loupe,
    el('div', { class: 'sheet__readout' }, [
      value,
      el('span', { class: 'sheet__value-unit', text: 'px' }),
      max,
    ]),
    el('div', { class: 'sheet__row' }, [stepButton(-10), stepButton(-1), input, stepButton(1), stepButton(10)]),
    el('div', { class: 'sheet__row sheet__row--wrap' }, [view.root, front.root]),
    redetect,
  ]);

  const scrim = el('div', { class: 'sheet__scrim', on: { click: () => callbacks.onClose() } });
  const element = el('div', {
    class: 'sheet',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': '継ぎ目の調整', hidden: true },
  });
  element.append(scrim, panel);

  // Dragging the crop nudges the seam. Pulling up increases the overlap, which
  // is the direction the lower shot physically travels.
  let overlapAtStart = 0;
  draggable(loupe, {
    onStart: () => {
      overlapAtStart = Number(input.value) || 0;
      loupe.classList.add('loupe--active');
    },
    onMove: (_dx, dy) => commit(overlapAtStart - dy / (scale || 1)),
    onEnd: () => loupe.classList.remove('loupe--active'),
  });

  // The handle dismisses the sheet, following the finger the way iOS does.
  draggable(handle, {
    onStart: () => {
      dragStart = 0;
      panel.style.transition = 'none';
    },
    onMove: (_dx, dy) => {
      dragStart = Math.max(0, dy);
      panel.style.transform = `translateY(${dragStart}px)`;
    },
    onEnd: () => {
      panel.style.transition = '';
      panel.style.transform = '';
      if (dragStart > DISMISS_PX) callbacks.onClose();
    },
  });

  const paint = (diff: boolean) => {
    scale = callbacks.paint(canvas, index, diff) || 1;
  };

  return {
    element,
    update(state) {
      const open = state.activeSeam !== null;
      toggleAttr(element, 'hidden', !open);
      element.dataset.open = String(open);
      if (!open) return;

      index = state.activeSeam as number;
      const seam: SeamState | undefined = seamList(state)[index];
      if (!seam) return;

      setText(title, `継ぎ目 ${index + 1}`);
      const kind = gradeCost(seam.cost);
      setText(
        grade,
        seam.cost === null || !Number.isFinite(seam.cost)
          ? GRADE_LABEL[kind]
          : `${GRADE_LABEL[kind]}・Δ${seam.cost.toFixed(2)}`,
      );
      panel.style.setProperty(
        '--seam-tint',
        `color-mix(in oklab, var(--align) ${Math.round(alignmentRatio(seam.cost) * 100)}%, var(--drift))`,
      );
      panel.dataset.grade = kind;

      setText(value, formatPx(seam.overlapPx));
      setText(max, `/ 最大 ${formatPx(seam.maxOverlapPx)}px`);
      if (document.activeElement !== input) input.value = String(seam.overlapPx);
      input.max = String(seam.maxOverlapPx);

      front.select(seam.front);
      view.select(state.diffMode ? 'diff' : 'normal');
      paint(state.diffMode);
    },
  };
}
