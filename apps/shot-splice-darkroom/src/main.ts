import './style.css';

import { createInitialState, withPatch, hasBothImages, maxOverlapPx, type AppState } from './state.ts';
import { detectOverlap } from './lib/align.ts';
import { renderComposite, type CompositeMode, type FrontLayer } from './lib/compositor.ts';
import { loadImageFile, formatBytes, ImageLoadError } from './lib/image-io.ts';
import { downloadCanvasAsPng, makeSpliceFilename } from './lib/download.ts';
import { wireDropzone } from './ui/dropzone.ts';
import { showToast } from './ui/toast.ts';
import { updateLoupe, hideLoupe } from './ui/loupe.ts';

function required<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`要素が見つかりません: ${selector}`);
  return el;
}

function requiredAll<T extends Element>(selector: string): T[] {
  return Array.from(document.querySelectorAll<T>(selector));
}

interface TrayRefs {
  readonly dropzone: HTMLElement;
  readonly fileInput: HTMLInputElement;
  readonly preview: HTMLImageElement;
  readonly hint: HTMLElement;
  readonly meta: HTMLElement;
}

function trayRefs(role: 'a' | 'b'): TrayRefs {
  return {
    dropzone: required<HTMLElement>(`[data-dropzone="${role}"]`),
    fileInput: required<HTMLInputElement>(`[data-file-input="${role}"]`),
    preview: required<HTMLImageElement>(`[data-dropzone="${role}"] .tray__preview`),
    hint: required<HTMLElement>(`[data-dropzone="${role}"] .tray__hint`),
    meta: required<HTMLElement>(`[data-meta="${role}"]`),
  };
}

// --- DOM references ----------------------------------------------------------

const trayA = trayRefs('a');
const trayB = trayRefs('b');

const swapBtn = required<HTMLButtonElement>('[data-action="swap"]');
const clearAllBtn = required<HTMLButtonElement>('[data-action="clear-all"]');
const autoAlignBtn = required<HTMLButtonElement>('[data-action="auto-align"]');
const downloadBtn = required<HTMLButtonElement>('[data-action="download"]');

const modeButtons = requiredAll<HTMLButtonElement>('[data-mode]');
const frontButtons = requiredAll<HTMLButtonElement>('[data-front]');

const canvas = required<HTMLCanvasElement>('[data-canvas]');
const canvasWrap = required<HTMLElement>('[data-canvas-wrap]');
const emptyState = required<HTMLElement>('[data-empty]');
const seamLine = required<HTMLElement>('[data-seam-line]');
const statusOverlay = required<HTMLElement>('[data-status]');
const loupeContainer = required<HTMLElement>('[data-loupe]');
const loupeCanvas = required<HTMLCanvasElement>('[data-loupe-canvas]');
const toastEl = required<HTMLElement>('[data-toast]');

const readoutSize = required<HTMLElement>('[data-readout="size"]');
const readoutOverlap = required<HTMLElement>('[data-readout="overlap"]');
const readoutScore = required<HTMLElement>('[data-readout="score"]');

const overlapInput = required<HTMLInputElement>('[data-input="overlap"]');
const overlapRange = required<HTMLInputElement>('[data-range="overlap"]');
const cropBottomAInput = required<HTMLInputElement>('[data-input="cropBottomA"]');
const cropTopBInput = required<HTMLInputElement>('[data-input="cropTopB"]');
const nudgeButtons = requiredAll<HTMLButtonElement>('[data-nudge]');

// --- Mutable app state ---------------------------------------------------------
// Tray thumbnails are cosmetic and derived from the source File objects, so
// their object URLs are tracked outside AppState rather than modelled in it.

let state: AppState = createInitialState();
let previewUrlA: string | null = null;
let previewUrlB: string | null = null;
let isDraggingSeam = false;

function setState(patch: Partial<AppState>): void {
  state = withPatch(state, patch);
  render();
}

// --- Tray preview thumbnails ----------------------------------------------------

function setTrayPreview(role: 'a' | 'b', file: File, img: HTMLImageElement): void {
  const tray = role === 'a' ? trayA : trayB;
  const previousUrl = role === 'a' ? previewUrlA : previewUrlB;
  if (previousUrl) URL.revokeObjectURL(previousUrl);

  const url = URL.createObjectURL(file);
  if (role === 'a') previewUrlA = url;
  else previewUrlB = url;

  tray.preview.src = url;
  tray.preview.hidden = false;
  tray.hint.hidden = true;
  tray.dropzone.classList.add('has-image');
  tray.meta.textContent = `${img.naturalWidth} × ${img.naturalHeight}px ・ ${formatBytes(file.size)}`;
}

