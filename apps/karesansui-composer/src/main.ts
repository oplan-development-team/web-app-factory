import '@fontsource/shippori-mincho/500.css';
import '@fontsource/zen-kaku-gothic-new/300.css';
import '@fontsource/zen-kaku-gothic-new/400.css';
import './style.css';

import type { GardenState, RatioKey, RatioPreset, Stone, Streamline } from './types';
import {
  DEFAULT_SAND_PARAMS,
  RATIO_PRESETS,
  SAMPLE_GARDENS,
  STONE_MAX_COUNT,
  STONE_RADIUS_DEFAULT,
  STONE_RADIUS_MAX,
  STONE_RADIUS_MIN,
  instantiateSampleGarden,
  makeStone,
} from './presets';
import { generateStreamlines } from './streamlines';
import { makeLineSeed, renderGarden } from './renderer';
import { UndoBuffer } from './undo';
import { showToast } from './toast';
import { confirmDialog } from './dialog';
import { buildSvgDocument } from './svgExport';
import { buildPosterCanvas, canvasToBlob } from './pngExport';
import { triggerDownload, timestampSlug } from './download';

// ------------------------------------------------------------------ state

const state: GardenState = {
  ratio: 'horizontal',
  stones: [],
  sand: { ...DEFAULT_SAND_PARAMS },
  selectedStoneId: null,
};

let streamlines: Streamline[] = [];
let lineSeedCache: number[] = [1];
const undoBuffer = new UndoBuffer();
let sampleCursor = 0;
let recomputeTimer: number | undefined;

// -------------------------------------------------------------------- dom

const canvas = document.getElementById('garden-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('canvas 2d context unavailable');

const matFrame = document.getElementById('mat-frame') as HTMLElement;
const emptyState = document.getElementById('empty-state') as HTMLElement;
const stoneToolbar = document.getElementById('stone-toolbar') as HTMLElement;
const stoneSizeSlider = document.getElementById('stone-size-slider') as HTMLInputElement;
const btnDeleteStone = document.getElementById('btn-delete-stone') as HTMLButtonElement;

const captionRatioEl = document.getElementById('caption-ratio') as HTMLElement;
const captionStoneCountEl = document.getElementById('caption-stone-count') as HTMLElement;

const ratioButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.ratio-btn'));

const sliderDensity = document.getElementById('slider-density') as HTMLInputElement;
const sliderInfluence = document.getElementById('slider-influence') as HTMLInputElement;
const sliderAngle = document.getElementById('slider-angle') as HTMLInputElement;
const sliderAmplitude = document.getElementById('slider-amplitude') as HTMLInputElement;
const sliderPeriod = document.getElementById('slider-period') as HTMLInputElement;

const valueDensity = document.getElementById('value-density') as HTMLElement;
const valueInfluence = document.getElementById('value-influence') as HTMLElement;
const valueAngle = document.getElementById('value-angle') as HTMLElement;
const valueAmplitude = document.getElementById('value-amplitude') as HTMLElement;
const valuePeriod = document.getElementById('value-period') as HTMLElement;

const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
const btnLoadSample = document.getElementById('btn-load-sample') as HTMLButtonElement;
const btnLoadSampleEmpty = document.getElementById('btn-load-sample-empty') as HTMLButtonElement;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
const btnExportPng = document.getElementById('btn-export-png') as HTMLButtonElement;
const btnExportSvg = document.getElementById('btn-export-svg') as HTMLButtonElement;

// ---------------------------------------------------------------- helpers

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function currentPreset(): RatioPreset {
  return RATIO_PRESETS[state.ratio];
}

function findStoneAt(x: number, y: number): Stone | null {
  for (let i = state.stones.length - 1; i >= 0; i--) {
    const s = state.stones[i]!;
    if (Math.hypot(x - s.x, y - s.y) <= s.radius) return s;
  }
  return null;
}

function sizeToSliderValue(radius: number): number {
  return ((radius - STONE_RADIUS_MIN) / (STONE_RADIUS_MAX - STONE_RADIUS_MIN)) * 100;
}

function sliderValueToSize(v: number): number {
  return STONE_RADIUS_MIN + (v / 100) * (STONE_RADIUS_MAX - STONE_RADIUS_MIN);
}

// ------------------------------------------------------------ core render

function resizeCanvasBuffer(): void {
  const preset = currentPreset();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(preset.width * dpr);
  canvas.height = Math.round(preset.height * dpr);
  ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function render(): void {
  const preset = currentPreset();
  renderGarden(ctx!, {
    width: preset.width,
    height: preset.height,
    stones: state.stones,
    streamlines,
    selectedStoneId: state.selectedStoneId,
    lineSeed: lineSeedCache,
  });
}

function recomputeNow(): void {
  const preset = currentPreset();
  // a garden with no stones is simply blank paper — the rake pattern only
  // appears once there is something for it to flow around
  streamlines =
    state.stones.length === 0
      ? []
      : generateStreamlines(state.stones, state.sand, { width: preset.width, height: preset.height });
  lineSeedCache = makeLineSeed(Math.max(1, streamlines.length));
  render();
  syncDerivedUi();
}

function scheduleRecompute(delay = 220): void {
  if (recomputeTimer !== undefined) window.clearTimeout(recomputeTimer);
  recomputeTimer = window.setTimeout(() => {
    matFrame.classList.add('is-computing');
    requestAnimationFrame(() => {
      recomputeNow();
      matFrame.classList.remove('is-computing');
    });
  }, delay);
}

// ----------------------------------------------------------------- ui sync

function updateUndoButtonState(): void {
  btnUndo.disabled = !undoBuffer.hasSnapshot;
}

function updateExportButtonState(): void {
  const disabled = state.stones.length === 0;
  btnExportPng.disabled = disabled;
  btnExportSvg.disabled = disabled;
}

function updateEmptyStateVisibility(): void {
  emptyState.hidden = state.stones.length > 0;
}

function updateCaptions(): void {
  captionRatioEl.textContent = currentPreset().captionLabel;
  captionStoneCountEl.textContent = `石　${state.stones.length} / ${STONE_MAX_COUNT}`;
}

function updateRatioButtonsUi(): void {
  ratioButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.ratio === state.ratio));
}

