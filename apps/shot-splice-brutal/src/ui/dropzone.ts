import { formatBytes, ImageLoadError, loadImageFile, releaseImage } from '../lib/imageLoader';
import type { Store } from './store';
import { dom, slotBottomBody, slotTopBody } from './dom';
import { showToast } from './toast';

type Role = 'top' | 'bottom';

async function handleFile(store: Store, role: Role, file: File): Promise<void> {
  try {
    const loaded = await loadImageFile(file);
    const previous = store.get()[role];
    releaseImage(previous);
    store.set({ [role]: loaded });
    showToast(`${role === 'top' ? '上' : '下'}画像を読み込んだ: ${loaded.fileName}`, 'success');
  } catch (err) {
    if (err instanceof ImageLoadError) {
      showToast(err.message, 'error');
    } else {
      console.error(err);
      showToast('画像の読み込み中に予期しないエラーが発生した', 'error');
    }
  }
}

function wireSlot(store: Store, slot: HTMLDivElement, input: HTMLInputElement, role: Role): void {
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) void handleFile(store, role, file);
    input.value = '';
  });

  slot.addEventListener('dragover', (e) => {
    e.preventDefault();
    slot.classList.add('is-dragover');
  });
  slot.addEventListener('dragleave', () => {
    slot.classList.remove('is-dragover');
  });
  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    slot.classList.remove('is-dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) void handleFile(store, role, file);
  });
}

function renderSlot(
  slot: HTMLDivElement,
  body: { thumb: HTMLImageElement; meta: HTMLParagraphElement },
  loaded: { objectUrl: string; fileName: string; fileSize: number; naturalWidth: number; naturalHeight: number } | null,
): void {
  if (!loaded) {
    slot.classList.remove('has-image');
    body.thumb.hidden = true;
    body.thumb.removeAttribute('src');
    body.meta.textContent = '';
    return;
  }
  slot.classList.add('has-image');
  body.thumb.hidden = false;
  body.thumb.src = loaded.objectUrl;
  body.meta.textContent = `${loaded.fileName} ・ ${loaded.naturalWidth}×${loaded.naturalHeight} ・ ${formatBytes(loaded.fileSize)}`;
}

export function initDropzone(store: Store): void {
  wireSlot(store, dom.slotTop, dom.fileTop, 'top');
  wireSlot(store, dom.slotBottom, dom.fileBottom, 'bottom');

  dom.btnSwap.addEventListener('click', () => {
    const state = store.get();
    if (!state.top || !state.bottom) {
      showToast('入れ替えるには2枚とも必要', 'error');
      return;
    }
    store.set({
      top: state.bottom,
      bottom: state.top,
      cutBottomOfTop: state.cutTopOfBottom,
      cutTopOfBottom: state.cutBottomOfTop,
    });
    showToast('上下を入れ替えた', 'info');
  });

  dom.btnClear.addEventListener('click', () => {
    const state = store.get();
    if (!state.top && !state.bottom) return;
    releaseImage(state.top);
    releaseImage(state.bottom);
    store.set({
      top: null,
      bottom: null,
      cutBottomOfTop: 0,
      cutTopOfBottom: 0,
      overlapPx: 0,
    });
    showToast('全部クリアした', 'info');
  });

  store.subscribe((state) => {
    renderSlot(dom.slotTop, slotTopBody, state.top);
    renderSlot(dom.slotBottom, slotBottomBody, state.bottom);
  });
}
