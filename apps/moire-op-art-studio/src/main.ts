import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/900.css';
import './style.css';

import { CANVAS_SIZE, cloneState, type BlendMode, type StudioState } from './types';
import { defaultLayer, defaultState, randomizeState } from './state';
import { renderStudio } from './render/canvasRenderer';
import { buildStudioSVG } from './render/svgExporter';
import { exportPosterPNG } from './render/posterExport';
import { renderLayerPanel, syncRotationDisplays } from './ui/layerPanel';
import { PRESETS } from './presets';
import { showToast } from './toast';

const canvas = document.getElementById('artCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D context unavailable');

const layerListEl = document.getElementById('layerList') as HTMLElement;
const addLayerBtn = document.getElementById('addLayerBtn') as HTMLButtonElement;
const removeLayerBtn = document.getElementById('removeLayerBtn') as HTMLButtonElement;
const presetGridEl = document.getElementById('presetGrid') as HTMLElement;
const globalBlendSelect = document.getElementById('globalBlendSelect') as HTMLSelectElement;
const randomizeBtn = document.getElementById('randomizeBtn') as HTMLButtonElement;
const undoBtn = document.getElementById('undoBtn') as HTMLButtonElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
const exportScaleSelect = document.getElementById('exportScale') as HTMLSelectElement;
const exportPngBtn = document.getElementById('exportPngBtn') as HTMLButtonElement;
const exportSvgBtn = document.getElementById('exportSvgBtn') as HTMLButtonElement;
const kineticToggleBtn = document.getElementById('kineticToggleBtn') as HTMLButtonElement;
const kineticGlyph = kineticToggleBtn.querySelector('.btn__glyph') as HTMLElement;
const kineticLabel = kineticToggleBtn.querySelector('.btn__label') as HTMLElement;
const kineticSpeedInput = document.getElementById('kineticSpeed') as HTMLInputElement;
const kineticSpeedValueEl = document.getElementById('kineticSpeedValue') as HTMLElement;
const statusText = document.getElementById('statusText') as HTMLElement;
const statusLed = document.getElementById('statusLed') as HTMLElement;
const loadingOverlay = document.getElementById('loadingOverlay') as HTMLElement;

let state: StudioState = defaultState();
let selectedIndex = state.layers.length - 1;
let undoSnapshot: StudioState | null = null;
const kineticDirections = new Map<string, number>();
let lastFrameTime = 0;
let busy = false;

const stageFrame = document.querySelector('.stage__frame') as HTMLElement;