function clearTrayPreview(role: 'a' | 'b'): void {
  const tray = role === 'a' ? trayA : trayB;
  const previousUrl = role === 'a' ? previewUrlA : previewUrlB;
  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
    if (role === 'a') previewUrlA = null;
    else previewUrlB = null;
  }
  tray.preview.hidden = true;
  tray.preview.removeAttribute('src');
  tray.hint.hidden = false;
  tray.dropzone.classList.remove('has-image');
  tray.meta.textContent = '未読み込み';
}

async function handleFiles(role: 'a' | 'b', files: FileList): Promise<void> {
  const file = files[0];
  if (!file) return;
  try {
    const img = await loadImageFile(file);
    setTrayPreview(role, file, img);
    // A fresh image invalidates any previously computed overlap and the
    // crop that belonged to the old file, so both reset to a safe default.
    setState(
      role === 'a'
        ? { imageA: img, cropBottomA: 0, overlapPx: 0, lastDetectScore: null }
        : { imageB: img, cropTopB: 0, overlapPx: 0, lastDetectScore: null },
    );
    if (hasBothImages(state)) {
      showToast(toastEl, 'ネガが揃った。自動位置合わせを試すか、手動で追い込める。', 'success');
    }
  } catch (error) {
    const message = error instanceof ImageLoadError ? error.message : '画像の読み込みに失敗した';
    showToast(toastEl, message, 'error');
  }
}

function swapImages(): void {
  if (!hasBothImages(state)) return;

  const previewUrlSwapA = previewUrlB;
  const previewUrlSwapB = previewUrlA;
  previewUrlA = previewUrlSwapA;
  previewUrlB = previewUrlSwapB;

  const srcA = trayA.preview.src;
  const srcB = trayB.preview.src;
  trayA.preview.src = srcB;
  trayB.preview.src = srcA;

  const metaA = trayA.meta.textContent;
  const metaB = trayB.meta.textContent;
  trayA.meta.textContent = metaB;
  trayB.meta.textContent = metaA;

  // Crop settings are position-specific (bottom-of-top, top-of-bottom), not
  // image-specific, so they cannot be meaningfully carried across a swap —
  // reset instead of silently applying the wrong edge's crop.
  setState({
    imageA: state.imageB,
    imageB: state.imageA,
    cropBottomA: 0,
    cropTopB: 0,
    overlapPx: 0,
    lastDetectScore: null,
  });
}

function clearAll(): void {
  clearTrayPreview('a');
  clearTrayPreview('b');
  state = createInitialState();
  render();
}

// --- Auto-alignment -------------------------------------------------------------

async function runAutoAlign(): Promise<void> {
  const imgA = state.imageA;
  const imgB = state.imageB;
  if (!imgA || !imgB) return;

  setState({ status: 'detecting' });
  // Yield two frames so the "developing…" overlay actually paints before the
  // synchronous, CPU-heavy search runs.
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  if (state.imageA !== imgA || state.imageB !== imgB) return; // trays changed mid-flight

  try {
    const result = detectOverlap(imgA, imgB);
    setState({ overlapPx: result.overlapPx, lastDetectScore: result.score, status: 'ready' });
    sweepSeamLine();
    const message =
      result.score < 12
        ? '継ぎ目がぴったり合った。'
        : '大まかに合わせた。差分確認モードで追い込むとよい。';
    showToast(toastEl, message, 'success');
  } catch {
    setState({ status: 'ready' });
    showToast(toastEl, '自動位置合わせに失敗した。手動で調整してほしい。', 'error');
  }
}

function sweepSeamLine(): void {
  seamLine.classList.remove('is-sweeping');
  void seamLine.offsetWidth; // restart the CSS animation
  seamLine.classList.add('is-sweeping');
}

// --- Download --------------------------------------------------------------------

