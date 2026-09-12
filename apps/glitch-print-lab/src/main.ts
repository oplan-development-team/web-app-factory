import './style.css';
import { runGlitchPipeline, type LayerState } from './pipeline.ts';
import { PRESETS, DEFAULT_LAYERS, type Preset } from './presets.ts';
import { buildLayerStack, syncLayerUI } from './ui.ts';
import { drawSampleImage } from './sampleImage.ts';
import { randomSeed, seedToHex } from './rng.ts';

// ---------------------------------------------------------------- DOM refs
const previewCanvas = document.getElementById('previewCanvas') as HTMLCanvasElement;
const dropzone = document.getElementById('dropzone') as HTMLDivElement;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const useSampleBtn = document.getElementById('useSampleBtn') as HTMLButtonElement;
const loadImageBtn = document.getElementById('loadImageBtn') as HTMLButtonElement;
const canvasFrame = document.getElementById('canvasFrame') as HTMLDivElement;

const statusIndicator = document.getElementById('statusIndicator') as HTMLDivElement;
const statusText = document.getElementById('statusText') as HTMLSpanElement;
const errorBanner = document.getElementById('errorBanner') as HTMLDivElement;
const errorTitle = document.getElementById('errorTitle') as HTMLParagraphElement;
const errorDesc = document.getElementById('errorDesc') as HTMLParagraphElement;
const dimsReadout = document.getElementById('dimsReadout') as HTMLSpanElement;
const fileNameReadout = document.getElementById('fileNameReadout') as HTMLSpanElement;
const engineReadout = document.getElementById('engineReadout') as HTMLSpanElement;

const seedValueEl = document.getElementById('seedValue') as HTMLSpanElement;
const rerollBtn = document.getElementById('rerollBtn') as HTMLButtonElement;
const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement;
const exportLabel = exportBtn.querySelector('.btn__label') as HTMLSpanElement;
const compareToggle = document.getElementById('compareToggle') as HTMLButtonElement;
const compareLabel = document.getElementById('compareLabel') as HTMLSpanElement;
const layerStackContainer = document.getElementById('layerStack') as HTMLDivElement;
const mainHeading = document.getElementById('mainHeading') as HTMLHeadingElement;

// ---------------------------------------------------------------- state
const layers: LayerState = structuredClone(DEFAULT_LAYERS);
let seed = randomSeed();
let sourceCanvas: HTMLCanvasElement = document.createElement('canvas');
let previewSourceCanvas: HTMLCanvasElement = document.createElement('canvas');
let lastGoodPreviewCanvas: HTMLCanvasElement | null = null;
let compareMode: 'before' | 'after' = 'after';
let hasBlockingError = false;
let isExporting = false;
let generation = 0;
let debounceTimer: number | undefined;

const refs = buildLayerStack(layerStackContainer, layers, scheduleRun);

// ---------------------------------------------------------------- helpers
function setStatus(state: 'ready' | 'busy' | 'error', text: string): void {
  statusIndicator.dataset.state = state;
  statusText.textContent = text;
}

function updateSeedDisplay(): void {
  seedValueEl.textContent = seedToHex(seed);
}

function showBanner(title: string, desc: string, blockExport: boolean): void {
  errorTitle.textContent = title;
  errorDesc.textContent = desc;
  errorBanner.hidden = false;
  if (blockExport) {
    hasBlockingError = true;
    exportBtn.disabled = true;
    setStatus('error', 'ERROR');
    engineReadout.textContent = 'ENGINE: HALTED';
  }
}

function hideBanner(): void {
  errorBanner.hidden = true;
}

function clearBlockingError(): void {
  hasBlockingError = false;
  exportBtn.disabled = false;
  hideBanner();
}

let toastEl: HTMLDivElement | null = null;
let toastTimer: number | undefined;
function showToast(message: string): void {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  const el = toastEl;
  requestAnimationFrame(() => el.classList.add('is-visible'));
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('is-visible'), 2600);
}

