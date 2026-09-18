import './style.css';
import type { AppState, Duration, InputMode, ScaleName, StrokePoint } from './types';
import { computeLayout, POSTER_H, POSTER_W } from './poster/layout';
import { InkLayer } from './ink/layer';
import { renderPoster } from './poster/render';
import { renderOverlay } from './poster/overlay';
import { ScoreAudioEngine, type FrameInfo } from './audio/engine';
import { autoTitle, generateCatalogNumber } from './poster/format';
import { buildSvg } from './export/svg';
import { downloadCanvasPng, downloadSvg, slugifyFilename } from './export/download';
import { confirmDialog, toast } from './ui/dialog';

const layout = computeLayout();

const state: AppState = {
  mode: 'draw',
  penWidth: 6,
  penOpacity: 1,
  threshold: 128,
  scale: 'pentatonic',
  duration: 40,
  loop: false,
  title: autoTitle(),
  catalogNumber: generateCatalogNumber(),
  createdAt: new Date(),
  hasImage: false,
};

const inkLayer = new InkLayer(Math.round(layout.ink.w), Math.round(layout.ink.h));

// ---------------------------------------------------------------- DOM shell

const app = document.getElementById('app')!;
app.innerHTML = `
  <div class="gs-shell">
    <aside class="gs-panel">
      <div class="gs-panel__brand">
        <div class="gs-panel__brand-mark">GRAPHIC <span>SCORE</span> STUDIO</div>
        <div class="gs-panel__brand-tag">PC-FIRST</div>
      </div>

      <section class="gs-section">
        <h2 class="gs-section__title"><b>01</b> INPUT MODE</h2>
        <div class="gs-toggle-row" role="tablist">
          <button class="gs-toggle" id="mode-draw" aria-pressed="true" type="button">Hand-Draw</button>
          <button class="gs-toggle" id="mode-image" aria-pressed="false" type="button">Image</button>
        </div>
        <p class="gs-hint">Both modes ink the same plate — switching tools does not erase existing marks.</p>
      </section>

      <section class="gs-section" id="section-draw">
        <h2 class="gs-section__title"><b>02</b> PEN</h2>
        <div class="gs-field">
          <label class="gs-field__label"><span>Width</span><output id="pen-width-out">6</output></label>
          <input type="range" id="pen-width" min="1" max="40" value="6" />
        </div>
        <div class="gs-field">
          <label class="gs-field__label"><span>Opacity</span><output id="pen-opacity-out">100%</output></label>
          <input type="range" id="pen-opacity" min="10" max="100" value="100" />
        </div>
        <div class="gs-row">
          <button class="gs-btn" id="btn-undo" type="button">Undo</button>
          <button class="gs-btn" id="btn-clear" type="button">Clear Plate</button>
        </div>
      </section>

      <section class="gs-section" id="section-image" hidden>
        <h2 class="gs-section__title"><b>02</b> IMAGE</h2>
        <label class="gs-upload" id="upload-label">
          <input type="file" id="image-input" accept="image/*" />
          UPLOAD IMAGE
        </label>
        <div class="gs-field" style="margin-top:14px">
          <label class="gs-field__label"><span>Threshold</span><output id="threshold-out">128</output></label>
          <input type="range" id="threshold" min="1" max="254" value="128" disabled />
        </div>
        <button class="gs-btn gs-btn--block" id="btn-clear-image" type="button" style="margin-top:10px" disabled>Remove Image</button>
        <p class="gs-hint">Luminance below the threshold becomes ink. Grayscale + threshold are computed locally.</p>
      </section>

      <section class="gs-section">
        <h2 class="gs-section__title"><b>03</b> SCALE</h2>
        <div class="gs-toggle-row">
          <button class="gs-toggle" id="scale-penta" aria-pressed="true" type="button">Pentatonic</button>
          <button class="gs-toggle" id="scale-whole" aria-pressed="false" type="button">Whole-Tone</button>
        </div>
      </section>

      <section class="gs-section">
        <h2 class="gs-section__title"><b>04</b> DURATION</h2>
        <div class="gs-toggle-row" style="grid-template-columns:repeat(3,1fr)">
          <button class="gs-toggle" id="dur-20" aria-pressed="false" type="button">20s</button>
          <button class="gs-toggle" id="dur-40" aria-pressed="true" type="button">40s</button>
          <button class="gs-toggle" id="dur-80" aria-pressed="false" type="button">80s</button>
        </div>
      </section>

      <section class="gs-section">
        <h2 class="gs-section__title"><b>05</b> TRANSPORT</h2>
        <div class="gs-transport">
          <button class="gs-btn gs-btn--signal" id="btn-play" type="button">▶ Play</button>
          <button class="gs-btn" id="btn-pause" type="button" disabled>Pause</button>
          <button class="gs-btn" id="btn-stop" type="button" disabled>Stop</button>
        </div>
        <label class="gs-loop"><input type="checkbox" id="loop-toggle" /> Loop performance</label>
        <div class="gs-progress"><div class="gs-progress__bar" id="progress-bar"></div></div>
      </section>

      <section class="gs-section">
        <h2 class="gs-section__title"><b>06</b> TITLE</h2>
        <input class="gs-input" id="title-input" maxlength="60" />
      </section>

      <section class="gs-section">
        <h2 class="gs-section__title"><b>07</b> EXPORT</h2>
        <div class="gs-row" style="grid-auto-flow:column">
          <button class="gs-btn gs-btn--block" id="btn-export-png" type="button">PNG</button>
          <button class="gs-btn gs-btn--block" id="btn-export-svg" type="button">SVG</button>
        </div>
        <p class="gs-hint">Exports the full plate — border, crop marks and legend included.</p>
      </section>
    </aside>

    <main class="gs-stage">
      <div class="gs-poster-frame">
        <canvas id="gs-poster" width="${POSTER_W}" height="${POSTER_H}"></canvas>
        <canvas id="gs-overlay" width="${POSTER_W}" height="${POSTER_H}"></canvas>
        <div class="gs-empty-note" id="empty-note">NOTHING DRAWN YET — DRAW ON THE PLATE OR UPLOAD AN IMAGE TO BEGIN</div>
      </div>
    </main>
  </div>
`;

