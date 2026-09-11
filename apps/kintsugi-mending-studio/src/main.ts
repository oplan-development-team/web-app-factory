import '@fontsource/shippori-mincho/400.css';
import '@fontsource/shippori-mincho/600.css';
import '@fontsource/shippori-mincho/700.css';
import '@fontsource/zen-kaku-gothic-new/400.css';
import '@fontsource/zen-kaku-gothic-new/500.css';
import '@fontsource/zen-kaku-gothic-new/700.css';
import './style.css';

import type { CrackSegment, GlazeId, Stage, VesselId } from './types';
import {
  VESSELS,
  VESSEL_ORDER,
  computeTransform,
  getBounds,
  getHitPath,
  isInside,
  toLocalPoint,
} from './vessels';
import { GLAZES, GLAZE_ORDER } from './glaze';
import { MAX_ORIGINS, clampInsideVessel, generateCrackTree } from './cracks';
import { durationForSegmentCount, progressAt, scheduleSegments } from './mending';
import type { ScheduledSegment } from './mending';
import { captionAt } from './captions';
import { drawBackdrop, drawVesselWithCracks } from './render';
import { renderPosterComposition } from './poster';
import type { PosterMeta } from './poster';
import { drawVesselIcon } from './icons';
import { ensureFontsReady } from './fonts';

interface MendingRun {
  startTime: number;
  duration: number;
  schedule: ScheduledSegment[];
}

interface AppState {
  stage: Stage;
  vesselId: VesselId;
  glazeId: GlazeId;
  segments: CrackSegment[];
  originCount: number;
  captionIndex: number;
  createdAt: Date | null;
  mending: MendingRun | null;
}

function createInitialState(): AppState {
  return {
    stage: 'select',
    vesselId: 'bowl',
    glazeId: 'celadon',
    segments: [],
    originCount: 0,
    captionIndex: 0,
    createdAt: null,
    mending: null,
  };
}

let state: AppState = createInitialState();
let lastTransform = computeTransform(720, 720, VESSELS[state.vesselId]);

const fontsReadyPromise = ensureFontsReady();

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch,
  );
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function currentMeta(): PosterMeta {
  return {
    vesselLabel: VESSELS[state.vesselId].label,
    glazeLabel: GLAZES[state.glazeId].label,
    crackCount: state.segments.length,
    dateLabel: state.createdAt ? formatDate(state.createdAt) : '',
  };
}

// ------------------------------------------------------------------ shell

const appEl = document.querySelector<HTMLDivElement>('#app');
if (!appEl) throw new Error('#app root not found');

appEl.innerHTML = `
  <header class="masthead">
    <div>
      <p class="masthead__sub">Kintsugi Mending Studio</p>
      <h1 class="masthead__title">金継ぎスタジオ</h1>
    </div>
    <p class="masthead__tagline">器を割り、金の漆で継ぐ──傷を輝きに変える一枚を仕立てる</p>
  </header>
  <main class="studio">
    <section class="canvas-zone">
      <div class="canvas-frame">
        <canvas id="stage-canvas" aria-label="金継ぎ作業台。器の面をクリックまたはタップすると罅が入ります。"></canvas>
      </div>
      <p class="canvas-hint" id="canvas-hint"></p>
      <div class="origin-ticks" id="origin-ticks" hidden></div>
    </section>
    <aside class="control-rail">
      <nav class="stepper" id="stepper" aria-label="制作の段階"></nav>
      <div class="panel" id="panel"></div>
    </aside>
  </main>
`;

const canvasFrameEl = appEl.querySelector<HTMLDivElement>('.canvas-frame')!;
const canvasEl = appEl.querySelector<HTMLCanvasElement>('#stage-canvas')!;
const hintEl = appEl.querySelector<HTMLParagraphElement>('#canvas-hint')!;
const originTicksEl = appEl.querySelector<HTMLDivElement>('#origin-ticks')!;
const stepperEl = appEl.querySelector<HTMLElement>('#stepper')!;
const panelEl = appEl.querySelector<HTMLDivElement>('#panel')!;

// ------------------------------------------------------------------ stepper

const STAGE_ORDER: Stage[] = ['select', 'breaking', 'mending', 'poster'];
const STAGE_LABELS: Record<Stage, string> = {
  select: '選ぶ',
  breaking: '割る',
  mending: '継ぐ',
  poster: '完成',
};