function syncDerivedUi(): void {
  updateEmptyStateVisibility();
  updateExportButtonState();
  updateCaptions();
}

// ------------------------------------------------------------- stone toolbar

function positionStoneToolbar(stone: Stone): void {
  const rect = canvas.getBoundingClientRect();
  const frameRect = matFrame.getBoundingClientRect();
  const preset = currentPreset();
  const scale = rect.width / preset.width;
  const screenX = rect.left + stone.x * scale - frameRect.left;
  const screenY = rect.top + stone.y * scale - frameRect.top;
  const screenRadius = stone.radius * scale;
  stoneToolbar.style.left = `${screenX}px`;
  stoneToolbar.style.top = `${screenY - screenRadius}px`;
}

function showStoneToolbarFor(stone: Stone): void {
  stoneToolbar.hidden = false;
  stoneSizeSlider.value = String(sizeToSliderValue(stone.radius));
  positionStoneToolbar(stone);
}

function hideStoneToolbar(): void {
  stoneToolbar.hidden = true;
}

// ------------------------------------------------------------------ actions

function deleteSelectedStone(): void {
  const idx = state.stones.findIndex((s) => s.id === state.selectedStoneId);
  if (idx === -1) return;
  undoBuffer.capture(state.stones);
  state.stones.splice(idx, 1);
  state.selectedStoneId = null;
  hideStoneToolbar();
  recomputeNow();
  updateUndoButtonState();
}

function performUndo(): void {
  const snap = undoBuffer.pop();
  if (!snap) return;
  state.stones = snap;
  if (state.selectedStoneId && !state.stones.some((s) => s.id === state.selectedStoneId)) {
    state.selectedStoneId = null;
    hideStoneToolbar();
  } else if (state.selectedStoneId) {
    const s = state.stones.find((x) => x.id === state.selectedStoneId)!;
    showStoneToolbarFor(s);
  }
  recomputeNow();
  updateUndoButtonState();
  showToast('ひとつ前の状態に戻しました');
}

async function loadNextSample(): Promise<void> {
  if (state.stones.length > 0) {
    const ok = await confirmDialog('現在の配置を破棄してサンプルを読み込みますか？', '読み込む', 'やめる');
    if (!ok) return;
  }
  const sample = SAMPLE_GARDENS[sampleCursor % SAMPLE_GARDENS.length]!;
  sampleCursor += 1;
  undoBuffer.capture(state.stones);
  const preset = currentPreset();
  state.stones = instantiateSampleGarden(sample, preset.width, preset.height);
  state.selectedStoneId = null;
  hideStoneToolbar();
  recomputeNow();
  updateUndoButtonState();
  showToast(`「${sample.name}」を読み込みました — ${sample.description}`);
}