// ---------------------------------------------------------------- elements

const posterCanvas = document.getElementById('gs-poster') as HTMLCanvasElement;
const overlayCanvas = document.getElementById('gs-overlay') as HTMLCanvasElement;
const posterCtx = posterCanvas.getContext('2d')!;
const overlayCtx = overlayCanvas.getContext('2d')!;
const emptyNote = document.getElementById('empty-note')!;

const modeDrawBtn = document.getElementById('mode-draw') as HTMLButtonElement;
const modeImageBtn = document.getElementById('mode-image') as HTMLButtonElement;
const sectionDraw = document.getElementById('section-draw')!;
const sectionImage = document.getElementById('section-image')!;

const penWidthInput = document.getElementById('pen-width') as HTMLInputElement;
const penWidthOut = document.getElementById('pen-width-out')!;
const penOpacityInput = document.getElementById('pen-opacity') as HTMLInputElement;
const penOpacityOut = document.getElementById('pen-opacity-out')!;
const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
const clearBtn = document.getElementById('btn-clear') as HTMLButtonElement;

const imageInput = document.getElementById('image-input') as HTMLInputElement;
const thresholdInput = document.getElementById('threshold') as HTMLInputElement;
const thresholdOut = document.getElementById('threshold-out')!;
const clearImageBtn = document.getElementById('btn-clear-image') as HTMLButtonElement;

const scalePentaBtn = document.getElementById('scale-penta') as HTMLButtonElement;
const scaleWholeBtn = document.getElementById('scale-whole') as HTMLButtonElement;
const dur20Btn = document.getElementById('dur-20') as HTMLButtonElement;
const dur40Btn = document.getElementById('dur-40') as HTMLButtonElement;
const dur80Btn = document.getElementById('dur-80') as HTMLButtonElement;

