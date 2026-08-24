import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import './style.css';

import { PRESETS, randomPreset, type Preset } from './presets';
import { WaveformEngine, type Beat, type BeatKind } from './waveform';
import { computeSummary, type Summary } from './stats';
import { downloadExportPng } from './export';

// ---------------------------------------------------------------------------
// Static shell markup. This template is a fixed compile-time string with no
// user-controlled data interpolated into it — all dynamic content below is
// written back via textContent, never innerHTML, to avoid any injection risk.
// ---------------------------------------------------------------------------
const APP_ROOT = document.querySelector<HTMLDivElement>('#app')!;
APP_ROOT.innerHTML = `
  <main class="device" role="main">
    <header class="device__header">
      <div class="device__brand">
        <span class="device__brand-mark" aria-hidden="true">&#9685;</span>
        <span class="device__brand-name">TYPING EKG</span>
        <span class="device__model">MODEL&nbsp;TE&#8209;1</span>
      </div>
      <div class="device__status" id="statusBlock">
        <span class="led" id="led" aria-hidden="true"></span>
        <span class="device__status-text" id="statusText">STANDBY</span>
      </div>
    </header>

    <section class="device__presets" aria-label="preset text selector">
      <div class="preset-tabs" id="presetTabs" role="tablist"></div>
      <button class="btn btn--ghost btn--shuffle" id="shuffleBtn" type="button" title="ランダムに選び直す">
        &#8635; RANDOM
      </button>
    </section>

    <section class="device__prompt">
      <div class="prompt-label">TARGET TEXT</div>
      <p class="prompt-text" id="promptText"></p>
    </section>

    <section class="device__screen-wrap" id="screenWrap">
      <canvas id="scope" class="scope-canvas" aria-label="打鍵間隔の波形表示"></canvas>
      <div class="scanlines" aria-hidden="true"></div>
      <div class="crt-vignette" aria-hidden="true"></div>
      <div class="flatline-flash" id="flatlineFlash" aria-hidden="true"></div>
    </section>

    <section class="device__input-row">
      <label class="sr-only" for="typingInput">対象文を入力</label>
      <input
        id="typingInput"
        class="typing-input"
        type="text"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        inputmode="latin"
        placeholder="ここに入力を開始すると記録が始まります &mdash; type to begin"
      />
    </section>

    <p class="device__hint" id="hint" aria-live="polite">
      プリセット文を選び、下の入力欄に打ち始めてください。Enterで途中終了、一致で自動確定します。
    </p>

    <section class="device__telemetry" id="telemetry" aria-live="polite">
      <div class="tele-cell">
        <span class="tele-label">ELAPSED</span>
        <span class="tele-value" id="statTime">0:00.00</span>
      </div>
      <div class="tele-cell">
        <span class="tele-label">CPM</span>
        <span class="tele-value" id="statCpm">&mdash;</span>
      </div>
      <div class="tele-cell">
        <span class="tele-label">WPM</span>
        <span class="tele-value" id="statWpm">&mdash;</span>
      </div>
      <div class="tele-cell tele-cell--wide">
        <span class="tele-label">IRREGULARITY</span>
        <span class="tele-value" id="statIrregularity">&mdash;</span>
      </div>
      <div class="tele-cell">
        <span class="tele-label">ECTOPIC (BKSP)</span>
        <span class="tele-value" id="statBackspace">0</span>
      </div>
    </section>

    <section class="device__actions">
      <button class="btn" id="retryBtn" type="button">&#8634; RETRY</button>
      <button class="btn btn--primary" id="exportBtn" type="button" disabled>
        &#8681; EXPORT PNG
      </button>
    </section>
  </main>
`;

// ---------------------------------------------------------------------------
// Element references
// ---------------------------------------------------------------------------
const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const presetTabsEl = $<HTMLDivElement>('presetTabs');
const shuffleBtn = $<HTMLButtonElement>('shuffleBtn');
const promptTextEl = $<HTMLParagraphElement>('promptText');
const screenWrapEl = $<HTMLDivElement>('screenWrap');
const canvas = $<HTMLCanvasElement>('scope');
const inputEl = $<HTMLInputElement>('typingInput');
const hintEl = $<HTMLParagraphElement>('hint');
const ledEl = $<HTMLSpanElement>('led');
const statusTextEl = $<HTMLSpanElement>('statusText');
const retryBtn = $<HTMLButtonElement>('retryBtn');
const exportBtn = $<HTMLButtonElement>('exportBtn');
const statTimeEl = $<HTMLSpanElement>('statTime');
const statCpmEl = $<HTMLSpanElement>('statCpm');
const statWpmEl = $<HTMLSpanElement>('statWpm');
const statIrregularityEl = $<HTMLSpanElement>('statIrregularity');
const statBackspaceEl = $<HTMLSpanElement>('statBackspace');

