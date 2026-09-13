import './style.css';
import { SandSimulation } from './simulation';
import { buildTextMask } from './mask';
import { COLOR_PRESETS, FONT_PRESETS, type ColorPresetId, type FontPresetId } from './colors';
import { renderPosterToCanvas } from './export';
import { toRoman } from './roman';

// ---------------------------------------------------------------------
// Grid resolution. Starts at the "smooth on a typical laptop" target and
// steps down once if a sustained low frame rate is detected (mobile /
// low-end fallback).
// ---------------------------------------------------------------------
const BASE_GRID_W = 200;
const BASE_GRID_H = 150;
const FALLBACK_GRID_W = 130;
const FALLBACK_GRID_H = 98;

const MAX_TILT_DEG = 30;
const POUR_DURATION_FRAMES = 260;

let gridW = BASE_GRID_W;
let gridH = BASE_GRID_H;
let sim = new SandSimulation(gridW, gridH);
let simImageData = new ImageData(new Uint8ClampedArray(sim.pixels.buffer), gridW, gridH);

const gridCanvas = document.createElement('canvas');
gridCanvas.width = gridW;
gridCanvas.height = gridH;
const gridCtx = gridCanvas.getContext('2d')!;

const canvas = document.getElementById('sandCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const stageEl = document.querySelector<HTMLElement>('.poster__stage')!;
const placeholderEl = document.getElementById('placeholder')!;
const textInput = document.getElementById('textInput') as HTMLInputElement;
const pourBtn = document.getElementById('pourBtn') as HTMLButtonElement;
const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement;
const statusEl = document.getElementById('statusMsg')!;
const phraseLabel = document.getElementById('phraseLabel')!;
const stampNoEl = document.getElementById('stampNo')!;
const stampEstEl = document.getElementById('stampEst')!;
const colorSwatchesEl = document.getElementById('colorSwatches')!;
const fontButtonsEl = document.getElementById('fontButtons')!;

// ---------------------------------------------------------------------
// Selection state. Colour / font / text picked in the panel are only
// "pending" until the next Pour — this mirrors the one rule for all three
// so the UI doesn't need three different explanations.
// ---------------------------------------------------------------------
let pendingColor: ColorPresetId = 'amber';
let pendingFont: FontPresetId = 'serif';
let appliedFont: FontPresetId = 'serif';
let hasEverPoured = false;
let pourCount = 0;

let gravityAngleDeg = 0;
let dragging = false;
let dragStartX = 0;
let dragStartAngle = 0;

let pourActive = false;
let pourSpawned = 0;
let pourTotal = 0;
let statusClearTimer: number | undefined;

// --- FPS monitor for the low-end fallback ------------------------------
let fpsSamples: number[] = [];
let lastFrameTime = performance.now();
let downgraded = false;

function setStatus(message: string, isError = false, autoClearMs?: number): void {
  statusEl.textContent = message;
  statusEl.classList.toggle('is-error', isError);
  if (statusClearTimer) window.clearTimeout(statusClearTimer);
  if (autoClearMs) {
    statusClearTimer = window.setTimeout(() => {
      statusEl.textContent = '';
      statusEl.classList.remove('is-error');
    }, autoClearMs);
  }
}

function resizeDisplayCanvas(): void {
  const rect = stageEl.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

const resizeObserver = new ResizeObserver(() => resizeDisplayCanvas());
resizeObserver.observe(stageEl);
resizeDisplayCanvas();

function rebuildGrid(w: number, h: number): void {
  gridW = w;
  gridH = h;
  sim = new SandSimulation(gridW, gridH);
  simImageData = new ImageData(new Uint8ClampedArray(sim.pixels.buffer), gridW, gridH);
  gridCanvas.width = gridW;
  gridCanvas.height = gridH;
}

function downgradeResolution(): void {
  if (downgraded) return;
  downgraded = true;
  rebuildGrid(FALLBACK_GRID_W, FALLBACK_GRID_H);
  pourActive = false;
  exportBtn.disabled = true;
  placeholderEl.classList.remove('is-hidden');
  setStatus(
    'この端末に合わせて解像度を調整しました。もう一度「注ぐ」を押してください。',
    false,
  );
}

// ---------------------------------------------------------------------
// Panel wiring
// ---------------------------------------------------------------------
colorSwatchesEl.querySelectorAll<HTMLButtonElement>('.swatch').forEach((btn) => {
  btn.addEventListener('click', () => {
    pendingColor = btn.dataset.color as ColorPresetId;
    colorSwatchesEl.querySelectorAll('.swatch').forEach((el) => {
      el.classList.toggle('is-active', el === btn);
      el.setAttribute('aria-pressed', String(el === btn));
    });
  });
});

fontButtonsEl.querySelectorAll<HTMLButtonElement>('.type-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    pendingFont = btn.dataset.font as FontPresetId;
    fontButtonsEl.querySelectorAll('.type-btn').forEach((el) => {
      el.classList.toggle('is-active', el === btn);
      el.setAttribute('aria-pressed', String(el === btn));
    });
  });
});

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    void startPour();
  }
});