async function clearGarden(): Promise<void> {
  if (state.stones.length === 0) {
    showToast('すでに空の庭です');
    return;
  }
  const ok = await confirmDialog('石をすべて取り除き、空の庭に戻しますか？', '空にする', 'やめる');
  if (!ok) return;
  undoBuffer.capture(state.stones);
  state.stones = [];
  state.selectedStoneId = null;
  hideStoneToolbar();
  recomputeNow();
  updateUndoButtonState();
  showToast('空の庭に戻しました');
}

function remapStonesToPreset(
  stones: Stone[],
  oldPreset: RatioPreset,
  newPreset: RatioPreset,
): { stones: Stone[]; adjustedCount: number } {
  const areaScale = Math.sqrt((newPreset.width * newPreset.height) / (oldPreset.width * oldPreset.height));
  let adjustedCount = 0;
  const remapped = stones.map((s) => {
    const fx = s.x / oldPreset.width;
    const fy = s.y / oldPreset.height;
    const radius = clamp(s.radius * areaScale, STONE_RADIUS_MIN, STONE_RADIUS_MAX);
    const x = fx * newPreset.width;
    const y = fy * newPreset.height;
    const margin = radius + 6;
    const maxX = Math.max(margin, newPreset.width - margin);
    const maxY = Math.max(margin, newPreset.height - margin);
    const clampedX = clamp(x, margin, maxX);
    const clampedY = clamp(y, margin, maxY);
    if (Math.abs(clampedX - x) > 0.5 || Math.abs(clampedY - y) > 0.5) adjustedCount += 1;
    return { ...s, x: clampedX, y: clampedY, radius };
  });
  return { stones: remapped, adjustedCount };
}

async function switchRatio(newRatio: RatioKey): Promise<void> {
  if (newRatio === state.ratio) return;
  const oldPreset = currentPreset();
  const newPreset = RATIO_PRESETS[newRatio];
  const { stones: remapped, adjustedCount } = remapStonesToPreset(state.stones, oldPreset, newPreset);

  if (adjustedCount > 0) {
    const ok = await confirmDialog(
      `用紙の比率を変更すると、${adjustedCount}個の石の位置が新しい枠内に収まるよう自動調整されます。よろしいですか？`,
      '変更する',
      'やめる',
    );
    if (!ok) return;
  }

  undoBuffer.capture(state.stones);
  state.ratio = newRatio;
  state.stones = remapped;
  state.selectedStoneId = null;
  hideStoneToolbar();
  updateRatioButtonsUi();
  resizeCanvasBuffer();
  recomputeNow();
  updateUndoButtonState();

  if (adjustedCount > 0) {
    showToast(`${adjustedCount}個の石の位置を新しい枠に合わせて調整しました`);
  }
}

// -------------------------------------------------------------- pointer io

function getLogicalPoint(e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const preset = currentPreset();
  const x = ((e.clientX - rect.left) / rect.width) * preset.width;
  const y = ((e.clientY - rect.top) / rect.height) * preset.height;
  return { x, y };
}

interface DragState {
  id: string;
  movedSnapshotCaptured: boolean;
}

let dragState: DragState | null = null;

canvas.addEventListener('pointerdown', (e) => {
  const p = getLogicalPoint(e);
  const hit = findStoneAt(p.x, p.y);

  if (hit) {
    state.selectedStoneId = hit.id;
    dragState = { id: hit.id, movedSnapshotCaptured: false };
    canvas.setPointerCapture(e.pointerId);
    showStoneToolbarFor(hit);
    render();
    return;
  }

  if (state.stones.length >= STONE_MAX_COUNT) {
    showToast(`石の上限（${STONE_MAX_COUNT}個）に達しています`, { tone: 'accent' });
    return;
  }

  undoBuffer.capture(state.stones);
  const stone = makeStone(p.x, p.y, STONE_RADIUS_DEFAULT);
  state.stones.push(stone);
  state.selectedStoneId = stone.id;
  updateUndoButtonState();
  showStoneToolbarFor(stone);
  recomputeNow();
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragState) return;
  const stone = state.stones.find((s) => s.id === dragState!.id);
  if (!stone) return;

  if (!dragState.movedSnapshotCaptured) {
    undoBuffer.capture(state.stones);
    dragState.movedSnapshotCaptured = true;
    updateUndoButtonState();
  }

  const p = getLogicalPoint(e);
  const preset = currentPreset();
  const margin = stone.radius * 0.3;
  stone.x = clamp(p.x, margin, preset.width - margin);
  stone.y = clamp(p.y, margin, preset.height - margin);
  positionStoneToolbar(stone);
  render();
  scheduleRecompute();
});

