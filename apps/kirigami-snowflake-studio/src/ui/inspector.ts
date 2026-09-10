import type { Cut } from '../geometry/types';
import { store } from '../store';
import { el } from './dom';

export function mountInspector(container: HTMLElement): { refresh: () => void } {
  let dragging = false;
  let before: Cut[] = [];

  function slider(label: string, value: number, min: number, max: number, step: number, onInput: (v: number) => void): HTMLElement {
    const input = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), class: 'field-range' }) as HTMLInputElement;
    const out = el('span', { class: 'field-value' }, [String(value)]);
    input.addEventListener('pointerdown', () => {
      dragging = true;
      before = store.cuts.map((c) => ({ ...c }));
    });
    input.addEventListener('input', () => {
      out.textContent = input.value;
      onInput(Number(input.value));
    });
    input.addEventListener('change', () => {
      dragging = false;
      store.commitLiveEdit(before);
    });
    return el('label', { class: 'field' }, [el('span', { class: 'field-label' }, [label]), input, out]);
  }

  function titleFor(cut: Cut): string {
    if (cut.kind === 'triangle') return cut.placement === 'edge' ? '三角ノッチ' : '三角の穴';
    if (cut.kind === 'semicircle') return cut.placement === 'edge' ? '半円スクープ' : '丸穴';
    if (cut.kind === 'wave') return '波線（スカラップ）';
    return 'ノッチ';
  }

  function render() {
    if (dragging) return;
    container.replaceChildren();
    const cut = store.selectedCut;
    if (!cut) {
      container.append(el('p', { class: 'inspector__empty' }, ['カットを選択すると、ここで詳細を調整できます。']));
      return;
    }

    container.append(el('h3', { class: 'inspector__title' }, [titleFor(cut)]));

    if (cut.kind === 'triangle') {
      container.append(
        slider('幅', cut.width, 10, 60, 1, (v) => store.updateCutLive(cut.id, { width: v } as Partial<Cut>)),
        slider('深さ', cut.depth, 6, 90, 1, (v) => store.updateCutLive(cut.id, { depth: v } as Partial<Cut>)),
      );
    } else if (cut.kind === 'semicircle') {
      container.append(slider('半径', cut.radius, 6, 70, 1, (v) => store.updateCutLive(cut.id, { radius: v } as Partial<Cut>)));
    } else if (cut.kind === 'wave') {
      container.append(
        slider('振幅', cut.amplitude, 2, 24, 1, (v) => store.updateCutLive(cut.id, { amplitude: v } as Partial<Cut>)),
        slider('繰り返し数', cut.count, 2, 14, 1, (v) => store.updateCutLive(cut.id, { count: v } as Partial<Cut>)),
      );
    } else if (cut.kind === 'notch') {
      container.append(el('p', { class: 'inspector__note' }, ['ノッチはサイズ固定の速射ツールです。個別調整はありません。']));
    }

    const delBtn = el('button', { class: 'inspector__delete', type: 'button' }, ['この切り込みを削除']);
    delBtn.addEventListener('click', () => store.removeCut(cut.id));
    container.append(delBtn);
  }

  store.subscribe(render);
  render();
  return { refresh: render };
}
