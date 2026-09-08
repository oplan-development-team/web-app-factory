import { Store, hasContent } from '../state';
import { previewSize } from '../core/aspect';
import { renderPoster } from '../core/render';
import { el } from './dom';

export interface PreviewHandle {
  scheduleRender: () => void;
}

export function mountPreview(root: HTMLElement, store: Store): PreviewHandle {
  root.append(el('h2', { class: 'section-label' }, ['PREVIEW / プレビュー']));

  const frame = el('div', { class: 'preview-frame' });
  const canvas = el('canvas', { class: 'preview-canvas', 'aria-label': 'ポスタープレビュー' }) as HTMLCanvasElement;
  const emptyState = el('div', { class: 'preview-empty', role: 'status' }, [
    el('p', { class: 'preview-empty__title' }, ['まだ何も配版されていません']),
    el('p', { class: 'preview-empty__body' }, [
      '写真をアップロードするか、見出し・図形のいずれかを追加してください。選択したインク色ごとに角度違いの網点へ分解され、意図的な版ズレを与えたうえで重ね刷りプレビューがここに表示されます。',
    ]),
  ]);
  frame.append(canvas, emptyState);
  root.append(frame);

  const captionEl = el('p', { class: 'preview-caption' }, []);
  root.append(captionEl);

  const ctx = canvas.getContext('2d');
  let rafId: number | null = null;

  function renderNow() {
    const state = store.getState();
    const size = previewSize(state.aspect);
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
    }
    canvas.style.aspectRatio = `${size.width} / ${size.height}`;

    const show = hasContent(state);
    if (show && ctx) {
      renderPoster(ctx, size.width, size.height, state);
    } else if (ctx) {
      ctx.clearRect(0, 0, size.width, size.height);
    }
    emptyState.classList.toggle('is-visible', !show);
    canvas.classList.toggle('is-hidden', !show);
    captionEl.textContent = `${state.aspect === 'portrait' ? '縦長ポスター' : '正方形'} / ${state.selectedInks.length}版`;
  }

  function scheduleRender() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      renderNow();
    });
  }

  store.subscribe(scheduleRender);
  scheduleRender();

  return { scheduleRender };
}