function endDrag(): void {
  dragState = null;
}

window.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ----------------------------------------------------------- stone toolbar io

stoneSizeSlider.addEventListener('input', () => {
  const stone = state.stones.find((s) => s.id === state.selectedStoneId);
  if (!stone) return;
  stone.radius = sliderValueToSize(Number(stoneSizeSlider.value));
  positionStoneToolbar(stone);
  render();
  scheduleRecompute();
});

let sizeAdjustCaptured = false;
stoneSizeSlider.addEventListener('pointerdown', () => {
  if (!sizeAdjustCaptured) {
    undoBuffer.capture(state.stones);
    sizeAdjustCaptured = true;
    updateUndoButtonState();
  }
});
window.addEventListener('pointerup', () => {
  sizeAdjustCaptured = false;
});

btnDeleteStone.addEventListener('click', deleteSelectedStone);

// ------------------------------------------------------------- sand sliders

sliderDensity.addEventListener('input', () => {
  state.sand.density = Number(sliderDensity.value);
  valueDensity.textContent = sliderDensity.value;
  scheduleRecompute();
});
sliderInfluence.addEventListener('input', () => {
  state.sand.influence = Number(sliderInfluence.value);
  valueInfluence.textContent = sliderInfluence.value;
  scheduleRecompute();
});
sliderAngle.addEventListener('input', () => {
  state.sand.angleDeg = Number(sliderAngle.value);
  valueAngle.textContent = `${sliderAngle.value}°`;
  scheduleRecompute();
});
sliderAmplitude.addEventListener('input', () => {
  state.sand.amplitude = Number(sliderAmplitude.value);
  valueAmplitude.textContent = sliderAmplitude.value;
  scheduleRecompute();
});
sliderPeriod.addEventListener('input', () => {
  state.sand.period = Number(sliderPeriod.value);
  valuePeriod.textContent = sliderPeriod.value;
  scheduleRecompute();
});

// --------------------------------------------------------------- top-level ui

ratioButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    void switchRatio(btn.dataset.ratio as RatioKey);
  });
});

btnUndo.addEventListener('click', performUndo);
btnLoadSample.addEventListener('click', () => void loadNextSample());
btnLoadSampleEmpty.addEventListener('click', () => void loadNextSample());
btnClear.addEventListener('click', () => void clearGarden());

btnExportPng.addEventListener('click', async () => {
  if (state.stones.length === 0) {
    showToast('まず石を庭に置いてください');
    return;
  }
  const toast = showToast('ポスターを書き出しています…', { duration: 0 });
  try {
    const preset = currentPreset();
    const poster = await buildPosterCanvas({ preset, stones: state.stones, streamlines });
    const blob = await canvasToBlob(poster);
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `karesansui-${timestampSlug()}.png`);
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.update('PNGを書き出しました');
    window.setTimeout(toast.close, 1800);
  } catch (err) {
    console.error(err);
    toast.update('書き出しに失敗しました');
    window.setTimeout(toast.close, 2400);
  }
});

btnExportSvg.addEventListener('click', () => {
  if (state.stones.length === 0) {
    showToast('まず石を庭に置いてください');
    return;
  }
  const toast = showToast('SVGを書き出しています…', { duration: 0 });
  try {
    const preset = currentPreset();
    const svg = buildSvgDocument({ width: preset.width, height: preset.height, stones: state.stones, streamlines });
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `karesansui-${timestampSlug()}.svg`);
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.update('SVGを書き出しました');
    window.setTimeout(toast.close, 1800);
  } catch (err) {
    console.error(err);
    toast.update('書き出しに失敗しました');
    window.setTimeout(toast.close, 2400);
  }
});

document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement | null;
  const isFormField = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    performUndo();
    return;
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && !isFormField && state.selectedStoneId) {
    e.preventDefault();
    deleteSelectedStone();
  }
});

window.addEventListener('resize', () => {
  render();
  if (state.selectedStoneId) {
    const s = state.stones.find((x) => x.id === state.selectedStoneId);
    if (s) positionStoneToolbar(s);
  }
});

// ---------------------------------------------------------------------- init

function init(): void {
  updateRatioButtonsUi();
  resizeCanvasBuffer();
  recomputeNow();
  updateUndoButtonState();
}

init();
