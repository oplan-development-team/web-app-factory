import { el, setText, toggleAttr } from './dom';
import type { AppState } from './store';

export interface ToolbarCallbacks {
  readonly onAdd: (files: readonly File[]) => void;
  readonly onDetectAll: () => void;
  readonly onExport: () => void;
  readonly onClear: () => void;
}

export interface Toolbar {
  readonly element: HTMLElement;
  update(state: AppState): void;
  openPicker(): void;
}

function progressLabel(state: AppState): string | null {
  switch (state.busy.kind) {
    case 'loading':
      return state.busy.message;
    case 'detecting':
      return `継ぎ目を検出中 ${state.busy.done} / ${state.busy.total}`;
    case 'exporting':
      return 'PNGを書き出し中';
    default:
      return null;
  }
}

export function createToolbar(callbacks: ToolbarCallbacks): Toolbar {
  const picker = el('input', {
    class: 'visually-hidden',
    type: 'file',
    attrs: { multiple: true, accept: 'image/*', 'aria-label': 'スクリーンショットを選択' },
  });
  picker.addEventListener('change', () => {
    const files = Array.from(picker.files ?? []);
    // Resetting lets the same file be picked twice in a row.
    picker.value = '';
    if (files.length > 0) callbacks.onAdd(files);
  });

  const add = el('button', {
    class: 'btn btn--ghost',
    type: 'button',
    text: '追加',
    on: { click: () => picker.click() },
  });

  const detect = el('button', {
    class: 'btn btn--primary',
    type: 'button',
    text: '自動で合わせる',
    on: { click: () => callbacks.onDetectAll() },
  });

  const save = el('button', {
    class: 'btn btn--accent',
    type: 'button',
    text: 'PNG保存',
    on: { click: () => callbacks.onExport() },
  });

  const clear = el('button', {
    class: 'btn btn--quiet',
    type: 'button',
    text: 'すべて削除',
    on: { click: () => callbacks.onClear() },
  });

  const progress = el('div', { class: 'toolbar__progress', attrs: { hidden: true } }, [
    el('span', { class: 'toolbar__spinner', attrs: { 'aria-hidden': 'true' } }),
    el('span', { class: 'toolbar__progress-text' }),
  ]);
  const progressText = progress.querySelector('.toolbar__progress-text') as HTMLElement;

  const element = el('div', { class: 'toolbar', attrs: { 'aria-label': '操作' } }, [
    picker,
    progress,
    el('div', { class: 'toolbar__row' }, [add, clear, detect, save]),
  ]);

  return {
    element,
    openPicker: () => picker.click(),
    update(state) {
      const ready = state.shots.length >= 2;
      const busy = state.busy.kind !== 'idle';
      detect.disabled = !ready || busy;
      save.disabled = !ready || busy;
      clear.disabled = state.shots.length === 0 || busy;
      add.disabled = busy;

      const label = progressLabel(state);
      toggleAttr(progress, 'hidden', label === null);
      if (label) setText(progressText, label);
    },
  };
}
