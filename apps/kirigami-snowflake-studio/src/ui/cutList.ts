import type { Cut, EdgeId } from '../geometry/types';
import { store } from '../store';
import { el } from './dom';

function edgeLabel(edge: EdgeId): string {
  if (edge === 'left') return '左の折り目辺';
  if (edge === 'right') return '右の折り目辺';
  return '外周の縁';
}

function describeCut(cut: Cut): string {
  switch (cut.kind) {
    case 'triangle':
      return cut.placement === 'edge' ? `三角ノッチ・${edgeLabel(cut.edge!)}` : '三角の穴・内側';
    case 'semicircle':
      return cut.placement === 'edge' ? `半円スクープ・${edgeLabel(cut.edge!)}` : '丸穴・内側';
    case 'wave':
      return `波線・${edgeLabel(cut.edge)}（${cut.count}山）`;
    case 'notch': {
      const sizeLabel = cut.size === 'small' ? '小' : cut.size === 'medium' ? '中' : '大';
      return `ノッチ(${sizeLabel})・${edgeLabel(cut.edge)}`;
    }
  }
}

export function mountCutList(container: HTMLElement): { refresh: () => void } {
  const listEl = el('ul', { class: 'cut-list', role: 'list' });
  const emptyEl = el('p', { class: 'cut-list__empty' }, ['まだ切り込みがありません。ツールバーからキャンバスをクリックして配置してみましょう。']);
  container.append(listEl, emptyEl);

  let dragIndex: number | null = null;

  function render() {
    listEl.replaceChildren();
    emptyEl.style.display = store.cuts.length === 0 ? '' : 'none';

    store.cuts.forEach((cut, index) => {
      const item = el('li', {
        class: `cut-item ${cut.id === store.selectedId ? 'cut-item--selected' : ''}`,
        draggable: 'true',
      });

      const label = el('button', { class: 'cut-item__label', type: 'button' }, [
        el('span', { class: 'cut-item__index' }, [String(index + 1)]),
        el('span', {}, [describeCut(cut)]),
      ]);
      label.addEventListener('click', () => store.select(cut.id));

      const upBtn = el('button', { class: 'cut-item__move', type: 'button', 'aria-label': '上へ移動', title: '上へ移動' }, ['▲']);
      upBtn.disabled = index === 0;
      upBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        store.reorderCut(index, Math.max(0, index - 1));
      });

      const downBtn = el('button', { class: 'cut-item__move', type: 'button', 'aria-label': '下へ移動', title: '下へ移動' }, ['▼']);
      downBtn.disabled = index === store.cuts.length - 1;
      downBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        store.reorderCut(index, Math.min(store.cuts.length - 1, index + 1));
      });

      const delBtn = el('button', { class: 'cut-item__delete', type: 'button', 'aria-label': '削除' }, ['✕']);
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        store.removeCut(cut.id);
      });

      item.append(label, upBtn, downBtn, delBtn);

      item.addEventListener('dragstart', () => {
        dragIndex = index;
        item.classList.add('cut-item--dragging');
      });
      item.addEventListener('dragend', () => {
        dragIndex = null;
        item.classList.remove('cut-item--dragging');
      });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
      });
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        if (dragIndex !== null && dragIndex !== index) {
          store.reorderCut(dragIndex, index);
        }
      });

      listEl.append(item);
    });
  }

  store.subscribe(render);
  render();
  return { refresh: render };
}