function downscale(source: CanvasImageSource, w: number, h: number, maxEdge = 800): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function makeFullResCanvas(source: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

function renderCurrentCompareView(): void {
  const canvas = compareMode === 'before' ? previewSourceCanvas : lastGoodPreviewCanvas;
  if (!canvas) return;
  previewCanvas.width = canvas.width;
  previewCanvas.height = canvas.height;
  const ctx = previewCanvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(canvas, 0, 0);
}

// ---------------------------------------------------------------- pipeline
/**
 * `retryOnFail` reseeds and retries a failed run up to N times before
 * surfacing the error. This is used ONLY for onboarding-style triggers
 * (initial load, swapping the source image, clicking a preset) so a
 * first-time visitor doesn't have a real chance of landing on a dead error
 * screen before they've touched anything. REROLL and direct slider/toggle
 * changes intentionally run with retryOnFail=0 (the default) — a single
 * real attempt that can genuinely fail is the whole point of exposing raw
 * byte corruption, and hiding that behind silent retries there would
 * misrepresent what the tool is actually doing.
 */
async function runPreviewPipeline(retryOnFail = 0): Promise<void> {
  const myGen = ++generation;
  setStatus('busy', 'RE-ENCODING...');
  engineReadout.textContent = 'ENGINE: RENDERING';

  let result = await runGlitchPipeline(previewSourceCanvas, layers, seed);
  let attemptsLeft = retryOnFail;
  while (result.error && attemptsLeft > 0 && myGen === generation) {
    seed = randomSeed();
    updateSeedDisplay();
    result = await runGlitchPipeline(previewSourceCanvas, layers, seed);
    attemptsLeft--;
  }
  if (myGen !== generation) return; // a newer run superseded this one

  if (result.error) {
    showBanner('RE-DECODE FAILURE', result.error, true);
    return; // deliberately leave previewCanvas / lastGoodPreviewCanvas untouched
  }

  clearBlockingError();
  lastGoodPreviewCanvas = result.canvas;
  setStatus('ready', 'READY');
  engineReadout.textContent = 'ENGINE: IDLE';
  renderCurrentCompareView();
}

function scheduleRun(): void {
  if (debounceTimer) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    void runPreviewPipeline();
  }, 220);
}

function runImmediate(retryOnFail = 0): void {
  if (debounceTimer) {
    window.clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
  void runPreviewPipeline(retryOnFail);
}

// ---------------------------------------------------------------- sources
function setSource(img: CanvasImageSource, width: number, height: number, label: string): void {
  sourceCanvas = makeFullResCanvas(img, width, height);
  previewSourceCanvas = downscale(img, width, height, 800);
  fileNameReadout.textContent = label;
  dimsReadout.textContent = `${width} × ${height} PX`;
  dropzone.hidden = true;
  runImmediate(8);
}

function loadSample(): void {
  const sampleCanvas = document.createElement('canvas');
  drawSampleImage(sampleCanvas, 1600, 1200);
  setSource(sampleCanvas, sampleCanvas.width, sampleCanvas.height, 'SAMPLE TARGET 001 (GENERATED)');
}

async function handleFile(file: File): Promise<void> {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showBanner('UNSUPPORTED FORMAT', `"${file.type || '不明な形式'}" は読み込めません。JPG / PNG / WEBP を選択してください。`, false);
    return;
  }
  try {
    const bitmap = await createImageBitmap(file);
    setSource(bitmap, bitmap.width, bitmap.height, file.name.toUpperCase());
    bitmap.close();
  } catch {
    showBanner('SOURCE LOAD FAILURE', 'ファイルの読み込みに失敗しました。破損しているか非対応の形式の可能性があります。', false);
  }
}

// ---------------------------------------------------------------- wiring
dropzone.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).id === 'useSampleBtn') return;
  fileInput.click();
});
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});
useSampleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  loadSample();
});
loadImageBtn.addEventListener('click', () => {
  dropzone.hidden = false;
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void handleFile(file);
  fileInput.value = '';
});