async function handleDownload(): Promise<void> {
  if (!state.imageA || !state.imageB) return;
  // Export always uses the normal composite, regardless of which view mode
  // (normal/diff) is currently on screen — diff mode is a QA aid, not output.
  const exportCanvas = document.createElement('canvas');
  renderComposite(
    exportCanvas,
    state.imageA,
    state.imageB,
    {
      cropBottomA: state.cropBottomA,
      cropTopB: state.cropTopB,
      overlapPx: state.overlapPx,
      frontLayer: state.frontLayer,
    },
    'normal',
  );
  try {
    await downloadCanvasAsPng(exportCanvas, makeSpliceFilename());
    showToast(toastEl, '書き出し完了。', 'success');
  } catch {
    showToast(toastEl, '書き出しに失敗した。', 'error');
  }
}

// --- Numeric controls --------------------------------------------------------------

function syncNumberInput(input: HTMLInputElement, value: number): void {
  if (document.activeElement === input) return;
  input.value = String(value);
}

function commitOverlap(nextValue: number): void {
  const max = maxOverlapPx(state);
  const clamped = Math.max(0, Math.min(Math.round(nextValue), max));
  setState({ overlapPx: clamped });
}

function handleArrowNudge(event: KeyboardEvent): void {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  event.preventDefault();
  const step = event.shiftKey ? 10 : 1;
  const delta = event.key === 'ArrowUp' ? step : -step;
  commitOverlap(state.overlapPx + delta);
}

// --- Render ---------------------------------------------------------------------

function render(): void {
  const both = hasBothImages(state);

  swapBtn.disabled = !both;
  clearAllBtn.disabled = !state.imageA && !state.imageB;
  autoAlignBtn.disabled = !both || state.status === 'detecting';
  downloadBtn.disabled = !both;
  overlapInput.disabled = !both;
  overlapRange.disabled = !both;
  cropBottomAInput.disabled = !state.imageA;
  cropTopBInput.disabled = !state.imageB;

  for (const btn of nudgeButtons) {
    const key = btn.dataset.nudge;
    if (key === 'overlap') btn.disabled = !both;
    else if (key === 'cropBottomA') btn.disabled = !state.imageA;
    else if (key === 'cropTopB') btn.disabled = !state.imageB;
  }

  const max = maxOverlapPx(state);
  syncNumberInput(overlapInput, state.overlapPx);
  syncNumberInput(cropBottomAInput, state.cropBottomA);
  syncNumberInput(cropTopBInput, state.cropTopB);
  overlapInput.max = String(max);
  overlapRange.max = String(max);
  overlapRange.value = String(state.overlapPx);
  cropBottomAInput.max = state.imageA ? String(state.imageA.naturalHeight) : '0';
  cropTopBInput.max = state.imageB ? String(state.imageB.naturalHeight) : '0';

  for (const btn of modeButtons) btn.classList.toggle('is-active', btn.dataset.mode === state.mode);
  for (const btn of frontButtons) btn.classList.toggle('is-active', btn.dataset.front === state.frontLayer);

  if (!both) {
    canvas.hidden = true;
    emptyState.hidden = false;
    seamLine.hidden = true;
    statusOverlay.hidden = true;
    hideLoupe({ container: loupeContainer, canvas: loupeCanvas });
    readoutSize.textContent = '— × —';
    readoutOverlap.textContent = '— px';
    readoutScore.textContent = '—';
    delete readoutScore.dataset.state;
    return;
  }

  emptyState.hidden = true;
  canvas.hidden = false;
  statusOverlay.hidden = state.status !== 'detecting';

  const geometry = renderComposite(
    canvas,
    state.imageA!,
    state.imageB!,
    {
      cropBottomA: state.cropBottomA,
      cropTopB: state.cropTopB,
      overlapPx: state.overlapPx,
      frontLayer: state.frontLayer,
    },
    state.mode,
  );

  readoutSize.textContent = `${geometry.outWidth} × ${geometry.outHeight}`;
  readoutOverlap.textContent = `${geometry.overlap} px`;

  if (state.lastDetectScore !== null) {
    readoutScore.textContent = state.lastDetectScore.toFixed(1);
    readoutScore.dataset.state = state.lastDetectScore < 12 ? 'good' : state.lastDetectScore > 40 ? 'warn' : '';
  } else {
    readoutScore.textContent = '—';
    delete readoutScore.dataset.state;
  }

  seamLine.setAttribute('aria-valuemax', String(max));
  seamLine.setAttribute('aria-valuenow', String(geometry.overlap));
  positionSeamLine(geometry.heightA, geometry.overlap);
}