pourBtn.addEventListener('click', () => void startPour());
exportBtn.addEventListener('click', () => void exportPoster());

async function startPour(): Promise<void> {
  const text = textInput.value.trim();
  if (!text) {
    setStatus('1〜15文字ほどの単語・フレーズを入力してください。', true);
    textInput.focus();
    return;
  }
  if (text.length > 15) {
    setStatus('15文字以内でお試しください。', true);
    return;
  }

  pourBtn.disabled = true;
  setStatus('書体を読み込み中…');

  const preset = FONT_PRESETS[pendingFont];
  try {
    await document.fonts.load(`700 100px ${preset.family}`);
    await document.fonts.ready;
  } catch {
    // Font loading failures are non-fatal — fall back to whatever the
    // browser substitutes and continue.
  }

  setStatus('文字型を生成しています…');

  let maskResult;
  try {
    maskResult = await buildTextMask(text, preset.family, gridW, gridH);
  } catch (err) {
    const reason =
      err instanceof Error && err.message === 'no-glyph'
        ? '文字を認識できませんでした。別の文字でお試しください。'
        : '文字型の生成に失敗しました。文字数を減らしてお試しください。';
    setStatus(reason, true);
    pourBtn.disabled = false;
    return;
  }

  sim.setMask(maskResult.mask);
  sim.clear();
  appliedFont = pendingFont;
  gravityAngleDeg = 0;

  pourCount++;
  hasEverPoured = true;
  phraseLabel.textContent = text;
  phraseLabel.dataset.font = appliedFont === 'slab' ? 'slab' : '';
  stampNoEl.textContent = `No. ${String(pourCount).padStart(3, '0')}`;
  const year = new Date().getFullYear();
  stampEstEl.textContent = `EST. ${toRoman(year)}`;
  placeholderEl.classList.add('is-hidden');
  exportBtn.disabled = true;

  pourTotal = Math.min(Math.round(maskResult.insideCount * 1.35), Math.floor(gridW * gridH * 0.92));
  pourSpawned = 0;
  pourActive = true;

  setStatus('注いでいます…');
  pourBtn.disabled = false;
}

