import { el, setText, toggleAttr } from './dom';
import type { Status } from './store';

export interface AppShell {
  readonly root: HTMLElement;
  readonly main: HTMLElement;
  setStatus(status: Status | null): void;
  setDragActive(active: boolean): void;
}

export function createAppShell(): AppShell {
  const status = el('p', {
    class: 'status',
    attrs: { role: 'status', 'aria-live': 'polite', hidden: true },
  });

  const main = el('main', { class: 'app__main' });

  const header = el('header', { class: 'app__header' }, [
    el('h1', { class: 'app__title' }, [
      el('span', { class: 'app__title-main', text: 'SHOT' }),
      el('span', { class: 'app__title-accent', text: 'SPLICE' }),
    ]),
    el('p', {
      class: 'app__tagline',
      text: '分割して撮ったスクリーンショットを、重なりを探して1枚に継ぐ。処理はすべてこの端末の中で完結します。',
    }),
  ]);

  const dropHint = el('div', { class: 'dropzone', attrs: { 'aria-hidden': 'true' } }, [
    el('p', { class: 'dropzone__text', text: 'ここにドロップして追加' }),
  ]);

  const root = el('div', { class: 'app' }, [header, status, main, dropHint]);

  return {
    root,
    main,
    setStatus(next) {
      toggleAttr(status, 'hidden', next === null);
      if (!next) return;
      status.dataset.tone = next.tone;
      setText(status, next.message);
    },
    setDragActive(active) {
      root.dataset.dragging = String(active);
    },
  };
}