const ctx2d = canvas.getContext('2d');
if (!ctx2d) throw new Error('Canvas 2D context is not available in this browser.');
const ctx: CanvasRenderingContext2D = ctx2d;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
type Phase = 'idle' | 'recording' | 'done';

let phase: Phase = 'idle';
let currentPreset: Preset = PRESETS[0]!;
let engine = new WaveformEngine();
let recordStartAbs = 0; // performance.now() at first qualifying keydown
let lastKeyAbs: number | null = null;
const pendingKeyDown = new Map<string, Beat>();
let lastSummary: Summary | null = null;
let rafId = 0;
const idleStartAbs = performance.now();

const WINDOW_MS = 6000;

// ---------------------------------------------------------------------------
// Preset tabs
// ---------------------------------------------------------------------------
function buildPresetTabs(): void {
  presetTabsEl.textContent = '';
  for (const preset of PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-tab';
    btn.role = 'tab';
    btn.dataset.id = preset.id;
    const tag = document.createElement('span');
    tag.className = 'preset-tab__tag';
    tag.textContent = preset.label;
    const preview = document.createElement('span');
    preview.className = 'preset-tab__preview';
    preview.textContent =
      preset.text.length > 18 ? `${preset.text.slice(0, 18)}…` : preset.text;
    btn.append(tag, preview);
    btn.addEventListener('click', () => selectPreset(preset));
    presetTabsEl.appendChild(btn);
  }
  syncPresetTabsActive();
}

function syncPresetTabsActive(): void {
  for (const el of presetTabsEl.querySelectorAll<HTMLButtonElement>(
    '.preset-tab',
  )) {
    const active = el.dataset.id === currentPreset.id;
    el.classList.toggle('is-active', active);
    el.setAttribute('aria-selected', String(active));
  }
}

function selectPreset(preset: Preset): void {
  currentPreset = preset;
  syncPresetTabsActive();
  resetSession({ focusInput: true });
}

// ---------------------------------------------------------------------------
// Prompt rendering (per-character correctness highlight)
// ---------------------------------------------------------------------------
function renderPrompt(typed: string): void {
  promptTextEl.textContent = '';
  const frag = document.createDocumentFragment();
  const target = currentPreset.text;
  for (let i = 0; i < target.length; i++) {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = target[i]!;
    if (i < typed.length) {
      span.classList.add(typed[i] === target[i] ? 'is-correct' : 'is-wrong');
    } else if (i === typed.length) {
      span.classList.add('is-current');
    }
    frag.appendChild(span);
  }
  promptTextEl.appendChild(frag);
}

// ---------------------------------------------------------------------------
// Canvas sizing
// ---------------------------------------------------------------------------
function resizeCanvas(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Resizing the backing buffer clears any pixels already drawn. The render
  // loop repaints every frame while idle/recording, but it stops once
  // phase === 'done' (see frame()), so the frozen "flatline capture" would
  // otherwise vanish on the next resize (DevTools toggle, rotation, etc.).
  // Repaint that final frame immediately instead of waiting for a loop that
  // is no longer running.
  if (phase === 'done') {
    drawFrozenFrame();
  }
}

new ResizeObserver(resizeCanvas).observe(canvas);

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
function frame(): void {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);
  engine.drawGrid(ctx, w, h, 22);

  let timeStart: number;
  let timeEnd: number;

  if (phase === 'recording') {
    const elapsed = performance.now() - recordStartAbs;
    timeEnd = Math.max(elapsed, 1400);
    timeStart = timeEnd - WINDOW_MS;
  } else {
    // idle: gentle ambient baseline scroll so the screen never looks dead
    const elapsed = performance.now() - idleStartAbs;
    timeEnd = elapsed;
    timeStart = timeEnd - WINDOW_MS;
  }

  engine.drawTrace(
    ctx,
    { timeStart, timeEnd },
    { x: 0, y: 0, width: w, height: h },
    { glow: true },
  );

  if (phase !== 'done') {
    rafId = requestAnimationFrame(frame);
  }
}

