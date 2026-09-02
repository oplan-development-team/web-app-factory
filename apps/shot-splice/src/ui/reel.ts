import { formatPx } from '../core/output';
import type { CanvasFactory } from '../imaging/surface';
import { el, setText } from './dom';
import { longPressDrag, type LongPressOptions } from './pointer';
import type { AppState, Shot } from './store';
import { THUMB_HEIGHT, drawThumb } from './thumb';

export interface ReelCallbacks {
  readonly onMove: (from: number, to: number) => void;
  readonly onRemove: (id: string) => void;
  /** Renders the connector shown between two consecutive shots. */
  readonly renderSeam: (index: number) => HTMLElement;
}

export interface ReelOptions {
  readonly pixelRatio?: number;
  readonly longPress?: LongPressOptions;
  readonly factory?: CanvasFactory;
}

export interface Reel {
  readonly element: HTMLElement;
  update(state: AppState): void;
}

const ROW_HEIGHT_GUESS = THUMB_HEIGHT + 22;

function iconButton(label: string, glyph: string, onClick: () => void): HTMLButtonElement {
  return el(
    'button',
    {
      class: 'icon-btn',
      type: 'button',
      attrs: { 'aria-label': label, title: label },
      on: { click: onClick },
    },
    [el('span', { class: 'icon-btn__glyph', text: glyph, attrs: { 'aria-hidden': 'true' } })],
  );
}

function shotRow(
  shot: Shot,
  index: number,
  total: number,
  callbacks: ReelCallbacks,
  ratio: number,
  factory: CanvasFactory | undefined,
): HTMLLIElement {
  const { canvas, width, height } = factory ? drawThumb(shot, ratio, factory) : drawThumb(shot, ratio);
  const surface = canvas as unknown as HTMLCanvasElement;
  surface.style.width = `${width}px`;
  surface.style.height = `${height}px`;

  const row = el('li', {
    class: 'reel__shot',
    attrs: { 'data-index': index, 'data-id': shot.id },
  });

  const handle = el('div', { class: 'reel__handle', attrs: { 'aria-hidden': 'true' } }, [
    el('div', { class: 'reel__thumb' }, [surface]),
  ]);

  const meta = el('div', { class: 'reel__meta' }, [
    el('p', { class: 'reel__index mono', text: String(index + 1).padStart(2, '0') }),
    el('p', { class: 'reel__name', text: shot.name, title: shot.name }),
    el('p', {
      class: 'reel__dims mono',
      text: `${formatPx(shot.naturalWidth)} × ${formatPx(shot.naturalHeight)}`,
    }),
  ]);

  const up = iconButton('ひとつ上へ移動', '↑', () => callbacks.onMove(index, index - 1));
  const down = iconButton('ひとつ下へ移動', '↓', () => callbacks.onMove(index, index + 1));
  up.disabled = index === 0;
  down.disabled = index === total - 1;

  const remove = iconButton('このショットを削除', '✕', () => callbacks.onRemove(shot.id));
  remove.classList.add('icon-btn--danger');

  const moves = el('div', { class: 'reel__moves' }, [up, down]);
  row.append(handle, meta, el('div', { class: 'reel__controls' }, [moves, remove]));
  return row;
}

/**
 * The vertical reel of shots, with the seam connectors woven between them.
 *
 * Shots and seams share one column rather than living in separate panels: a
 * seam only means anything in relation to the two shots it joins, and on a
 * phone there is no room to look at them side by side.
 */
export function createReel(callbacks: ReelCallbacks, options: ReelOptions = {}): Reel {
  const ratio = options.pixelRatio ?? (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
  const list = el('ul', { class: 'reel', attrs: { 'aria-label': 'ショットと継ぎ目' } });
  const teardowns: (() => void)[] = [];
  let signature = '';

  const startDrag = (row: HTMLLIElement, index: number, total: number) => {
    let offset = 0;
    return longPressDrag(
      row,
      {
        onHold: () => {
          row.classList.add('reel__shot--dragging');
          list.classList.add('reel--reordering');
        },
        onMove: (_dx, dy) => {
          offset = dy;
          row.style.transform = `translateY(${dy}px)`;
        },
        onEnd: (cancelled) => {
          row.classList.remove('reel__shot--dragging');
          list.classList.remove('reel--reordering');
          row.style.transform = '';
          if (cancelled) return;
          const step = Math.round(offset / ROW_HEIGHT_GUESS);
          const target = Math.max(0, Math.min(total - 1, index + step));
          if (target !== index) callbacks.onMove(index, target);
        },
      },
      options.longPress ?? {},
    );
  };

  const rebuild = (state: AppState) => {
    for (const teardown of teardowns.splice(0)) teardown();
    list.replaceChildren();

    state.shots.forEach((shot, index) => {
      if (index > 0) {
        list.append(
          el('li', { class: 'reel__seam', attrs: { 'data-seam': index - 1 } }, [
            callbacks.renderSeam(index - 1),
          ]),
        );
      }
      const row = shotRow(shot, index, state.shots.length, callbacks, ratio, options.factory);
      teardowns.push(startDrag(row, index, state.shots.length));
      list.append(row);
    });
  };

  return {
    element: list,
    update(state) {
      // Rebuilding only when the identity or order of shots changes keeps the
      // canvases (and any in-flight gesture) alive across ordinary updates.
      const next = state.shots.map((s) => s.id).join(',');
      if (next !== signature) {
        signature = next;
        rebuild(state);
        return;
      }
      state.shots.forEach((shot, index) => {
        const row = list.querySelector<HTMLElement>(`.reel__shot[data-index="${index}"] .reel__name`);
        if (row) setText(row, shot.name);
      });
    },
  };
}