function renderStepper(): void {
  const idx = STAGE_ORDER.indexOf(state.stage);
  stepperEl.innerHTML = STAGE_ORDER.map((stage, i) => {
    const cls = i === idx ? 'is-current' : i < idx ? 'is-done' : '';
    const item = `<span class="stepper__item ${cls}"><span class="stepper__num">0${i + 1}</span>${STAGE_LABELS[stage]}</span>`;
    return i < STAGE_ORDER.length - 1 ? `${item}<span class="stepper__rule"></span>` : item;
  }).join('');
}

// ------------------------------------------------------------------ panel

function renderCaptionPlate(): string {
  if (state.stage !== 'poster') {
    return `
      <div class="caption-plate">
        <p class="caption-plate__quote is-placeholder">─ 継がれるのを待つ器 ─</p>
      </div>`;
  }
  const meta = currentMeta();
  return `
    <div class="caption-plate">
      <p class="caption-plate__quote">${escapeHtml(captionAt(state.captionIndex))}</p>
      <div class="caption-plate__meta">
        <span>形<b>${escapeHtml(meta.vesselLabel)}</b></span>
        <span>釉<b>${escapeHtml(meta.glazeLabel)}</b></span>
        <span>亀裂<b>${meta.crackCount}条</b></span>
        <span>日付<b>${escapeHtml(meta.dateLabel)}</b></span>
      </div>
      <div class="caption-plate__actions">
        <button class="btn" data-action="next-caption" type="button">次の言葉</button>
        <button class="btn btn--primary" data-action="export-png" type="button">PNGとして書き出す</button>
      </div>
      <button class="text-link" data-action="reset" type="button">新しい器を割る</button>
    </div>`;
}

function renderPanel(): void {
  let top = '';

  if (state.stage === 'select') {
    top = `
      <div>
        <p class="section-label">器の形</p>
        <div class="vessel-picker">
          ${VESSEL_ORDER.map(
            (id) => `
            <button class="picker-btn ${state.vesselId === id ? 'is-selected' : ''}" data-action="select-vessel" data-vessel="${id}" type="button">
              <canvas data-vessel-icon="${id}" width="64" height="64"></canvas>
              <span class="picker-btn__label">${VESSELS[id].label}</span>
            </button>`,
          ).join('')}
        </div>
      </div>
      <div>
        <p class="section-label">釉薬</p>
        <div class="glaze-picker">
          ${GLAZE_ORDER.map(
            (id) => `
            <button class="glaze-btn ${state.glazeId === id ? 'is-selected' : ''}" data-action="select-glaze" data-glaze="${id}" type="button">
              <span class="glaze-swatch" style="background:${GLAZES[id].swatchCss}"></span>
              <span class="glaze-btn__label">${GLAZES[id].label}</span>
            </button>`,
          ).join('')}
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn--primary" data-action="start-breaking" type="button">この器を割り始める →</button>
      </div>
    `;
  } else if (state.stage === 'breaking') {
    const canAct = state.segments.length > 0;
    top = `
      <div>
        <p class="locked-summary">器：<b>${VESSELS[state.vesselId].label}</b>　釉薬：<b>${GLAZES[state.glazeId].label}</b></p>
      </div>
      <div class="btn-row">
        <button class="btn" data-action="undo" type="button" ${canAct ? '' : 'disabled'}>やり直す（亀裂を消す）</button>
        <button class="btn btn--primary" data-action="mend" type="button" ${canAct ? '' : 'disabled'}>金で継ぐ →</button>
      </div>
      <button class="text-link" data-action="restart-select" type="button">最初から器を選び直す</button>
    `;
  } else if (state.stage === 'mending') {
    top = `
      <div class="mending-status">
        <p class="mending-status__text">金を流し込んでいます……</p>
        <div class="mending-progress"><div class="mending-progress__fill" id="mending-fill"></div></div>
      </div>
    `;
  } else {
    top = `<p class="locked-summary">この器は継がれ、ひとつの作品になりました。</p>`;
  }

  panelEl.innerHTML = top + renderCaptionPlate();

  if (state.stage === 'select') {
    for (const id of VESSEL_ORDER) {
      const iconCanvas = panelEl.querySelector<HTMLCanvasElement>(`canvas[data-vessel-icon="${id}"]`);
      if (iconCanvas) drawVesselIcon(iconCanvas, id, state.vesselId === id);
    }
  }
}