function startLoop(): void {
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
}

// Idle ambient engine has no beats, so drawTrace just shows the gentle jitter
// baseline — this doubles as the "empty state" so the CRT never looks inert.
startLoop();

// ---------------------------------------------------------------------------
// Timer readout while recording
// ---------------------------------------------------------------------------
let timerRafId = 0;
function tickTimer(): void {
  if (phase === 'recording') {
    const elapsed = performance.now() - recordStartAbs;
    statTimeEl.textContent = formatElapsed(elapsed);
    timerRafId = requestAnimationFrame(tickTimer);
  }
}

function formatElapsed(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = (totalSeconds % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}

// ---------------------------------------------------------------------------
// Status / LED
// ---------------------------------------------------------------------------
function setStatus(text: string, mode: Phase): void {
  statusTextEl.textContent = text;
  ledEl.classList.remove('led--idle', 'led--recording', 'led--done');
  ledEl.classList.add(
    mode === 'idle' ? 'led--idle' : mode === 'recording' ? 'led--recording' : 'led--done',
  );
}

function pulseLed(): void {
  ledEl.classList.remove('led--pulse');
  // Force reflow so the animation can restart even if triggered rapidly.
  void ledEl.offsetWidth;
  ledEl.classList.add('led--pulse');
}

function flashArrhythmia(): void {
  screenWrapEl.classList.remove('is-arrhythmia');
  void screenWrapEl.offsetWidth;
  screenWrapEl.classList.add('is-arrhythmia');
  window.setTimeout(() => screenWrapEl.classList.remove('is-arrhythmia'), 220);
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------
function resetSession(opts: { focusInput?: boolean } = {}): void {
  phase = 'idle';
  engine = new WaveformEngine();
  recordStartAbs = 0;
  lastKeyAbs = null;
  pendingKeyDown.clear();
  lastSummary = null;

  inputEl.value = '';
  inputEl.disabled = false;
  inputEl.maxLength = currentPreset.text.length + 20;
  renderPrompt('');
  setStatus('STANDBY', 'idle');
  hintEl.textContent =
    'プリセット文を選び、下の入力欄に打ち始めてください。Enterで途中終了、一致で自動確定します。';

  statTimeEl.textContent = '0:00.00';
  statCpmEl.textContent = '—';
  statWpmEl.textContent = '—';
  statIrregularityEl.textContent = '—';
  statBackspaceEl.textContent = '0';

  exportBtn.disabled = true;
  screenWrapEl.classList.remove('is-complete');

  startLoop();
  if (opts.focusInput) inputEl.focus();
}

function beginRecording(nowAbs: number): void {
  phase = 'recording';
  recordStartAbs = nowAbs;
  lastKeyAbs = nowAbs;
  setStatus('RECORDING', 'recording');
  hintEl.textContent = '記録中… 一致するとそのまま確定します。';
  startLoop();
  cancelAnimationFrame(timerRafId);
  timerRafId = requestAnimationFrame(tickTimer);
}

function finalizeSession(charCount: number): void {
  if (phase !== 'recording') return;
  phase = 'done';
  cancelAnimationFrame(timerRafId);
  cancelAnimationFrame(rafId);

  const elapsedMs = Math.max(1, performance.now() - recordStartAbs);
  const summary = computeSummary(engine.getBeats(), elapsedMs, charCount);
  lastSummary = summary;

  statTimeEl.textContent = formatElapsed(summary.elapsedMs);
  statCpmEl.textContent = String(summary.cpm);
  statWpmEl.textContent = String(summary.wpm);
  statIrregularityEl.textContent = String(summary.irregularityScore);
  statIrregularityEl.classList.toggle(
    'tele-value--warn',
    summary.irregularityScore > 55,
  );
  statBackspaceEl.textContent = String(summary.backspaceCount);

  setStatus('COMPLETE', 'done');
  hintEl.textContent =
    '記録が確定しました。PNGとして書き出すか、もう一度挑戦できます。';
  inputEl.disabled = true;
  exportBtn.disabled = false;

  // Draw the final, static full-duration trace (fit whole recording to the
  // screen width) and freeze it — this is the "flatline capture" moment.
  drawFrozenFrame();

  screenWrapEl.classList.add('is-complete');
  window.setTimeout(() => screenWrapEl.classList.remove('is-complete'), 700);
}

// Repaints the frozen post-completion trace using the last recorded summary.
// Used both right after finalizing and after any resize while phase==='done',
// since resizing the canvas backing buffer clears its pixels and the render
// loop is no longer running at that point to repaint them on its own.
function drawFrozenFrame(): void {
  if (!lastSummary) return;
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  engine.drawGrid(ctx, rect.width, rect.height, 22);
  engine.drawTrace(
    ctx,
    { timeStart: 0, timeEnd: Math.max(1200, lastSummary.elapsedMs + 300) },
    { x: 0, y: 0, width: rect.width, height: rect.height },
    { glow: true },
  );
}

// ---------------------------------------------------------------------------
// Input handling — keydown/keyup timestamps drive the waveform
// ---------------------------------------------------------------------------
function intervalToIntensity(intervalMs: number): number {
  // Short interval (fast typing) -> intensity near 1 (tall, sharp spike).
  // Long interval (slow / paused) -> intensity near a soft floor.
  const clamped = Math.max(0, Math.min(800, intervalMs));
  return Math.max(0.12, 1 - clamped / 800);
}

function registerBeat(kind: BeatKind, code: string): void {
  const nowAbs = performance.now();

  if (phase === 'idle') {
    beginRecording(nowAbs);
  }
  if (phase !== 'recording') return;

  const interval = lastKeyAbs !== null ? nowAbs - lastKeyAbs : 0;
  const intensity = intervalToIntensity(interval);
  const beat: Beat = { t: nowAbs - recordStartAbs, kind, intensity };
  engine.addBeat(beat);
  pendingKeyDown.set(code, beat);
  lastKeyAbs = nowAbs;

  pulseLed();
  if (kind === 'backspace') flashArrhythmia();
}

function registerKeyUp(code: string): void {
  const beat = pendingKeyDown.get(code);
  if (!beat) return;
  pendingKeyDown.delete(code);

  const keydownAbs = recordStartAbs + beat.t;
  const dwell = performance.now() - keydownAbs;
  // Quick taps nudge intensity up slightly; long holds soften it a touch.
  const dwellFactor = Math.max(0, Math.min(1, 1 - dwell / 220));
  beat.intensity = Math.max(
    0.1,
    Math.min(1, beat.intensity * 0.75 + dwellFactor * 0.25),
  );
}

const IGNORED_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'Tab',
  'Escape',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

inputEl.addEventListener('keydown', (e) => {
  if (phase === 'done') return;

  if (e.key === 'Enter') {
    e.preventDefault();
    if (phase === 'recording' && inputEl.value.length > 0) {
      finalizeSession(inputEl.value.length);
    }
    return;
  }

  if (IGNORED_KEYS.has(e.key)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === 'Backspace') {
    registerBeat('backspace', e.code);
    return;
  }

  // A key that produces a single visible character.
  if (e.key.length === 1) {
    registerBeat('normal', e.code);
  }
});

inputEl.addEventListener('keyup', (e) => {
  registerKeyUp(e.code);
});

inputEl.addEventListener('paste', (e) => {
  // Pasting would defeat the point of measuring real keystroke timing.
  e.preventDefault();
  hintEl.textContent = '貼り付けはできません。実際にタイプしてください。';
});

inputEl.addEventListener('input', () => {
  renderPrompt(inputEl.value);
  if (phase === 'recording' && inputEl.value === currentPreset.text) {
    finalizeSession(inputEl.value.length);
  }
});

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
shuffleBtn.addEventListener('click', () => {
  currentPreset = randomPreset(currentPreset.id);
  syncPresetTabsActive();
  resetSession({ focusInput: true });
});

retryBtn.addEventListener('click', () => resetSession({ focusInput: true }));

exportBtn.addEventListener('click', () => {
  if (!lastSummary) return;
  exportBtn.disabled = true;
  const originalLabel = exportBtn.textContent;
  exportBtn.textContent = 'SAVING…';
  downloadExportPng({
    engine,
    presetText: currentPreset.text,
    summary: lastSummary,
    when: new Date(),
  })
    .catch(() => {
      hintEl.textContent = '書き出しに失敗しました。もう一度お試しください。';
    })
    .finally(() => {
      exportBtn.disabled = false;
      exportBtn.textContent = originalLabel;
    });
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
buildPresetTabs();
resizeCanvas();
resetSession();

window.addEventListener('resize', resizeCanvas);