['dragover', 'dragenter'].forEach((evt) => {
  canvasFrame.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.hidden = false;
    dropzone.classList.add('is-dragover');
  });
});
['dragleave', 'dragend'].forEach((evt) => {
  dropzone.addEventListener(evt, () => dropzone.classList.remove('is-dragover'));
});
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('is-dragover');
  const file = e.dataTransfer?.files?.[0];
  if (file) void handleFile(file);
});
canvasFrame.addEventListener('dragover', (e) => e.preventDefault());

rerollBtn.addEventListener('click', () => {
  seed = randomSeed();
  updateSeedDisplay();
  runImmediate();
});

compareToggle.addEventListener('click', () => {
  compareMode = compareMode === 'after' ? 'before' : 'after';
  compareLabel.textContent = compareMode.toUpperCase();
  compareToggle.setAttribute('aria-pressed', String(compareMode === 'after'));
  renderCurrentCompareView();
});

document.querySelectorAll<HTMLButtonElement>('.preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.preset;
    const preset = PRESETS.find((p: Preset) => p.id === id);
    if (!preset) return;
    layers.jpegCorrupt = { ...preset.layers.jpegCorrupt };
    layers.rowShift = { ...preset.layers.rowShift };
    layers.channelShift = { ...preset.layers.channelShift };
    layers.scanline = { ...preset.layers.scanline };
    seed = randomSeed();
    updateSeedDisplay();
    syncLayerUI(refs, layers);
    runImmediate(8);
  });
});

exportBtn.addEventListener('click', () => {
  void doExport();
});

async function doExport(): Promise<void> {
  if (isExporting || hasBlockingError) return;
  isExporting = true;
  exportBtn.disabled = true;
  exportLabel.textContent = 'RENDERING...';
  setStatus('busy', 'EXPORTING FULL-RES...');
  engineReadout.textContent = 'ENGINE: EXPORT RENDER';

  const blockSizeScale =
    (sourceCanvas.width * sourceCanvas.height) / (previewSourceCanvas.width * previewSourceCanvas.height);

  // The full-resolution JPEG re-encode is a different byte stream than the
  // preview's, so even parameters that just rendered fine on screen carry
  // some residual chance of a real re-decode failure at export time. A
  // small number of local fallback attempts (each with a nearby seed) keep
  // "click export, get a file" reliable without touching the seed the user
  // sees on screen — if every attempt genuinely fails, that failure is
  // still surfaced honestly rather than papered over indefinitely.
  let result = await runGlitchPipeline(sourceCanvas, layers, seed, blockSizeScale);
  for (let fallback = 1; result.error && fallback <= 5; fallback++) {
    result = await runGlitchPipeline(sourceCanvas, layers, seed + fallback, blockSizeScale);
  }

  if (result.error) {
    showBanner('EXPORT RE-DECODE FAILURE', result.error, true);
    exportLabel.textContent = 'EXPORT PNG';
    isExporting = false;
    return;
  }

  result.canvas.toBlob((blob) => {
    isExporting = false;
    exportLabel.textContent = 'EXPORT PNG';
    if (!blob) {
      showBanner('EXPORT FAILURE', 'PNGエンコードに失敗しました。もう一度お試しください。', false);
      exportBtn.disabled = false;
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `glitch-print-lab_${stamp}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    exportBtn.disabled = false;
    setStatus('ready', 'READY');
    engineReadout.textContent = 'ENGINE: IDLE';
    showToast('EXPORT COMPLETE — DOWNLOAD STARTED');
  }, 'image/png');
}

// ---------------------------------------------------------------- glitch heading jitter
function scheduleHeadingGlitch(): void {
  const delay = 550 + Math.random() * 900;
  window.setTimeout(() => {
    mainHeading.classList.add('is-glitching');
    window.setTimeout(() => mainHeading.classList.remove('is-glitching'), 150);
    scheduleHeadingGlitch();
  }, delay);
}

// ---------------------------------------------------------------- init
updateSeedDisplay();
scheduleHeadingGlitch();
loadSample();
