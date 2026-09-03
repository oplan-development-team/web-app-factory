import { AlignmentError, detectOverlap } from '../lib/alignment';
import { buildComposite, downloadCanvasAsPng } from '../lib/composite';
import { computeDimensions } from '../lib/dimensions';
import type { AppState, FrontLayer } from '../lib/types';
import { dom } from './dom';
import type { Store } from './store';
import { showToast } from './toast';

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function parseNonNegativeInt(value: string): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return n;
}

function wireNumberInput(
  input: HTMLInputElement,
  onChange: (value: number) => void,
): void {
  input.addEventListener('input', () => {
    onChange(parseNonNegativeInt(input.value));
  });
}

function syncNumberInput(input: HTMLInputElement, value: number): void {
  // フォーカス中(入力途中)は上書きしない — カーソル位置が飛ぶ体験を避けるため
  if (document.activeElement === input) return;
  const asString = String(Math.round(value));
  if (input.value !== asString) input.value = asString;
}

async function handleDetect(store: Store): Promise<void> {
  const state = store.get();
  if (!state.top || !state.bottom) {
    showToast('自動検出には画像が2枚とも必要', 'error');
    return;
  }
  store.set({ isDetecting: true });
  await nextFrame();
  try {
    const overlap = detectOverlap(state.top, state.bottom, state.cutBottomOfTop, state.cutTopOfBottom);
    store.set({ overlapPx: overlap, isDetecting: false });
    showToast(`自動検出完了: 重なり幅 ${overlap}px`, 'success');
  } catch (err) {
    store.set({ isDetecting: false });
    if (err instanceof AlignmentError) {
      showToast(err.message, 'error');
    } else {
      console.error(err);
      showToast('自動検出中に予期しないエラーが発生した', 'error');
    }
  }
}

async function handleDownload(store: Store): Promise<void> {
  const state = store.get();
  if (!state.top || !state.bottom) {
    showToast('ダウンロードには画像が2枚とも必要', 'error');
    return;
  }
  dom.btnDownload.disabled = true;
  await nextFrame();
  try {
    const canvas = buildComposite({
      top: state.top,
      bottom: state.bottom,
      cutBottomOfTop: state.cutBottomOfTop,
      cutTopOfBottom: state.cutTopOfBottom,
      overlapPx: state.overlapPx,
      frontLayer: state.frontLayer,
    });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await downloadCanvasAsPng(canvas, `shot-splice-${stamp}.png`);
    showToast('PNGを書き出した', 'success');
  } catch (err) {
    console.error(err);
    showToast('書き出し中にエラーが発生した', 'error');
  } finally {
    dom.btnDownload.disabled = !(store.get().top && store.get().bottom);
  }
}

function renderReadout(state: AppState): void {
  if (!state.top || !state.bottom) {
    dom.readoutSize.textContent = '— × —';
    dom.readoutOverlap.textContent = '— px';
    return;
  }
  const dims = computeDimensions(
    state.top,
    state.bottom,
    state.cutBottomOfTop,
    state.cutTopOfBottom,
    state.overlapPx,
  );
  const overlapClamped = Math.max(0, Math.min(state.overlapPx, dims.maxOverlap));
  dom.readoutSize.textContent = `${dims.outputWidth} × ${dims.outputHeight}`;
  dom.readoutOverlap.textContent = `${overlapClamped} px`;
}

function renderControlsState(state: AppState): void {
  const hasBoth = Boolean(state.top && state.bottom);
  dom.btnDetect.disabled = !hasBoth || state.isDetecting;
  dom.btnDownload.disabled = !hasBoth;
  dom.inputOverlap.disabled = !hasBoth;

  dom.stageStatus.hidden = !state.isDetecting;
  dom.stageStatus.querySelector('.stage-status-text')!.textContent = state.isDetecting
    ? '重なりを解析中…'
    : '';

  syncNumberInput(dom.inputCutTop, state.cutBottomOfTop);
  syncNumberInput(dom.inputCutBottom, state.cutTopOfBottom);
  syncNumberInput(dom.inputOverlap, state.overlapPx);

  for (const btn of dom.toggleFront.querySelectorAll<HTMLButtonElement>('.segmented-btn')) {
    btn.classList.toggle('is-active', btn.dataset.front === state.frontLayer);
  }
  dom.toggleDiff.checked = state.diffMode;

  renderReadout(state);
}

export function initControlsPanel(store: Store): void {
  wireNumberInput(dom.inputCutTop, (value) => store.set({ cutBottomOfTop: value }));
  wireNumberInput(dom.inputCutBottom, (value) => store.set({ cutTopOfBottom: value }));
  wireNumberInput(dom.inputOverlap, (value) => {
    const state = store.get();
    if (!state.top || !state.bottom) {
      store.set({ overlapPx: value });
      return;
    }
    const dims = computeDimensions(state.top, state.bottom, state.cutBottomOfTop, state.cutTopOfBottom, value);
    store.set({ overlapPx: Math.max(0, Math.min(value, dims.maxOverlap)) });
  });

  dom.toggleFront.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>('.segmented-btn');
    if (!target) return;
    const front = target.dataset.front as FrontLayer | undefined;
    if (front) store.set({ frontLayer: front });
  });

  dom.toggleDiff.addEventListener('change', () => {
    store.set({ diffMode: dom.toggleDiff.checked });
  });

  dom.btnDetect.addEventListener('click', () => void handleDetect(store));
  dom.btnDownload.addEventListener('click', () => void handleDownload(store));

  store.subscribe(renderControlsState);
}