const playBtn = document.getElementById('btn-play') as HTMLButtonElement;
const pauseBtn = document.getElementById('btn-pause') as HTMLButtonElement;
const stopBtn = document.getElementById('btn-stop') as HTMLButtonElement;
const loopToggle = document.getElementById('loop-toggle') as HTMLInputElement;
const progressBar = document.getElementById('progress-bar')!;

const titleInput = document.getElementById('title-input') as HTMLInputElement;
const exportPngBtn = document.getElementById('btn-export-png') as HTMLButtonElement;
const exportSvgBtn = document.getElementById('btn-export-svg') as HTMLButtonElement;

titleInput.value = state.title;

// ---------------------------------------------------------------- redraw scheduling

let redrawScheduled = false;
function scheduleRedraw(): void {
  if (redrawScheduled) return;
  redrawScheduled = true;
  requestAnimationFrame(() => {
    redrawScheduled = false;
    redrawPoster();
  });
}

function redrawPoster(): void {
  renderPoster(posterCtx, {
    title: state.title,
    catalogNumber: state.catalogNumber,
    createdAt: state.createdAt,
    durationSec: state.duration,
    scale: state.scale,
    inkLayer,
  });
  updateEmptyState();
}

function updateEmptyState(): void {
  const empty = inkLayer.isEmpty();
  emptyNote.style.display = empty ? 'block' : 'none';
  playBtn.disabled = empty || transportState !== 'stopped';
  exportPngBtn.disabled = empty;
  exportSvgBtn.disabled = empty;
}

// ---------------------------------------------------------------- mode toggle

function setMode(mode: InputMode): void {
  state.mode = mode;
  modeDrawBtn.setAttribute('aria-pressed', String(mode === 'draw'));
  modeImageBtn.setAttribute('aria-pressed', String(mode === 'image'));
  sectionDraw.hidden = mode !== 'draw';
  sectionImage.hidden = mode !== 'image';
  posterCanvas.classList.toggle('gs-poster--image-mode', mode === 'image');
}
modeDrawBtn.addEventListener('click', () => setMode('draw'));
modeImageBtn.addEventListener('click', () => setMode('image'));

// ---------------------------------------------------------------- pen controls

penWidthInput.addEventListener('input', () => {
  state.penWidth = Number(penWidthInput.value);
  penWidthOut.textContent = `${state.penWidth}px`;
});
penWidthOut.textContent = `${state.penWidth}px`;

penOpacityInput.addEventListener('input', () => {
  state.penOpacity = Number(penOpacityInput.value) / 100;
  penOpacityOut.textContent = `${penOpacityInput.value}%`;
});

undoBtn.addEventListener('click', () => {
  if (inkLayer.undo()) scheduleRedraw();
});

clearBtn.addEventListener('click', async () => {
  if (inkLayer.isEmpty()) {
    toast('プレートには何もありません');
    return;
  }
  const ok = await confirmDialog('描画をすべて消去します。よろしいですか？', 'CLEAR');
  if (!ok) return;
  inkLayer.clearAll();
  state.hasImage = false;
  clearImageBtn.disabled = true;
  thresholdInput.disabled = true;
  scheduleRedraw();
});

// ---------------------------------------------------------------- drawing input

