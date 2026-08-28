import '@fontsource/cormorant/500.css';
import '@fontsource/cormorant/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './style.css';

import { PAPERS, PRESETS, findPaper, findPreset } from './presets.ts';
import { ScalarField } from './field.ts';
import { traceAllContours } from './marchingSquares.ts';
import { computeLayout, computeGridSize } from './layout.ts';
import { renderPoster } from './render.ts';
import { buildPosterSVG, serializeSVG } from './svgExport.ts';
import type { ContourPolyline, PaperId, PosterState, PresetId } from './types.ts';

const MAX_UNDO = 20;
const BASE_WIDTH = 900;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state: PosterState = {
  paper: 'a4',
  preset: 'blueprint',
  levels: 12,
  title: '無題の地形',
  subtitle: 'N 43.0621° · E 141.3544° — SURVEYED BY HAND',
  showTitle: true,
  showSubtitle: true,
  showFrame: true,
  showScaleBar: true,
  showCompass: true,
  brushRadius: 9,
  brushStrength: 0.16,
};

let field: ScalarField;
let currentPolylines: ContourPolyline[] = [];
let undoStack: Float32Array[] = [];
let baseW = BASE_WIDTH;
let baseH = Math.round(BASE_WIDTH / findPaper(state.paper).ratio);

// ---------------------------------------------------------------------------
// DOM scaffold
// ---------------------------------------------------------------------------

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">◈</span>
        <div class="brand-text">
          <h1>Contour&nbsp;Draw</h1>
          <p>等高線ドローイング — 手描きの密度を地形図に変換する</p>
        </div>
      </div>
      <p class="topbar-hint">DRAW · MEASURE · FRAME</p>
    </header>

    <div class="workspace">
      <div class="stage">
        <div class="canvas-wrap" id="canvasWrap">
          <canvas id="posterCanvas"></canvas>
        </div>
      </div>

      <aside class="panel">
        <section class="panel-section">
          <h2>PALETTE — 配色</h2>
          <div class="swatch-row" id="presetRow"></div>
        </section>

        <section class="panel-section">
          <h2>PAPER — 用紙</h2>
          <div class="chip-row" id="paperRow"></div>
        </section>

        <section class="panel-section">
          <h2>BRUSH — 筆致</h2>
          <label class="slider-row">
            <span>半径 Radius</span>
            <input type="range" id="brushRadius" min="3" max="26" step="1" />
            <output id="brushRadiusOut"></output>
          </label>
          <label class="slider-row">
            <span>密度 Density</span>
            <input type="range" id="brushStrength" min="4" max="40" step="1" />
            <output id="brushStrengthOut"></output>
          </label>
        </section>

        <section class="panel-section">
          <h2>CONTOURS — 等高線</h2>
          <label class="slider-row">
            <span>本数 Levels</span>
            <input type="range" id="levels" min="5" max="26" step="1" />
            <output id="levelsOut"></output>
          </label>
          <p class="panel-note">5本ごとに計曲線（太線・標高ラベル付き）</p>
        </section>

        <section class="panel-section">
          <h2>TEXT — 文字</h2>
          <label class="text-row">
            <span>タイトル Title</span>
            <input type="text" id="titleInput" maxlength="40" />
          </label>
          <label class="text-row">
            <span>座標 / 副題 Subtitle</span>
            <input type="text" id="subtitleInput" maxlength="60" />
          </label>
        </section>

        <section class="panel-section">
          <h2>ELEMENTS — 表示要素</h2>
          <div class="toggle-grid" id="toggleGrid"></div>
        </section>

        <section class="panel-section actions-section">
          <h2>HISTORY — 履歴</h2>
          <div class="button-row">
            <button type="button" id="undoBtn" class="btn btn-ghost">↺ UNDO</button>
            <button type="button" id="clearBtn" class="btn btn-ghost btn-danger">✕ CLEAR</button>
          </div>
        </section>

        <section class="panel-section actions-section">
          <h2>EXPORT — 書き出し</h2>
          <div class="button-row">
            <button type="button" id="exportPng" class="btn btn-primary">PNG 書き出し</button>
            <button type="button" id="exportSvg" class="btn btn-primary">SVG 書き出し</button>
          </div>
        </section>
      </aside>
    </div>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#posterCanvas')!;