function renderCanvasHint(): void {
  let text = '';
  let warning = false;

  if (state.stage === 'select') {
    text = '器と釉薬を選び、「割り始める」で作業台に置きます';
  } else if (state.stage === 'breaking') {
    if (state.originCount >= MAX_ORIGINS) {
      text = 'これ以上は割れません — 金で継いでください';
      warning = true;
    } else {
      text = `器の面をクリック・タップして罅を入れてください（あと${MAX_ORIGINS - state.originCount}回まで）`;
    }
  } else if (state.stage === 'mending') {
    text = '';
  } else {
    text = '── 継がれた器 ──';
  }

  hintEl.textContent = text;
  hintEl.classList.toggle('is-warning', warning);

  const showTicks = state.stage === 'breaking' || state.stage === 'mending';
  originTicksEl.hidden = !showTicks;
  if (showTicks) {
    originTicksEl.innerHTML = Array.from({ length: MAX_ORIGINS })
      .map((_, i) => `<span class="origin-tick ${i < state.originCount ? 'is-used' : ''}"></span>`)
      .join('');
  }

  canvasEl.classList.toggle('is-locked-full', state.stage === 'breaking' && state.originCount >= MAX_ORIGINS);
  canvasEl.classList.toggle('is-static', state.stage !== 'breaking');
}

// ------------------------------------------------------------------ canvas

