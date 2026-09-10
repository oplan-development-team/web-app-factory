import './style.css';
import type { GemColor, PlacedPoint, RoseSegments, Settings, TemplateKind, ViewMode } from './types.ts';
import { GEM_PALETTE, extractDominantColors } from './palette.ts';
import { buildTemplate, isInside, type TemplateGeometry } from './templates.ts';
import { buildGridMask, buildCellBoundaryPath, computeField, gridSizeFor, type GridMask, type FieldResult } from './glass/field.ts';
import { renderWindow } from './glass/render.ts';
import { exportPng, downloadBlob } from './export.ts';

const CANVAS_W = 640;
const CANVAS_H = 780;
const DRAG_THRESHOLD = 5;
const HIT_RADIUS = 15;

interface AppState {
  template: TemplateKind;
  roseSegments: RoseSegments;
  points: PlacedPoint[];
  nextId: number;
  selectedColor: string;
  extractedColors: GemColor[];
  settings: Settings;
  mode: ViewMode;
  history: PlacedPoint[][];
}

const state: AppState = {
  template: 'arch',
  roseSegments: 8,
  points: [],
  nextId: 1,
  selectedColor: GEM_PALETTE[0]!.hex,
  extractedColors: [],
  settings: {
    irregularity: 0.4,
    leadThickness: 4,
    glassNoise: 0.35,
    backlightIntensity: 0.7,
  },
  mode: 'backlight',
  history: [],
};

// -- DOM refs -----------------------------------------------------------
const canvasEl = document.getElementById('glass-canvas') as HTMLCanvasElement;
const ctx = canvasEl.getContext('2d')!;
const windowFrameEl = document.getElementById('window-frame')!;
const emptyStateEl = document.getElementById('empty-state')!;
const pointCountEl = document.getElementById('point-count')!;

const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
const btnExportBacklight = document.getElementById('btn-export-backlight') as HTMLButtonElement;
const btnExportNatural = document.getElementById('btn-export-natural') as HTMLButtonElement;

const tplArchBtn = document.getElementById('tpl-arch') as HTMLButtonElement;
const tplRoseBtn = document.getElementById('tpl-rose') as HTMLButtonElement;
const roseSegmentsPanel = document.getElementById('rose-segments')!;

const paletteGrid = document.getElementById('palette-grid')!;
const extractedGrid = document.getElementById('extracted-grid')!;
const photoDrop = document.getElementById('photo-drop') as HTMLDivElement;
const photoInput = document.getElementById('photo-input') as HTMLInputElement;

const sliderIrregularity = document.getElementById('slider-irregularity') as HTMLInputElement;
const sliderLead = document.getElementById('slider-lead') as HTMLInputElement;
const sliderNoise = document.getElementById('slider-noise') as HTMLInputElement;
const sliderBacklight = document.getElementById('slider-backlight') as HTMLInputElement;

const modeBacklightBtn = document.getElementById('mode-backlight') as HTMLButtonElement;
const modeNaturalBtn = document.getElementById('mode-natural') as HTMLButtonElement;

const toastEl = document.getElementById('toast')!;

// -- Canvas backing store (kept 1:1 with logical units; CSS scales for
// responsiveness, pointer coords are converted back via bounding rect). --
canvasEl.width = CANVAS_W;
canvasEl.height = CANVAS_H;

// -- Derived geometry cache ----------------------------------------------
let currentGeom: TemplateGeometry;
let currentMask: GridMask;
let currentField: FieldResult;
let currentBoundaryPath: Path2D;

function rebuildTemplateGeometry(): void {
  currentGeom = buildTemplate(state.template, state.roseSegments, CANVAS_W, CANVAS_H);
  const { gridW, gridH } = gridSizeFor(CANVAS_W, CANVAS_H, 3);
  currentMask = buildGridMask(currentGeom, CANVAS_W, CANVAS_H, gridW, gridH);
  recomputeField();
}

function recomputeField(): void {
  currentField = computeField(state.points, currentGeom, currentMask, CANVAS_W, CANVAS_H, state.settings.irregularity, 1);
  currentBoundaryPath = buildCellBoundaryPath(currentField, CANVAS_W, CANVAS_H);
  render();
}

let debounceTimer: number | undefined;
function scheduleRecompute(debounced: boolean): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
  if (!debounced) {
    recomputeField();
    return;
  }
  debounceTimer = window.setTimeout(() => recomputeField(), 55);
}

function render(): void {
  renderWindow({
    ctx,
    canvasW: CANVAS_W,
    canvasH: CANVAS_H,
    geom: currentGeom,
    field: currentField,
    cellBoundaryPath: currentBoundaryPath,
    points: state.points,
    settings: state.settings,
    mode: state.mode,
  });
  drawEditMarkers();
  updateUIState();
}