// Render the live preview at device pixel ratio for a crisp canvas on
// high-DPI screens, while all drawing logic stays in CANVAS_SIZE logical units.
function setupCanvasResolution(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = CANVAS_SIZE * dpr;
  canvas.height = CANVAS_SIZE * dpr;
  ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// The frame is a flexible rectangle; the canvas itself must always stay
// square. Measuring the frame directly (rather than relying on CSS
// aspect-ratio interacting with height:100%) keeps this correct across
// browsers and through sidebar/window resizes.
function fitCanvasToFrame(): void {
  const size = Math.max(0, Math.min(stageFrame.clientWidth, stageFrame.clientHeight));
  if (size === 0) return;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
}

function renderCanvas(): void {
  renderStudio(ctx!, state, CANVAS_SIZE);
}

function updateAddRemoveButtons(): void {
  const count = state.layers.length;
  addLayerBtn.disabled = count >= 3;
  addLayerBtn.title = count >= 3 ? '最大3枚までです' : 'レイヤーを追加';
  removeLayerBtn.disabled = count <= 2;
  removeLayerBtn.title = count <= 2 ? '最低2枚必要です' : 'レイヤーを削除';
}

function updateUndoButton(): void {
  undoBtn.disabled = !undoSnapshot;
}

function renderPanel(): void {
  renderLayerPanel(layerListEl, state, selectedIndex, {
    onParamChange: renderCanvas,
    onStructuralChange: () => {
      renderPanel();
      renderCanvas();
    },
    onSelect: (index) => {
      selectedIndex = index;
      renderPanel();
    },
  });
}

function refreshAll(): void {
  renderPanel();
  renderCanvas();
  updateAddRemoveButtons();
  updateUndoButton();
  globalBlendSelect.value = state.globalBlendMode;
  kineticSpeedInput.value = String(state.kineticSpeed);
  kineticSpeedValueEl.textContent = `${state.kineticSpeed}°/s`;
  updateKineticButton();
}

function updateKineticButton(): void {
  kineticToggleBtn.classList.toggle('is-active', state.kineticPlaying);
  kineticToggleBtn.setAttribute('aria-pressed', String(state.kineticPlaying));
  kineticGlyph.innerHTML = state.kineticPlaying ? '&#10074;&#10074;' : '&#9654;';
  kineticLabel.textContent = state.kineticPlaying ? 'PAUSE' : 'KINETIC MODE';
  if (!busy) {
    statusText.textContent = state.kineticPlaying ? 'LIVE' : 'READY';
  }
  statusLed.classList.toggle('is-live', state.kineticPlaying);
}

function setBusy(next: boolean, label?: string): void {
  busy = next;
  loadingOverlay.hidden = !next;
  const span = loadingOverlay.querySelector('span');
  if (span && label) span.textContent = label;
  exportPngBtn.disabled = next;
  exportSvgBtn.disabled = next;
  statusText.textContent = next ? 'BUSY' : state.kineticPlaying ? 'LIVE' : 'READY';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- preset grid -----------------------------------------------------------
PRESETS.forEach((preset) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'preset-card';
  btn.innerHTML = `<span class="preset-card__name">${preset.name}</span><span class="preset-card__desc">${preset.description}</span>`;
  btn.addEventListener('click', () => {
    state = preset.build();
    selectedIndex = state.layers.length - 1;
    refreshAll();
    showToast(`プリセット適用: ${preset.name}`);
  });
  presetGridEl.appendChild(btn);
});

// --- layer add/remove --------------------------------------------------------
addLayerBtn.addEventListener('click', () => {
  if (state.layers.length >= 3) return;
  const rotation = (state.layers.length * 17) % 180;
  state.layers.push(defaultLayer('lines', rotation));
  selectedIndex = state.layers.length - 1;
  refreshAll();
});

removeLayerBtn.addEventListener('click', () => {
  if (state.layers.length <= 2) return;
  undoSnapshot = cloneState(state);
  const idx = Math.min(selectedIndex, state.layers.length - 1);
  state.layers.splice(idx, 1);
  selectedIndex = Math.max(0, idx - 1);
  refreshAll();
});

// --- global blend ------------------------------------------------------------
globalBlendSelect.addEventListener('change', () => {
  state.globalBlendMode = globalBlendSelect.value as BlendMode;
  renderCanvas();
});

// --- actions: randomize / undo / reset ---------------------------------------
randomizeBtn.addEventListener('click', () => {
  undoSnapshot = cloneState(state);
  state = randomizeState(state.layers.length);
  selectedIndex = state.layers.length - 1;
  refreshAll();
});

undoBtn.addEventListener('click', () => {
  if (!undoSnapshot) return;
  state = undoSnapshot;
  undoSnapshot = null;
  selectedIndex = Math.min(selectedIndex, state.layers.length - 1);
  refreshAll();
});

resetBtn.addEventListener('click', () => {
  undoSnapshot = cloneState(state);
  state = defaultState();
  selectedIndex = state.layers.length - 1;
  refreshAll();
});

// --- kinetic mode --------------------------------------------------------------
kineticToggleBtn.addEventListener('click', () => {
  state.kineticPlaying = !state.kineticPlaying;
  updateKineticButton();
});

kineticSpeedInput.addEventListener('input', () => {
  state.kineticSpeed = Number(kineticSpeedInput.value);
  kineticSpeedValueEl.textContent = `${state.kineticSpeed}°/s`;
});

function tick(timestamp: number): void {
  const dt = lastFrameTime ? (timestamp - lastFrameTime) / 1000 : 0;
  lastFrameTime = timestamp;

  if (state.kineticPlaying) {
    let moved = false;
    for (const layer of state.layers) {
      if (!layer.kinetic) continue;
      moved = true;
      let dir = kineticDirections.get(layer.id) ?? 1;
      let next = layer.rotation + dir * state.kineticSpeed * dt;
      if (next >= 180) {
        next = 180;
        dir = -1;
      } else if (next <= 0) {
        next = 0;
        dir = 1;
      }
      kineticDirections.set(layer.id, dir);
      layer.rotation = next;
    }
    if (moved) {
      renderCanvas();
      syncRotationDisplays(layerListEl, state.layers);
    }
  }
  requestAnimationFrame(tick);
}

// --- export --------------------------------------------------------------------
exportPngBtn.addEventListener('click', async () => {
  const multiplier = Number(exportScaleSelect.value);
  setBusy(true, 'RENDERING POSTER…');
  try {
    await new Promise((resolve) => setTimeout(resolve, 30));
    const blob = await exportPosterPNG(state, multiplier);
    downloadBlob(blob, `moire-study-${Date.now()}.png`);
    showToast('PNGポスターを書き出しました');
  } catch (err) {
    console.error(err);
    showToast('PNG書き出しに失敗しました', 'error');
  } finally {
    setBusy(false);
  }
});

exportSvgBtn.addEventListener('click', async () => {
  setBusy(true, 'BUILDING VECTOR…');
  try {
    await new Promise((resolve) => setTimeout(resolve, 20));
    const svg = buildStudioSVG(state, CANVAS_SIZE);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    downloadBlob(blob, `moire-study-${Date.now()}.svg`);
    showToast('SVGを書き出しました');
  } catch (err) {
    console.error(err);
    showToast('SVG書き出しに失敗しました', 'error');
  } finally {
    setBusy(false);
  }
});

// --- boot ------------------------------------------------------------------------
setupCanvasResolution();
fitCanvasToFrame();
window.addEventListener('resize', () => {
  fitCanvasToFrame();
});
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => fitCanvasToFrame()).observe(stageFrame);
}
refreshAll();
requestAnimationFrame(tick);
