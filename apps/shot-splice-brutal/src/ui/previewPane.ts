import { computeDimensions } from '../lib/dimensions';
import type { AppState } from '../lib/types';
import { dom } from './dom';
import type { Store } from './store';

const ARROW_STEP = 1;
const ARROW_STEP_SHIFT = 10;

function availableWidth(): number {
  const cs = getComputedStyle(dom.stageViewport);
  const padding = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  return Math.max(80, dom.stageViewport.clientWidth - padding);
}

function applyLayout(state: AppState): void {
  const hasBoth = Boolean(state.top && state.bottom);
  dom.stageEmpty.hidden = hasBoth;
  dom.spliceFrame.hidden = !hasBoth;
  dom.stageHint.textContent = hasBoth
    ? '継ぎ目のバー(オレンジ)をドラッグ、または矢印キーで微調整'
    : '画像を2枚読み込むとここにプレビューが表示される';

  if (!state.top || !state.bottom) return;

  const dims = computeDimensions(
    state.top,
    state.bottom,
    state.cutBottomOfTop,
    state.cutTopOfBottom,
    state.overlapPx,
  );
  const overlapClamped = Math.max(0, Math.min(state.overlapPx, dims.maxOverlap));
  const scale = Math.min(1, availableWidth() / Math.max(1, dims.outputWidth));

  dom.spliceFrame.style.width = `${dims.outputWidth * scale}px`;
  dom.spliceFrame.style.height = `${dims.outputHeight * scale}px`;
  dom.spliceFrame.classList.toggle('front-top', state.frontLayer === 'top');
  dom.spliceFrame.classList.toggle('diff-mode', state.diffMode);

  const bottomDestY = dims.topHeight - overlapClamped;

  dom.layerTopWrap.style.top = '0px';
  dom.layerTopWrap.style.height = `${dims.topHeight * scale}px`;
  dom.layerTop.src = state.top.objectUrl;
  dom.layerTop.style.width = `${state.top.naturalWidth * scale}px`;
  dom.layerTop.style.transform = 'translateY(0)';

  dom.layerBottomWrap.style.top = `${bottomDestY * scale}px`;
  dom.layerBottomWrap.style.height = `${dims.bottomHeight * scale}px`;
  dom.layerBottom.src = state.bottom.objectUrl;
  dom.layerBottom.style.width = `${state.bottom.naturalWidth * scale}px`;
  dom.layerBottom.style.transform = `translateY(${-state.cutTopOfBottom * scale}px)`;

  const seamCenter = (bottomDestY + overlapClamped / 2) * scale;
  dom.seamHandle.style.top = `${seamCenter}px`;
  dom.seamHandle.setAttribute('aria-valuemin', '0');
  dom.seamHandle.setAttribute('aria-valuemax', String(dims.maxOverlap));
  dom.seamHandle.setAttribute('aria-valuenow', String(Math.round(overlapClamped)));
}

function wireDrag(store: Store): void {
  let dragStartY = 0;
  let dragStartOverlap = 0;
  let dragScale = 1;

  const onPointerMove = (e: PointerEvent) => {
    const state = store.get();
    if (!state.top || !state.bottom) return;
    const dims = computeDimensions(
      state.top,
      state.bottom,
      state.cutBottomOfTop,
      state.cutTopOfBottom,
      state.overlapPx,
    );
    const deltaScreen = e.clientY - dragStartY;
    const deltaImage = deltaScreen / dragScale;
    const next = Math.round(dragStartOverlap - deltaImage);
    store.set({ overlapPx: Math.max(0, Math.min(next, dims.maxOverlap)) });
  };

  const onPointerUp = (e: PointerEvent) => {
    dom.seamHandle.classList.remove('is-dragging');
    dom.seamHandle.releasePointerCapture(e.pointerId);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  dom.seamHandle.addEventListener('pointerdown', (e) => {
    const state = store.get();
    if (!state.top || !state.bottom) return;
    dragStartY = e.clientY;
    dragStartOverlap = state.overlapPx;
    dragScale = Math.min(1, availableWidth() / Math.max(1, Math.min(state.top.naturalWidth, state.bottom.naturalWidth)));
    dom.seamHandle.classList.add('is-dragging');
    dom.seamHandle.setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  });

  dom.seamHandle.addEventListener('keydown', (e) => {
    const state = store.get();
    if (!state.top || !state.bottom) return;
    let direction = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') direction = 1;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') direction = -1;
    else return;

    e.preventDefault();
    const step = e.shiftKey ? ARROW_STEP_SHIFT : ARROW_STEP;
    const dims = computeDimensions(
      state.top,
      state.bottom,
      state.cutBottomOfTop,
      state.cutTopOfBottom,
      state.overlapPx,
    );
    const next = state.overlapPx + direction * step;
    store.set({ overlapPx: Math.max(0, Math.min(next, dims.maxOverlap)) });
  });
}

export function initPreviewPane(store: Store): void {
  wireDrag(store);
  store.subscribe(applyLayout);

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => applyLayout(store.get()));
  });
}