function drawEditMarkers(): void {
  for (const p of state.points) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,8,6,0.55)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(224,192,104,0.85)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x - 1.3, p.y - 1.3, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
    ctx.restore();
  }
}

// -- History ---------------------------------------------------------------
function pushHistory(): void {
  state.history.push(state.points.map((p) => ({ ...p })));
  if (state.history.length > 50) state.history.shift();
}

function undo(): void {
  const prev = state.history.pop();
  if (!prev) return;
  state.points = prev;
  scheduleRecompute(false);
}

function clearAll(): void {
  if (state.points.length === 0) return;
  const ok = window.confirm('すべての点を削除します。よろしいですか？');
  if (!ok) return;
  pushHistory();
  state.points = [];
  scheduleRecompute(false);
}

// -- Template switching ------------------------------------------------
function confirmDiscardIfNeeded(): boolean {
  if (state.points.length === 0) return true;
  return window.confirm('テンプレートを変更すると現在の作業内容が失われます。よろしいですか？');
}

function selectTemplate(kind: TemplateKind): void {
  if (state.template === kind) return;
  if (!confirmDiscardIfNeeded()) return;
  state.template = kind;
  state.points = [];
  state.history = [];
  updateTemplateUI();
  rebuildTemplateGeometry();
}

function selectRoseSegments(segments: RoseSegments): void {
  if (state.roseSegments === segments && state.template === 'rose') return;
  if (!confirmDiscardIfNeeded()) return;
  state.roseSegments = segments;
  state.template = 'rose';
  state.points = [];
  state.history = [];
  updateTemplateUI();
  rebuildTemplateGeometry();
}

function updateTemplateUI(): void {
  tplArchBtn.classList.toggle('is-active', state.template === 'arch');
  tplRoseBtn.classList.toggle('is-active', state.template === 'rose');
  roseSegmentsPanel.hidden = state.template !== 'rose';
  document.querySelectorAll<HTMLButtonElement>('.segment-btn').forEach((btn) => {
    const seg = Number(btn.dataset.segments) as RoseSegments;
    btn.classList.toggle('is-active', state.template === 'rose' && seg === state.roseSegments);
  });
}

// -- Palette -----------------------------------------------------------
function createSwatch(color: GemColor): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'swatch';
  btn.style.setProperty('--swatch-color', color.hex);
  btn.title = color.name;
  btn.dataset.hex = color.hex;
  btn.setAttribute('role', 'option');
  btn.setAttribute('aria-label', color.name);
  btn.addEventListener('click', () => {
    state.selectedColor = color.hex;
    updateSwatchSelection();
  });
  return btn;
}

function renderGemPalette(): void {
  paletteGrid.innerHTML = '';
  for (const gem of GEM_PALETTE) paletteGrid.appendChild(createSwatch(gem));
  updateSwatchSelection();
}

function renderExtractedPalette(): void {
  extractedGrid.innerHTML = '';
  for (const c of state.extractedColors) extractedGrid.appendChild(createSwatch(c));
  updateSwatchSelection();
}

function updateSwatchSelection(): void {
  document.querySelectorAll<HTMLButtonElement>('.swatch').forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.hex === state.selectedColor);
  });
}

// -- Photo -> palette extraction ----------------------------------------
async function handleImageFile(file: File | null | undefined): Promise<void> {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('画像ファイルを選択してください', 'error');
    return;
  }
  photoDrop.classList.add('is-loading');
  const textEl = photoDrop.querySelector('.photo-drop__text');
  const originalText = textEl?.innerHTML ?? '';
  if (textEl) textEl.innerHTML = '色を抽出しています…';
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 180;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const tmp = document.createElement('canvas');
    tmp.width = Math.max(1, Math.round(bitmap.width * scale));
    tmp.height = Math.max(1, Math.round(bitmap.height * scale));
    const tctx = tmp.getContext('2d')!;
    tctx.drawImage(bitmap, 0, 0, tmp.width, tmp.height);
    bitmap.close();
    const imgData = tctx.getImageData(0, 0, tmp.width, tmp.height);
    const hexes = extractDominantColors(imgData, 7);
    state.extractedColors = hexes.map((hex, i) => ({
      id: `ext-${Date.now()}-${i}`,
      name: `抽出色${i + 1}`,
      hex,
      extracted: true,
    }));
    renderExtractedPalette();
    showToast(`写真から${hexes.length}色を抽出しました`);
  } catch (err) {
    console.error(err);
    showToast('色の抽出に失敗しました', 'error');
  } finally {
    photoDrop.classList.remove('is-loading');
    if (textEl) textEl.innerHTML = originalText;
  }
}