function posterPointFromClient(clientX: number, clientY: number): { x: number; y: number } {
  const rect = posterCanvas.getBoundingClientRect();
  const scaleX = POSTER_W / rect.width;
  const scaleY = POSTER_H / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function toInkLocal(posterX: number, posterY: number): StrokePoint {
  const x = Math.max(0, Math.min(inkLayer.w, posterX - layout.ink.x));
  const y = Math.max(0, Math.min(inkLayer.h, posterY - layout.ink.y));
  return { x, y };
}

function insideInk(posterX: number, posterY: number): boolean {
  return (
    posterX >= layout.ink.x &&
    posterX <= layout.ink.x + layout.ink.w &&
    posterY >= layout.ink.y &&
    posterY <= layout.ink.y + layout.ink.h
  );
}

let drawing = false;

posterCanvas.addEventListener('pointerdown', (e) => {
  if (state.mode !== 'draw') return;
  const p = posterPointFromClient(e.clientX, e.clientY);
  if (!insideInk(p.x, p.y)) return;
  drawing = true;
  posterCanvas.setPointerCapture(e.pointerId);
  inkLayer.beginStroke(state.penWidth, state.penOpacity, toInkLocal(p.x, p.y));
  scheduleRedraw();
});

posterCanvas.addEventListener('pointermove', (e) => {
  if (!drawing || state.mode !== 'draw') return;
  const p = posterPointFromClient(e.clientX, e.clientY);
  inkLayer.extendStroke(toInkLocal(p.x, p.y));
  scheduleRedraw();
});

function endDrawing(e: PointerEvent): void {
  if (!drawing) return;
  drawing = false;
  inkLayer.endStroke();
  if (posterCanvas.hasPointerCapture(e.pointerId)) posterCanvas.releasePointerCapture(e.pointerId);
  scheduleRedraw();
}
posterCanvas.addEventListener('pointerup', endDrawing);
posterCanvas.addEventListener('pointercancel', endDrawing);
posterCanvas.addEventListener('pointerleave', (e) => {
  if (drawing && e.pressure === 0) endDrawing(e);
});

// ---------------------------------------------------------------- image upload

imageInput.addEventListener('change', async () => {
  const file = imageInput.files?.[0];
  imageInput.value = '';
  if (!file || !file.type.startsWith('image/')) return;

  if (state.hasImage) {
    const ok = await confirmDialog(
      '既存の画像を新しい画像に置き換えます（手描きの線はそのまま残ります）。よろしいですか？',
      'REPLACE',
    );
    if (!ok) return;
  }

  try {
    const bitmap = await createImageBitmap(file);
    inkLayer.setImageFromBitmap(bitmap, Number(thresholdInput.value));
    state.hasImage = true;
    thresholdInput.disabled = false;
    clearImageBtn.disabled = false;
    scheduleRedraw();
  } catch {
    toast('画像を読み込めませんでした');
  }
});

thresholdInput.addEventListener('input', () => {
  state.threshold = Number(thresholdInput.value);
  thresholdOut.textContent = String(state.threshold);
  if (state.hasImage) {
    inkLayer.applyThreshold(state.threshold);
    scheduleRedraw();
  }
});

clearImageBtn.addEventListener('click', async () => {
  if (!state.hasImage) return;
  const ok = await confirmDialog('アップロードした画像を削除します。よろしいですか？', 'REMOVE');
  if (!ok) return;
  inkLayer.clearImage();
  state.hasImage = false;
  thresholdInput.disabled = true;
  clearImageBtn.disabled = true;
  scheduleRedraw();
});

// ---------------------------------------------------------------- scale / duration

function setScale(scale: ScaleName): void {
  state.scale = scale;
  scalePentaBtn.setAttribute('aria-pressed', String(scale === 'pentatonic'));
  scaleWholeBtn.setAttribute('aria-pressed', String(scale === 'wholetone'));
  scheduleRedraw();
}
scalePentaBtn.addEventListener('click', () => setScale('pentatonic'));
scaleWholeBtn.addEventListener('click', () => setScale('wholetone'));

const durationButtons: Record<Duration, HTMLButtonElement> = { 20: dur20Btn, 40: dur40Btn, 80: dur80Btn };
function setDuration(duration: Duration): void {
  state.duration = duration;
  (Object.keys(durationButtons) as unknown as Duration[]).forEach((d) => {
    durationButtons[d].setAttribute('aria-pressed', String(d === duration));
  });
  scheduleRedraw();
}
dur20Btn.addEventListener('click', () => setDuration(20));
dur40Btn.addEventListener('click', () => setDuration(40));
dur80Btn.addEventListener('click', () => setDuration(80));

function setTransportControlsEnabled(enabled: boolean): void {
  scalePentaBtn.disabled = !enabled;
  scaleWholeBtn.disabled = !enabled;
  dur20Btn.disabled = !enabled;
  dur40Btn.disabled = !enabled;
  dur80Btn.disabled = !enabled;
}

// ---------------------------------------------------------------- title

titleInput.addEventListener('input', () => {
  state.title = titleInput.value.trim() || 'UNTITLED';
  scheduleRedraw();
});

// ---------------------------------------------------------------- transport / audio

type TransportState = 'stopped' | 'playing' | 'paused';
let transportState: TransportState = 'stopped';
const engine = new ScoreAudioEngine();

function applyTransportButtons(): void {
  playBtn.disabled = transportState === 'playing' || inkLayer.isEmpty();
  playBtn.textContent = transportState === 'paused' ? '▶ Resume' : '▶ Play';
  pauseBtn.disabled = transportState !== 'playing';
  stopBtn.disabled = transportState === 'stopped';
  setTransportControlsEnabled(transportState === 'stopped');
}

function onFrame(info: FrameInfo): void {
  renderOverlay(overlayCtx, layout, info);
  progressBar.style.width = `${(info.elapsedNorm * 100).toFixed(2)}%`;
}

function onEnd(): void {
  transportState = 'stopped';
  applyTransportButtons();
  renderOverlay(overlayCtx, layout, null);
  progressBar.style.width = '0%';
}

playBtn.addEventListener('click', () => {
  if (inkLayer.isEmpty()) {
    toast('何も描かれていません');
    return;
  }
  if (transportState === 'paused') {
    engine.resume();
    transportState = 'playing';
    applyTransportButtons();
    return;
  }
  engine.start({
    inkLayer,
    scale: state.scale,
    durationSec: state.duration,
    loop: state.loop,
    onFrame,
    onEnd,
  });
  transportState = 'playing';
  applyTransportButtons();
});

pauseBtn.addEventListener('click', () => {
  if (transportState !== 'playing') return;
  engine.pause();
  transportState = 'paused';
  applyTransportButtons();
});

stopBtn.addEventListener('click', () => {
  engine.stop();
  transportState = 'stopped';
  applyTransportButtons();
  renderOverlay(overlayCtx, layout, null);
  progressBar.style.width = '0%';
});

loopToggle.addEventListener('change', () => {
  state.loop = loopToggle.checked;
  engine.setLoop(state.loop);
});

// ---------------------------------------------------------------- export

exportPngBtn.addEventListener('click', async () => {
  if (inkLayer.isEmpty()) {
    toast('何も描かれていません');
    return;
  }
  const EXPORT_SCALE = 2;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = POSTER_W * EXPORT_SCALE;
  exportCanvas.height = POSTER_H * EXPORT_SCALE;
  const ectx = exportCanvas.getContext('2d')!;
  ectx.scale(EXPORT_SCALE, EXPORT_SCALE);
  renderPoster(ectx, {
    title: state.title,
    catalogNumber: state.catalogNumber,
    createdAt: state.createdAt,
    durationSec: state.duration,
    scale: state.scale,
    inkLayer,
  });
  await downloadCanvasPng(exportCanvas, `${slugifyFilename(state.title)}-${state.catalogNumber}.png`);
  toast('PNGを書き出しました');
});

exportSvgBtn.addEventListener('click', () => {
  if (inkLayer.isEmpty()) {
    toast('何も描かれていません');
    return;
  }
  const svg = buildSvg({
    title: state.title,
    catalogNumber: state.catalogNumber,
    createdAt: state.createdAt,
    durationSec: state.duration,
    scale: state.scale,
    inkLayer,
  });
  downloadSvg(svg, `${slugifyFilename(state.title)}-${state.catalogNumber}.svg`);
  toast('SVGを書き出しました');
});

// ---------------------------------------------------------------- init

setMode('draw');
applyTransportButtons();
redrawPoster();
renderOverlay(overlayCtx, layout, null);
