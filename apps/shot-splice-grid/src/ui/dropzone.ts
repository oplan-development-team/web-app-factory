import { getState, setState } from '../state';
import type { FrontLayer } from '../core/types';

type Slot = 'top' | 'bottom';

const THUMB_WIDTH = 220;
const objectUrls: Record<Slot, string | null> = { top: null, bottom: null };

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('画像ファイルを選択してください（PNG・JPEGなど）'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像を読み込めませんでした。ファイルが壊れている可能性があります'));
    };
    img.src = url;
  });
}

function renderThumbnail(canvas: HTMLCanvasElement, img: HTMLImageElement): void {
  const scale = THUMB_WIDTH / img.naturalWidth;
  canvas.width = THUMB_WIDTH;
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

function setDropzoneError(root: HTMLElement, message: string): void {
  const errorEl = root.querySelector<HTMLParagraphElement>('.dropzone-error');
  if (errorEl) errorEl.textContent = message;
  root.classList.toggle('has-error', message.length > 0);
}

function setDropzoneFilled(root: HTMLElement, filled: boolean): void {
  const hitEl = root.querySelector<HTMLElement>('.dropzone-hit');
  const filledEl = root.querySelector<HTMLElement>('.dropzone-filled');
  if (hitEl) hitEl.hidden = filled;
  if (filledEl) filledEl.hidden = !filled;
  root.classList.toggle('is-filled', filled);
}

async function applyFile(slot: Slot, root: HTMLElement, file: File, onChange: () => void): Promise<void> {
  root.classList.add('is-loading');
  setDropzoneError(root, '');
  try {
    const img = await loadImage(file);
    if (objectUrls[slot]) URL.revokeObjectURL(objectUrls[slot] as string);
    objectUrls[slot] = img.src;

    const thumb = root.querySelector<HTMLCanvasElement>('.dropzone-thumb');
    const filenameEl = root.querySelector<HTMLElement>('.dropzone-filename');
    const dimsEl = root.querySelector<HTMLElement>('.dropzone-dims');
    if (thumb) renderThumbnail(thumb, img);
    if (filenameEl) filenameEl.textContent = file.name;
    if (dimsEl) dimsEl.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
    setDropzoneFilled(root, true);

    if (slot === 'top') {
      setState({ topImage: img, topFileName: file.name });
    } else {
      setState({ bottomImage: img, bottomFileName: file.name });
    }
    onChange();
  } catch (err) {
    setDropzoneError(root, err instanceof Error ? err.message : '読み込みに失敗しました');
  } finally {
    root.classList.remove('is-loading');
  }
}

function clearSlot(slot: Slot, root: HTMLElement, input: HTMLInputElement, onChange: () => void): void {
  if (objectUrls[slot]) {
    URL.revokeObjectURL(objectUrls[slot] as string);
    objectUrls[slot] = null;
  }
  input.value = '';
  setDropzoneFilled(root, false);
  setDropzoneError(root, '');
  if (slot === 'top') {
    setState({ topImage: null, topFileName: '' });
  } else {
    setState({ bottomImage: null, bottomFileName: '' });
  }
  onChange();
}

function wireSlot(slot: Slot, onChange: () => void): void {
  const root = document.getElementById(`dropzone-${slot}`);
  const input = document.getElementById(`input-${slot}`) as HTMLInputElement | null;
  if (!root || !input) return;

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) void applyFile(slot, root, file, onChange);
  });

  const removeBtn = root.querySelector<HTMLButtonElement>('.dropzone-remove');
  removeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    clearSlot(slot, root, input, onChange);
  });

  root.addEventListener('dragover', (e) => {
    e.preventDefault();
    root.classList.add('is-dragover');
  });
  root.addEventListener('dragleave', () => root.classList.remove('is-dragover'));
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    root.classList.remove('is-dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) void applyFile(slot, root, file, onChange);
  });
}

export function initDropzones(onChange: () => void): void {
  wireSlot('top', onChange);
  wireSlot('bottom', onChange);
}

/** Swaps top/bottom images, filenames, thumbnails, and their dropzone DOM state. */
export function swapSlots(onChange: () => void): void {
  const s = getState();
  const nextFront: FrontLayer = s.frontLayer === 'top' ? 'bottom' : 'top';
  setState({
    topImage: s.bottomImage,
    bottomImage: s.topImage,
    topFileName: s.bottomFileName,
    bottomFileName: s.topFileName,
    frontLayer: nextFront,
  });

  const tmpUrl = objectUrls.top;
  objectUrls.top = objectUrls.bottom;
  objectUrls.bottom = tmpUrl;

  for (const slot of ['top', 'bottom'] as Slot[]) {
    const root = document.getElementById(`dropzone-${slot}`);
    if (!root) continue;
    const img = slot === 'top' ? getState().topImage : getState().bottomImage;
    const name = slot === 'top' ? getState().topFileName : getState().bottomFileName;
    const thumb = root.querySelector<HTMLCanvasElement>('.dropzone-thumb');
    const filenameEl = root.querySelector<HTMLElement>('.dropzone-filename');
    const dimsEl = root.querySelector<HTMLElement>('.dropzone-dims');
    if (img && thumb && filenameEl && dimsEl) {
      renderThumbnail(thumb, img);
      filenameEl.textContent = name;
      dimsEl.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
      setDropzoneFilled(root, true);
    } else {
      setDropzoneFilled(root, false);
    }
  }
  onChange();
}

export function clearAllSlots(onChange: () => void): void {
  for (const slot of ['top', 'bottom'] as Slot[]) {
    const root = document.getElementById(`dropzone-${slot}`);
    const input = document.getElementById(`input-${slot}`) as HTMLInputElement | null;
    if (root && input) clearSlot(slot, root, input, () => undefined);
  }
  setState({ topCut: 0, bottomCut: 0, overlapPx: 0, frontLayer: 'top', diffMode: false, lastDetectionCost: null });
  onChange();
}