function positionSeamLine(heightA: number, overlap: number): void {
  const displayScale = canvas.clientHeight / Math.max(1, canvas.height);
  const bandY = heightA - overlap;
  seamLine.style.top = `${canvas.offsetTop + bandY * displayScale}px`;
  seamLine.style.left = `${canvas.offsetLeft}px`;
  seamLine.style.width = `${canvas.clientWidth}px`;
  seamLine.hidden = false;
}

// --- Wiring -----------------------------------------------------------------------

wireDropzone(trayA.dropzone, trayA.fileInput, { onFiles: (files) => void handleFiles('a', files) });
wireDropzone(trayB.dropzone, trayB.fileInput, { onFiles: (files) => void handleFiles('b', files) });

swapBtn.addEventListener('click', swapImages);
clearAllBtn.addEventListener('click', clearAll);
autoAlignBtn.addEventListener('click', () => void runAutoAlign());
downloadBtn.addEventListener('click', () => void handleDownload());

for (const btn of modeButtons) {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode as CompositeMode | undefined;
    if (mode) setState({ mode });
  });
}

for (const btn of frontButtons) {
  btn.addEventListener('click', () => {
    const front = btn.dataset.front as FrontLayer | undefined;
    if (front) setState({ frontLayer: front });
  });
}

overlapInput.addEventListener('input', () => {
  const value = Number(overlapInput.value);
  if (Number.isFinite(value)) commitOverlap(value);
});
overlapInput.addEventListener('keydown', handleArrowNudge);

overlapRange.addEventListener('input', () => commitOverlap(Number(overlapRange.value)));

cropBottomAInput.addEventListener('input', () => {
  const value = Number(cropBottomAInput.value);
  if (Number.isFinite(value)) setState({ cropBottomA: Math.max(0, Math.round(value)) });
});

cropTopBInput.addEventListener('input', () => {
  const value = Number(cropTopBInput.value);
  if (Number.isFinite(value)) setState({ cropTopB: Math.max(0, Math.round(value)) });
});

for (const btn of nudgeButtons) {
  btn.addEventListener('click', () => {
    const key = btn.dataset.nudge;
    const delta = Number(btn.dataset.delta ?? '0');
    if (key === 'overlap') commitOverlap(state.overlapPx + delta);
    else if (key === 'cropBottomA') setState({ cropBottomA: Math.max(0, state.cropBottomA + delta) });
    else if (key === 'cropTopB') setState({ cropTopB: Math.max(0, state.cropTopB + delta) });
  });
}

// Seam-line drag adjusts overlap: dragging the boundary up increases the
// overlap (pulls the two negatives together), dragging down decreases it.
seamLine.addEventListener('pointerdown', (event) => {
  if (!hasBothImages(state)) return;
  isDraggingSeam = true;
  seamLine.setPointerCapture(event.pointerId);
  seamLine.dataset.dragStartY = String(event.clientY);
  seamLine.dataset.dragStartOverlap = String(state.overlapPx);
});

seamLine.addEventListener('pointermove', (event) => {
  if (!isDraggingSeam) return;
  const startY = Number(seamLine.dataset.dragStartY ?? '0');
  const startOverlap = Number(seamLine.dataset.dragStartOverlap ?? '0');
  const displayScale = canvas.height / Math.max(1, canvas.clientHeight);
  const movedUp = (startY - event.clientY) * displayScale;
  commitOverlap(startOverlap + movedUp);
});

seamLine.addEventListener('pointerup', (event) => {
  isDraggingSeam = false;
  seamLine.releasePointerCapture(event.pointerId);
});
seamLine.addEventListener('pointercancel', () => {
  isDraggingSeam = false;
});
seamLine.addEventListener('keydown', handleArrowNudge);

canvasWrap.addEventListener('pointermove', (event) => {
  if (!hasBothImages(state)) return;
  updateLoupe({ container: loupeContainer, canvas: loupeCanvas }, canvas, canvasWrap, event.clientX, event.clientY);
});
canvasWrap.addEventListener('pointerleave', () => {
  hideLoupe({ container: loupeContainer, canvas: loupeCanvas });
});

window.addEventListener('resize', () => {
  if (hasBothImages(state)) render();
});

render();