// -- Canvas pointer interactions -----------------------------------------
function toCanvasCoords(e: PointerEvent | MouseEvent): { x: number; y: number } {
  const rect = canvasEl.getBoundingClientRect();
  const scaleX = CANVAS_W / rect.width;
  const scaleY = CANVAS_H / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

function findPointAt(x: number, y: number): PlacedPoint | undefined {
  let best: PlacedPoint | undefined;
  let bestDist = HIT_RADIUS;
  for (const p of state.points) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

interface DragCandidate {
  id: number;
  startX: number;
  startY: number;
  moved: boolean;
}
let dragCandidate: DragCandidate | null = null;

// Double-click/double-tap deletion is detected manually (same point id, two
// pointerdowns within DOUBLE_TAP_MS) rather than relying solely on the
// browser's native `dblclick` event. In testing, a native dblclick can
// silently fail to fire if an unrelated DOM element (e.g. a toolbar button)
// was clicked immediately beforehand -- the click-detail counter used by the
// browser to decide "this is a double click" is shared page-wide, not
// per-element. Detecting it ourselves also gives touch double-tap the same
// reliable behaviour, per the touch requirement.
const DOUBLE_TAP_MS = 320;
let lastPointerDown: { id: number; time: number } | null = null;
let pendingRecolor: { id: number; timer: number } | null = null;

function deletePoint(id: number): void {
  if (pendingRecolor && pendingRecolor.id === id) {
    clearTimeout(pendingRecolor.timer);
    pendingRecolor = null;
  }
  pushHistory();
  state.points = state.points.filter((p) => p.id !== id);
  scheduleRecompute(false);
}

canvasEl.addEventListener('pointerdown', (e) => {
  if (e.button === 2) return; // right-click is handled by the contextmenu listener below
  const { x, y } = toCanvasCoords(e);
  const hit = findPointAt(x, y);
  if (hit) {
    const now = performance.now();
    if (lastPointerDown && lastPointerDown.id === hit.id && now - lastPointerDown.time < DOUBLE_TAP_MS) {
      lastPointerDown = null;
      deletePoint(hit.id);
      return;
    }
    lastPointerDown = { id: hit.id, time: now };
    dragCandidate = { id: hit.id, startX: x, startY: y, moved: false };
    canvasEl.setPointerCapture(e.pointerId);
    return;
  }
  lastPointerDown = null;
  if (!isInside(currentGeom, x, y)) return;
  pushHistory();
  state.points.push({ id: state.nextId++, x, y, color: state.selectedColor });
  scheduleRecompute(false);
});

canvasEl.addEventListener('pointermove', (e) => {
  if (!dragCandidate) return;
  const { x, y } = toCanvasCoords(e);
  if (!dragCandidate.moved) {
    const d = Math.hypot(x - dragCandidate.startX, y - dragCandidate.startY);
    if (d < DRAG_THRESHOLD) return;
    dragCandidate.moved = true;
    pushHistory();
  }
  const p = state.points.find((pp) => pp.id === dragCandidate!.id);
  if (p) {
    p.x = x;
    p.y = y;
    scheduleRecompute(true);
  }
});

function endDrag(e: PointerEvent): void {
  if (!dragCandidate) return;
  if (!dragCandidate.moved) {
    // Don't recolor immediately: give a same-point second tap a chance to
    // arrive and turn this into a delete instead (see DOUBLE_TAP_MS above).
    const id = dragCandidate.id;
    if (pendingRecolor) clearTimeout(pendingRecolor.timer);
    const timer = window.setTimeout(() => {
      const p = state.points.find((pp) => pp.id === id);
      if (p) {
        pushHistory();
        p.color = state.selectedColor;
        scheduleRecompute(false);
      }
      pendingRecolor = null;
    }, DOUBLE_TAP_MS + 30);
    pendingRecolor = { id, timer };
  } else {
    scheduleRecompute(false);
  }
  if (canvasEl.hasPointerCapture(e.pointerId)) canvasEl.releasePointerCapture(e.pointerId);
  dragCandidate = null;
}
canvasEl.addEventListener('pointerup', endDrag);
canvasEl.addEventListener('pointercancel', endDrag);

// Kept as a supplementary path for browsers/devices where the native
// dblclick still fires correctly; harmless no-op if the point is already
// gone (manual detection above usually wins the race).
canvasEl.addEventListener('dblclick', (e) => {
  const { x, y } = toCanvasCoords(e);
  const hit = findPointAt(x, y);
  if (!hit) return;
  deletePoint(hit.id);
});

canvasEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const { x, y } = toCanvasCoords(e);
  const hit = findPointAt(x, y);
  if (!hit) return;
  deletePoint(hit.id);
});