const ctx = canvas.getContext('2d')!;
const presetRow = document.querySelector<HTMLDivElement>('#presetRow')!;
const paperRow = document.querySelector<HTMLDivElement>('#paperRow')!;
const toggleGrid = document.querySelector<HTMLDivElement>('#toggleGrid')!;
const brushRadiusInput = document.querySelector<HTMLInputElement>('#brushRadius')!;
const brushRadiusOut = document.querySelector<HTMLOutputElement>('#brushRadiusOut')!;
const brushStrengthInput = document.querySelector<HTMLInputElement>('#brushStrength')!;
const brushStrengthOut = document.querySelector<HTMLOutputElement>('#brushStrengthOut')!;
const levelsInput = document.querySelector<HTMLInputElement>('#levels')!;
const levelsOut = document.querySelector<HTMLOutputElement>('#levelsOut')!;
const titleInput = document.querySelector<HTMLInputElement>('#titleInput')!;
const subtitleInput = document.querySelector<HTMLInputElement>('#subtitleInput')!;
const undoBtn = document.querySelector<HTMLButtonElement>('#undoBtn')!;
const clearBtn = document.querySelector<HTMLButtonElement>('#clearBtn')!;
const exportPngBtn = document.querySelector<HTMLButtonElement>('#exportPng')!;
const exportSvgBtn = document.querySelector<HTMLButtonElement>('#exportSvg')!;

// ---------------------------------------------------------------------------
// Preset / paper / toggle chips
// ---------------------------------------------------------------------------

const TOGGLES: { key: keyof PosterState; label: string }[] = [
  { key: 'showTitle', label: 'タイトル' },
  { key: 'showSubtitle', label: '副題/座標' },
  { key: 'showFrame', label: 'ネートライン枠' },
  { key: 'showScaleBar', label: 'スケールバー' },
  { key: 'showCompass', label: '方位記号' },
];

for (const preset of PRESETS) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'swatch';
  btn.dataset.presetId = preset.id;
  btn.style.setProperty('--swatch-bg', preset.bg);
  btn.style.setProperty('--swatch-line', preset.lineMajor);
  btn.innerHTML = `<span class="swatch-chip"></span><span class="swatch-label">${preset.nameJa}<br /><em>${preset.nameEn}</em></span>`;
  btn.addEventListener('click', () => {
    state.preset = preset.id as PresetId;
    syncPresetButtons();
    render();
  });
  presetRow.appendChild(btn);
}

for (const paper of PAPERS) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip';
  btn.dataset.paperId = paper.id;
  btn.textContent = paper.label;
  btn.addEventListener('click', () => {
    if (state.paper === paper.id) return;
    state.paper = paper.id as PaperId;
    syncPaperButtons();
    rebuildField();
  });
  paperRow.appendChild(btn);
}

for (const t of TOGGLES) {
  const label = document.createElement('label');
  label.className = 'toggle';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = Boolean(state[t.key]);
  input.addEventListener('change', () => {
    (state[t.key] as boolean) = input.checked;
    render();
  });
  const span = document.createElement('span');
  span.textContent = t.label;
  label.appendChild(input);
  label.appendChild(span);
  toggleGrid.appendChild(label);
}

function syncPresetButtons(): void {
  presetRow.querySelectorAll<HTMLButtonElement>('.swatch').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.presetId === state.preset);
  });
}

function syncPaperButtons(): void {
  paperRow.querySelectorAll<HTMLButtonElement>('.chip').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.paperId === state.paper);
  });
}

// ---------------------------------------------------------------------------
// Canvas sizing & field
// ---------------------------------------------------------------------------

function resizeCanvas(): void {
  const paper = findPaper(state.paper);
  baseW = BASE_WIDTH;
  baseH = Math.round(BASE_WIDTH / paper.ratio);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(baseW * dpr);
  canvas.height = Math.round(baseH * dpr);
  canvas.style.aspectRatio = `${baseW} / ${baseH}`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function rebuildField(): void {
  resizeCanvas();
  const layout = computeLayout(baseW, baseH);
  const { nx, ny } = computeGridSize(layout.drawArea);
  field = new ScalarField(nx, ny);
  undoStack = [];
  syncPaperButtons();
  recomputeAndRender();
  updateUndoState();
}

// ---------------------------------------------------------------------------
// Render pipeline
// ---------------------------------------------------------------------------

function recomputeAndRender(): void {
  currentPolylines = traceAllContours(field.data, field.nx, field.ny, state.levels);
  render();
}

function render(): void {
  const layout = computeLayout(baseW, baseH);
  const preset = findPreset(state.preset);
  renderPoster(ctx, layout, preset, state, currentPolylines);
}

let redrawScheduled = false;
function scheduleRedraw(): void {
  if (redrawScheduled) return;
  redrawScheduled = true;
  requestAnimationFrame(() => {
    redrawScheduled = false;
    if (field.consumeDirty()) {
      recomputeAndRender();
    }
  });
}

// ---------------------------------------------------------------------------
// Drawing (Pointer Events)
// ---------------------------------------------------------------------------

let isDrawing = false;
let lastGrid: { x: number; y: number } | null = null;

function clientToGrid(evt: PointerEvent): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const scaleX = baseW / rect.width;
  const scaleY = baseH / rect.height;
  const lx = (evt.clientX - rect.left) * scaleX;
  const ly = (evt.clientY - rect.top) * scaleY;
  const layout = computeLayout(baseW, baseH);
  const nx0 = (lx - layout.drawArea.x) / layout.drawArea.w;
  const ny0 = (ly - layout.drawArea.y) / layout.drawArea.h;
  return {
    x: nx0 * (field.nx - 1),
    y: ny0 * (field.ny - 1),
  };
}

