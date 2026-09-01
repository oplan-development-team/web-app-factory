import { assessOutputSize, formatPx } from '../core/output';
import type { Layout } from '../core/types';
import { el, setText, toggleAttr } from './dom';
import type { AppState } from './store';

export type PaintStage = (canvas: HTMLCanvasElement, width: number, height: number) => void;

export interface StageOptions {
  readonly paint: PaintStage;
}

export interface Stage {
  readonly element: HTMLElement;
  update(state: AppState, layout: Layout | null): void;
}

/**
 * Blends the loaded shots' average colours into a wash behind the preview.
 *
 * It ties the chrome to the material actually on screen — a warm screenshot
 * warms the bench — which is something a fixed decorative gradient cannot do.
 */
function washFor(state: AppState): string {
  if (state.shots.length === 0) return 'none';
  const total = state.shots.reduce(
    (acc, shot) => ({
      r: acc.r + shot.averageColor.r,
      g: acc.g + shot.averageColor.g,
      b: acc.b + shot.averageColor.b,
    }),
    { r: 0, g: 0, b: 0 },
  );
  const n = state.shots.length;
  const r = Math.round(total.r / n);
  const g = Math.round(total.g / n);
  const b = Math.round(total.b / n);
  return `radial-gradient(120% 80% at 50% 0%, rgb(${r} ${g} ${b} / 0.34), transparent 72%)`;
}

export function createStage(options: StageOptions): Stage {
  const canvas = el('canvas', { class: 'stage__canvas' });
  const wash = el('div', { class: 'stage__wash', attrs: { 'aria-hidden': 'true' } });

  const empty = el('div', { class: 'stage__placeholder' }, [
    el('p', { class: 'stage__placeholder-title', text: '継ぎ足す準備ができています' }),
    el('p', {
      class: 'stage__placeholder-text',
      text: '縦に分けて撮ったスクリーンショットを2枚以上追加すると、重なりを探して1枚に繋ぎます。',
    }),
  ]);

  const partial = el('div', { class: 'stage__placeholder' }, [
    el('p', { class: 'stage__placeholder-title', text: 'あと1枚' }),
    el('p', {
      class: 'stage__placeholder-text',
      text: '続きのスクリーンショットを追加すると、継ぎ目の検出を始められます。',
    }),
  ]);

  const size = el('span', { class: 'stage__size mono' });
  const overlapTotal = el('span', { class: 'stage__overlap mono' });
  const warning = el('p', { class: 'stage__warning', attrs: { hidden: true } });

  const element = el('section', { class: 'stage', attrs: { 'aria-label': '合成プレビュー' } }, [
    wash,
    el('div', { class: 'stage__frame' }, [canvas, empty, partial]),
    el('div', { class: 'stage__meta' }, [size, overlapTotal]),
    warning,
  ]);

  return {
    element,
    update(state, layout) {
      const count = state.shots.length;
      const mode = count === 0 ? 'empty' : count === 1 ? 'partial' : 'ready';
      element.dataset.mode = mode;
      toggleAttr(empty, 'hidden', mode !== 'empty');
      toggleAttr(partial, 'hidden', mode !== 'partial');
      wash.style.backgroundImage = washFor(state);

      if (!layout || layout.height <= 0 || mode === 'empty') {
        setText(size, '—');
        setText(overlapTotal, `${count}枚`);
        toggleAttr(warning, 'hidden', true);
        return;
      }

      options.paint(canvas as HTMLCanvasElement, layout.width, layout.height);

      const overlapSum = layout.overlaps.reduce((sum, value) => sum + value, 0);
      setText(size, `${formatPx(layout.width)} × ${formatPx(layout.height)} px`);
      setText(overlapTotal, `${count}枚 / 重なり計 ${formatPx(overlapSum)}px`);

      const risk = assessOutputSize(layout.width, layout.height);
      toggleAttr(warning, 'hidden', risk === 'ok');
      if (risk !== 'ok') {
        setText(
          warning,
          risk === 'over-limit'
            ? '出力サイズがブラウザのCanvas上限を超えています。ショットを減らすか、重なりを増やしてください。書き出しに失敗する可能性があります。'
            : '出力サイズがブラウザのCanvas上限に近づいています。端末によっては書き出しに失敗することがあります。',
        );
      }
    },
  };
}