async function exportPoster(): Promise<void> {
  if (sim.countOccupied() === 0) return;
  exportBtn.disabled = true;
  setStatus('書き出し中…');
  try {
    const styles = getComputedStyle(document.documentElement);
    const fontFamily = FONT_PRESETS[appliedFont].family;
    const poster = renderPosterToCanvas({
      sandSource: gridCanvas,
      sandAspect: gridW / gridH,
      phrase: phraseLabel.textContent || '',
      phraseFont: fontFamily,
      plateNo: stampNoEl.textContent || 'No. 000',
      estText: stampEstEl.textContent || '',
      ink: styles.getPropertyValue('--ink').trim() || '#2d2418',
      inkSoft: styles.getPropertyValue('--ink-soft').trim() || '#6c5c47',
      paper: styles.getPropertyValue('--paper').trim() || '#f3ead7',
      paperDeep: styles.getPropertyValue('--paper-deep').trim() || '#e9dcc0',
    });
    const blob: Blob | null = await new Promise((resolve) => poster.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('blob-failed');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = (phraseLabel.textContent || 'sand')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'sand';
    a.href = url;
    a.download = `sand-typography-${slug}-${stampNoEl.textContent?.replace(/\D/g, '') || '000'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setStatus('PNGを書き出しました。', false, 3000);
  } catch {
    setStatus('書き出しに失敗しました。もう一度お試しください。', true);
  } finally {
    exportBtn.disabled = sim.countOccupied() === 0;
  }
}

// ---------------------------------------------------------------------
// Drag-to-tilt (pointer events unify mouse + touch)
// ---------------------------------------------------------------------
stageEl.addEventListener('pointerdown', (e) => {
  dragging = true;
  dragStartX = e.clientX;
  dragStartAngle = gravityAngleDeg;
  stageEl.classList.add('is-dragging');
  stageEl.setPointerCapture(e.pointerId);
});

stageEl.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const rect = stageEl.getBoundingClientRect();
  const deltaX = e.clientX - dragStartX;
  const sensitivity = MAX_TILT_DEG / (rect.width * 0.55);
  const angle = dragStartAngle + deltaX * sensitivity;
  gravityAngleDeg = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, angle));
});

function endDrag(e: PointerEvent): void {
  if (!dragging) return;
  dragging = false;
  stageEl.classList.remove('is-dragging');
  try {
    stageEl.releasePointerCapture(e.pointerId);
  } catch {
    /* no-op */
  }
}

stageEl.addEventListener('pointerup', endDrag);
stageEl.addEventListener('pointercancel', endDrag);

// ---------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------
let rand = mulberry32(20260913);
function mulberry32(a: number): () => number {
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tick(now: number): void {
  const dt = now - lastFrameTime;
  lastFrameTime = now;
  if (dt > 0) {
    fpsSamples.push(1000 / dt);
    if (fpsSamples.length > 90) {
      const avg = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
      if (avg < 30 && !downgraded) {
        downgradeResolution();
      }
      fpsSamples = [];
    }
  }

  // Ease gravity back to vertical once the drag is released.
  if (!dragging && gravityAngleDeg !== 0) {
    gravityAngleDeg *= 0.9;
    if (Math.abs(gravityAngleDeg) < 0.05) gravityAngleDeg = 0;
  }

  if (pourActive) {
    const remaining = pourTotal - pourSpawned;
    const framesLeft = Math.max(1, POUR_DURATION_FRAMES - Math.floor((pourSpawned / pourTotal) * POUR_DURATION_FRAMES));
    const perFrame = Math.max(1, Math.ceil(remaining / Math.max(1, framesLeft)));
    const count = Math.min(remaining, perFrame);
    sim.spawnRow(count, COLOR_PRESETS[pendingColor], rand);
    pourSpawned += count;
    if (pourSpawned >= pourTotal) {
      pourActive = false;
      const landed = sim.countOccupied();
      if (landed > 0) {
        exportBtn.disabled = false;
        setStatus('完成しました。', false, 2600);
      } else {
        setStatus('砂が定着しませんでした。別の文字でお試しください。', true);
      }
    }
  }

  const angleRad = (gravityAngleDeg * Math.PI) / 180;
  sim.step(angleRad);

  gridCtx.putImageData(simImageData, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  (ctx as CanvasRenderingContext2D).imageSmoothingQuality = 'high';
  ctx.drawImage(gridCanvas, 0, 0, gridW, gridH, 0, 0, canvas.width, canvas.height);

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

void hasEverPoured; // referenced for clarity of intent, actual gating handled via exportBtn state