// -- Toolbar / mode -------------------------------------------------------
function setMode(mode: ViewMode): void {
  state.mode = mode;
  windowFrameEl.dataset.mode = mode;
  modeBacklightBtn.classList.toggle('is-active', mode === 'backlight');
  modeBacklightBtn.setAttribute('aria-pressed', String(mode === 'backlight'));
  modeNaturalBtn.classList.toggle('is-active', mode === 'natural');
  modeNaturalBtn.setAttribute('aria-pressed', String(mode === 'natural'));
  render();
}

// -- UI state sync ---------------------------------------------------------
function updateUIState(): void {
  const hasPoints = state.points.length > 0;
  emptyStateEl.classList.toggle('is-hidden', hasPoints);
  pointCountEl.textContent = `配置された硝子片: ${state.points.length}`;
  btnUndo.disabled = state.history.length === 0;
  btnClear.disabled = !hasPoints;
  btnExportBacklight.disabled = !hasPoints;
  btnExportNatural.disabled = !hasPoints;
}

// -- Toast -----------------------------------------------------------------
let toastTimer: number | undefined;
function showToast(message: string, kind: 'success' | 'error' = 'success'): void {
  toastEl.textContent = message;
  toastEl.className = `toast toast--visible toast--${kind}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.className = 'toast';
  }, 3200);
}

// -- Wiring ------------------------------------------------------------
tplArchBtn.addEventListener('click', () => selectTemplate('arch'));
tplRoseBtn.addEventListener('click', () => selectTemplate('rose'));
document.querySelectorAll<HTMLButtonElement>('.segment-btn').forEach((btn) => {
  btn.addEventListener('click', () => selectRoseSegments(Number(btn.dataset.segments) as RoseSegments));
});

btnUndo.addEventListener('click', undo);
btnClear.addEventListener('click', clearAll);

btnExportBacklight.addEventListener('click', async () => {
  try {
    const blob = await exportPng(state.template, state.roseSegments, CANVAS_W, CANVAS_H, state.points, state.settings, 'backlight');
    downloadBlob(blob, 'rosette-glass-backlight.png');
    showToast('バックライト状態のPNGを書き出しました');
  } catch (err) {
    console.error(err);
    showToast('書き出しに失敗しました', 'error');
  }
});

btnExportNatural.addEventListener('click', async () => {
  try {
    const blob = await exportPng(state.template, state.roseSegments, CANVAS_W, CANVAS_H, state.points, state.settings, 'natural');
    downloadBlob(blob, 'rosette-glass-natural.png');
    showToast('自然光状態のPNGを書き出しました');
  } catch (err) {
    console.error(err);
    showToast('書き出しに失敗しました', 'error');
  }
});

sliderIrregularity.addEventListener('input', () => {
  state.settings.irregularity = Number(sliderIrregularity.value) / 100;
  document.getElementById('val-irregularity')!.textContent = `${sliderIrregularity.value}%`;
  scheduleRecompute(true);
});
sliderLead.addEventListener('input', () => {
  state.settings.leadThickness = Number(sliderLead.value);
  document.getElementById('val-lead')!.textContent = sliderLead.value;
  render();
});
sliderNoise.addEventListener('input', () => {
  state.settings.glassNoise = Number(sliderNoise.value) / 100;
  document.getElementById('val-noise')!.textContent = `${sliderNoise.value}%`;
  render();
});
sliderBacklight.addEventListener('input', () => {
  state.settings.backlightIntensity = Number(sliderBacklight.value) / 100;
  document.getElementById('val-backlight')!.textContent = `${sliderBacklight.value}%`;
  render();
});

modeBacklightBtn.addEventListener('click', () => setMode('backlight'));
modeNaturalBtn.addEventListener('click', () => setMode('natural'));

photoDrop.addEventListener('click', () => photoInput.click());
photoDrop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    photoInput.click();
  }
});
photoInput.addEventListener('change', () => {
  void handleImageFile(photoInput.files?.[0]);
  photoInput.value = '';
});
photoDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  photoDrop.classList.add('is-dragover');
});
photoDrop.addEventListener('dragleave', () => photoDrop.classList.remove('is-dragover'));
photoDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  photoDrop.classList.remove('is-dragover');
  void handleImageFile(e.dataTransfer?.files?.[0]);
});

// -- Boot --------------------------------------------------------------
renderGemPalette();
updateTemplateUI();
rebuildTemplateGeometry();
setMode('backlight');
updateUIState();