function pushUndoSnapshot(): void {
  undoStack.push(field.clone());
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  updateUndoState();
}

function updateUndoState(): void {
  undoBtn.disabled = undoStack.length === 0;
}

canvas.addEventListener('pointerdown', (evt) => {
  const g = clientToGrid(evt);
  if (!g) return;
  canvas.setPointerCapture(evt.pointerId);
  isDrawing = true;
  lastGrid = g;
  pushUndoSnapshot();
  field.deposit(g.x, g.y, state.brushRadius, state.brushStrength);
  scheduleRedraw();
});

canvas.addEventListener('pointermove', (evt) => {
  if (!isDrawing) return;
  const g = clientToGrid(evt);
  if (!g || !lastGrid) return;
  field.depositLine(lastGrid.x, lastGrid.y, g.x, g.y, state.brushRadius, state.brushStrength);
  lastGrid = g;
  scheduleRedraw();
});

function endStroke(evt: PointerEvent): void {
  if (!isDrawing) return;
  isDrawing = false;
  lastGrid = null;
  if (canvas.hasPointerCapture(evt.pointerId)) canvas.releasePointerCapture(evt.pointerId);
  // Ensure the final state is committed even if the last move didn't tick a frame.
  if (field.consumeDirty()) recomputeAndRender();
}

canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('pointerleave', (evt) => {
  if (isDrawing) endStroke(evt);
});

// ---------------------------------------------------------------------------
// Controls wiring
// ---------------------------------------------------------------------------

brushRadiusInput.addEventListener('input', () => {
  state.brushRadius = Number(brushRadiusInput.value);
  brushRadiusOut.textContent = String(state.brushRadius);
});

brushStrengthInput.addEventListener('input', () => {
  state.brushStrength = Number(brushStrengthInput.value) / 100;
  brushStrengthOut.textContent = brushStrengthInput.value;
});

levelsInput.addEventListener('input', () => {
  state.levels = Number(levelsInput.value);
  levelsOut.textContent = String(state.levels);
  recomputeAndRender();
});

titleInput.addEventListener('input', () => {
  state.title = titleInput.value;
  render();
});

subtitleInput.addEventListener('input', () => {
  state.subtitle = subtitleInput.value;
  render();
});

undoBtn.addEventListener('click', () => {
  const snapshot = undoStack.pop();
  if (!snapshot) return;
  field.restore(snapshot);
  field.consumeDirty();
  recomputeAndRender();
  updateUndoState();
});

clearBtn.addEventListener('click', () => {
  pushUndoSnapshot();
  field.clear();
  field.consumeDirty();
  recomputeAndRender();
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9぀-ヿ一-龯\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'contour-draw-poster';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

exportPngBtn.addEventListener('click', () => {
  const paper = findPaper(state.paper);
  const scale = 2;
  const exportW = paper.exportW * scale;
  const exportH = paper.exportH * scale;
  const off = document.createElement('canvas');
  off.width = exportW;
  off.height = exportH;
  const octx = off.getContext('2d')!;
  const exportLayout = computeLayout(exportW, exportH);
  renderPoster(octx, exportLayout, findPreset(state.preset), state, currentPolylines);
  off.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(blob, `${slugify(state.title)}.png`);
  }, 'image/png');
});

exportSvgBtn.addEventListener('click', () => {
  const paper = findPaper(state.paper);
  const exportLayout = computeLayout(paper.exportW, paper.exportH);
  const svg = buildPosterSVG(exportLayout, findPreset(state.preset), state, currentPolylines);
  const text = serializeSVG(svg);
  const blob = new Blob([text], { type: 'image/svg+xml' });
  downloadBlob(blob, `${slugify(state.title)}.svg`);
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

brushRadiusInput.value = String(state.brushRadius);
brushRadiusOut.textContent = String(state.brushRadius);
brushStrengthInput.value = String(Math.round(state.brushStrength * 100));
brushStrengthOut.textContent = String(Math.round(state.brushStrength * 100));
levelsInput.value = String(state.levels);
levelsOut.textContent = String(state.levels);
titleInput.value = state.title;
subtitleInput.value = state.subtitle;

syncPresetButtons();
syncPaperButtons();
rebuildField();