function sizeCanvasForStage(): { w: number; h: number } {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const aspect = state.stage === 'poster' ? 5 / 4 : 1;
  const w = canvasFrameEl.clientWidth || 640;
  const h = w * aspect;
  canvasEl.style.width = `${w}px`;
  canvasEl.style.height = `${h}px`;
  canvasEl.width = Math.round(w * dpr);
  canvasEl.height = Math.round(h * dpr);
  const ctx = canvasEl.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

function drawCanvas(): void {
  const { w, h } = sizeCanvasForStage();
  const ctx = canvasEl.getContext('2d')!;
  const spec = VESSELS[state.vesselId];

  if (state.stage === 'poster') {
    renderPosterComposition(ctx, w, h, spec, state.glazeId, state.segments, captionAt(state.captionIndex), currentMeta());
    return;
  }

  drawBackdrop(ctx, w, h);
  const transform = computeTransform(w, h, spec);
  lastTransform = transform;
  const glaze = GLAZES[state.glazeId];

  let progressMap: Map<CrackSegment, number> | null = null;
  if (state.stage === 'mending' && state.mending) {
    const elapsed = performance.now() - state.mending.startTime;
    progressMap = progressAt(state.mending.schedule, elapsed / state.mending.duration);
  }
  drawVesselWithCracks(ctx, spec, glaze, transform, state.segments, { progressMap });
}

function render(): void {
  renderStepper();
  renderPanel();
  renderCanvasHint();
  drawCanvas();
}

// ------------------------------------------------------------------ interactions

canvasEl.addEventListener('pointerdown', (ev) => {
  if (state.stage !== 'breaking') return;

  if (state.originCount >= MAX_ORIGINS) {
    hintEl.classList.remove('shake');
    // Force reflow so the shake animation can replay on repeated attempts.
    void hintEl.offsetWidth;
    hintEl.classList.add('shake');
    return;
  }

  const rect = canvasEl.getBoundingClientRect();
  const px = ev.clientX - rect.left;
  const py = ev.clientY - rect.top;
  const spec = VESSELS[state.vesselId];
  const bounds = getBounds(spec);
  const transform = lastTransform;
  const local = toLocalPoint(px, py, transform, bounds);

  if (!isInside(getHitPath(spec), local.x, local.y)) return;

  const clamped = clampInsideVessel(spec, local, { x: 0, y: bounds.midY });
  const newSegments = generateCrackTree(spec, state.originCount, clamped);
  state.segments = [...state.segments, ...newSegments];
  state.originCount += 1;
  render();
});

let undoTimer: number | null = null;
let undoSnapshot: { segments: CrackSegment[]; originCount: number } | null = null;
let toastEl: HTMLDivElement | null = null;

function hideToast(): void {
  if (toastEl) {
    toastEl.remove();
    toastEl = null;
  }
}

function showToast(message: string, onUndo: () => void): void {
  hideToast();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${escapeHtml(message)}</span><button type="button">元に戻す</button>`;
  el.querySelector('button')!.addEventListener('click', () => {
    onUndo();
    hideToast();
  });
  document.body.appendChild(el);
  toastEl = el;
}

function handleUndo(): void {
  if (state.segments.length === 0) return;
  undoSnapshot = { segments: state.segments, originCount: state.originCount };
  state.segments = [];
  state.originCount = 0;
  render();

  if (undoTimer) window.clearTimeout(undoTimer);
  showToast('亀裂をすべて消去しました。元に戻せます。', () => {
    if (undoSnapshot) {
      state.segments = undoSnapshot.segments;
      state.originCount = undoSnapshot.originCount;
      undoSnapshot = null;
      render();
    }
    if (undoTimer) {
      window.clearTimeout(undoTimer);
      undoTimer = null;
    }
  });
  undoTimer = window.setTimeout(() => {
    undoSnapshot = null;
    hideToast();
    undoTimer = null;
  }, 5000);
}

function startMending(): void {
  if (state.segments.length === 0) return;
  state.stage = 'mending';
  const schedule = scheduleSegments(state.segments);
  const duration = durationForSegmentCount(state.segments.length);
  state.mending = { startTime: performance.now(), duration, schedule };
  render();

  const fillEl = panelEl.querySelector<HTMLElement>('#mending-fill');

  const step = (): void => {
    if (state.stage !== 'mending' || !state.mending) return;
    const elapsed = performance.now() - state.mending.startTime;
    const frac = Math.min(1, elapsed / state.mending.duration);
    drawCanvas();
    if (fillEl) fillEl.style.width = `${frac * 100}%`;
    if (frac < 1) {
      requestAnimationFrame(step);
    } else {
      void finishMending();
    }
  };
  requestAnimationFrame(step);
}

async function finishMending(): Promise<void> {
  await fontsReadyPromise;
  state.stage = 'poster';
  state.createdAt = new Date();
  state.mending = null;
  render();
}

function resetAll(): void {
  if (undoTimer) {
    window.clearTimeout(undoTimer);
    undoTimer = null;
  }
  undoSnapshot = null;
  hideToast();
  state = createInitialState();
  render();
}

async function exportPng(button: HTMLButtonElement): Promise<void> {
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = '書き出し中……';
  try {
    await fontsReadyPromise;
    const w = 1600;
    const h = 2000;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const ctx = off.getContext('2d');
    if (!ctx) throw new Error('offscreen 2d context unavailable');
    renderPosterComposition(
      ctx,
      w,
      h,
      VESSELS[state.vesselId],
      state.glazeId,
      state.segments,
      captionAt(state.captionIndex),
      currentMeta(),
    );
    const blob: Blob | null = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG encoding failed');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kintsugi-${state.vesselId}-${state.glazeId}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (err) {
    console.error(err);
    showToast('書き出しに失敗しました。もう一度お試しください。', () => {});
    window.setTimeout(hideToast, 4000);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

panelEl.addEventListener('click', (ev) => {
  const target = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!target || target.hasAttribute('disabled')) return;
  const action = target.dataset.action;

  switch (action) {
    case 'select-vessel':
      state.vesselId = target.dataset.vessel as VesselId;
      render();
      break;
    case 'select-glaze':
      state.glazeId = target.dataset.glaze as GlazeId;
      render();
      break;
    case 'start-breaking':
      state.stage = 'breaking';
      render();
      break;
    case 'restart-select':
      resetAll();
      break;
    case 'undo':
      handleUndo();
      break;
    case 'mend':
      startMending();
      break;
    case 'next-caption':
      state.captionIndex += 1;
      render();
      break;
    case 'export-png':
      void exportPng(target as HTMLButtonElement);
      break;
    case 'reset':
      resetAll();
      break;
    default:
      break;
  }
});

let resizePending = false;
window.addEventListener('resize', () => {
  if (resizePending) return;
  resizePending = true;
  requestAnimationFrame(() => {
    resizePending = false;
    if (state.stage !== 'mending') drawCanvas();
  });
});

render();
