import './style.css';
import '@fontsource-variable/fraunces/wght.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/source-serif-4/wght.css';
import '@fontsource-variable/source-serif-4/wght-italic.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-mono/700.css';

import { VoiceRecorder, RecorderError, MAX_RECORDING_SEC, MIN_RECORDING_SEC } from './audio/recorder';
import { buildStrata } from './strata/build';
import { drawPoster, COLUMN_HEIGHT } from './poster/draw';
import { exportPosterPng } from './poster/export';
import { LiveMeter } from './ui/waveform';
import { buildSpecimenMeta } from './specimen';
import type { RawSample, Segment, RecordingStats, SpecimenMeta } from './types';

type ErrorKind = 'permission-denied' | 'no-device' | 'too-short' | 'unsupported' | 'unknown';

type AppState =
  | { kind: 'idle' }
  | { kind: 'recording' }
  | { kind: 'generating'; autoStopped: boolean }
  | { kind: 'poster'; segments: Segment[]; stats: RecordingStats; meta: SpecimenMeta }
  | { kind: 'error'; errorKind: ErrorKind };

const stage = document.getElementById('stage') as HTMLElement;

let state: AppState = { kind: 'idle' };
let recorder: VoiceRecorder | null = null;
let liveMeter: LiveMeter | null = null;
let elapsedTimerEl: HTMLElement | null = null;
let recordingStopped = false;
let lastRawSamples: RawSample[] = [];

let savedTitle = '';
let savedCollector = '';

function setState(next: AppState): void {
  state = next;
  render();
}

function render(): void {
  stage.innerHTML = '';
  switch (state.kind) {
    case 'idle':
      renderIdle();
      break;
    case 'recording':
      renderRecording();
      break;
    case 'generating':
      renderGenerating(state.autoStopped);
      break;
    case 'poster':
      renderPoster(state.segments, state.stats, state.meta);
      break;
    case 'error':
      renderError(state.errorKind);
      break;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------------------------------------------------------------------------
// Idle
// ---------------------------------------------------------------------------
function renderIdle(): void {
  const panel = el('section', 'panel panel--idle');

  const intro = el('div', 'panel__intro');
  intro.appendChild(el('p', 'eyebrow', 'BEFORE YOU BEGIN — 採取前の記録'));
  intro.appendChild(
    el(
      'p',
      'panel__lede',
      'マイクに向かって話すか歌うと、声の音量・ピッチ・間（ま）が、地質調査のボーリングコアのように積層した1枚の標本ポスターになります。最長90秒、最短3秒の録音が必要です。'
    )
  );
  panel.appendChild(intro);

  const form = el('div', 'field-group');

  const titleLabel = el('label', 'field-label', '標本タイトル');
  titleLabel.htmlFor = 'specimen-title';
  const titleInput = el('input', 'field-input') as HTMLInputElement;
  titleInput.id = 'specimen-title';
  titleInput.type = 'text';
  titleInput.maxLength = 60;
  titleInput.placeholder = '例）朝の独り言、第一声';
  titleInput.value = savedTitle;

  const collectorLabel = el('label', 'field-label', '採取者名（任意）');
  collectorLabel.htmlFor = 'specimen-collector';
  const collectorInput = el('input', 'field-input') as HTMLInputElement;
  collectorInput.id = 'specimen-collector';
  collectorInput.type = 'text';
  collectorInput.maxLength = 40;
  collectorInput.placeholder = '例）K.T.';
  collectorInput.value = savedCollector;

  form.appendChild(titleLabel);
  form.appendChild(titleInput);
  form.appendChild(collectorLabel);
  form.appendChild(collectorInput);
  panel.appendChild(form);

  const startBtn = el('button', 'btn btn--primary', '● 録音を開始する');
  startBtn.addEventListener('click', () => {
    savedTitle = titleInput.value;
    savedCollector = collectorInput.value;
    void beginRecording();
  });
  panel.appendChild(startBtn);

  const note = el(
    'p',
    'panel__note',
    `録音は最大${MAX_RECORDING_SEC}秒。音声そのものは保存・送信されず、この端末内での解析のみに使われます。`
  );
  panel.appendChild(note);

  stage.appendChild(panel);
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------
function renderRecording(): void {
  const panel = el('section', 'panel panel--recording');

  const recRow = el('div', 'rec-row');
  const dot = el('span', 'rec-dot');
  recRow.appendChild(dot);
  recRow.appendChild(el('span', 'rec-label', 'RECORDING'));
  const timer = el('span', 'rec-timer', '0:00');
  elapsedTimerEl = timer;
  recRow.appendChild(timer);
  panel.appendChild(recRow);

  const meterCanvas = el('canvas', 'meter-canvas') as HTMLCanvasElement;
  panel.appendChild(meterCanvas);
  requestAnimationFrame(() => {
    liveMeter = new LiveMeter(meterCanvas);
  });

  panel.appendChild(
    el('p', 'panel__note', `声を出したり、間を置いたりしてみてください。最大${MAX_RECORDING_SEC}秒で自動的に停止します。`)
  );

  const stopBtn = el('button', 'btn btn--stop', '■ 録音を停止する');
  stopBtn.addEventListener('click', () => stopRecording(false));
  panel.appendChild(stopBtn);

  stage.appendChild(panel);
}

// ---------------------------------------------------------------------------
// Generating
// ---------------------------------------------------------------------------
function renderGenerating(autoStopped: boolean): void {
  const panel = el('section', 'panel panel--generating');
  const spinner = el('div', 'core-spinner');
  spinner.appendChild(el('span', 'core-spinner__bit'));
  panel.appendChild(spinner);
  panel.appendChild(el('p', 'panel__lede', '地層を形成中…'));
  if (autoStopped) {
    panel.appendChild(
      el('p', 'panel__note', `最大録音時間（${MAX_RECORDING_SEC}秒）に達したため、自動的に停止しました。`)
    );
  }
  stage.appendChild(panel);
}

// ---------------------------------------------------------------------------
// Poster
// ---------------------------------------------------------------------------
function renderPoster(segments: Segment[], stats: RecordingStats, meta: SpecimenMeta): void {
  const panel = el('section', 'panel panel--poster');

  const canvasWrap = el('div', 'poster-canvas-wrap');
  const canvas = el('canvas', 'poster-canvas') as HTMLCanvasElement;
  canvasWrap.appendChild(canvas);
  panel.appendChild(canvasWrap);
  requestAnimationFrame(() => {
    drawPoster(canvas, { segments, stats, meta }, 1);
  });

  const actions = el('div', 'poster-actions');
  const saveBtn = el('button', 'btn btn--primary', '標本ポスターを保存（PNG）');
  const feedback = el('p', 'save-feedback');
  saveBtn.addEventListener('click', () => {
    exportPosterPng({ segments, stats, meta });
    feedback.textContent = `保存しました — 標本番号 ${meta.specimenNumber}`;
    feedback.classList.add('save-feedback--visible');
    window.setTimeout(() => feedback.classList.remove('save-feedback--visible'), 4000);
  });
  actions.appendChild(saveBtn);

  const retryBtn = el('button', 'btn btn--ghost', '録り直す');
  retryBtn.addEventListener('click', () => resetToIdle());
  actions.appendChild(retryBtn);

  panel.appendChild(actions);
  panel.appendChild(feedback);

  stage.appendChild(panel);
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------
const ERROR_COPY: Record<ErrorKind, { title: string; body: string; cta: string }> = {
  'permission-denied': {
    title: 'マイクへのアクセスが許可されませんでした',
    body: 'ブラウザのアドレスバー付近にあるマイクアイコンから許可を与え直すか、OSのプライバシー設定でこのブラウザのマイク使用を許可してから、もう一度お試しください。',
    cta: 'もう一度試す',
  },
  'no-device': {
    title: 'マイクデバイスが見つかりませんでした',
    body: 'マイクが接続されているか、他のアプリがマイクを占有していないかを確認し、ページを再読み込みしてからもう一度お試しください。',
    cta: 'もう一度試す',
  },
  'too-short': {
    title: '録音時間が短すぎます',
    body: `地層として意味のある記録にするため、最短${MIN_RECORDING_SEC}秒以上の録音が必要です。もう少し長く声を出してから停止してみてください。`,
    cta: 'もう一度録音する',
  },
  unsupported: {
    title: 'このブラウザは録音に対応していません',
    body: '最新版のChrome、Edge、Firefox、Safariなど、getUserMediaに対応したブラウザでお試しください。',
    cta: '戻る',
  },
  unknown: {
    title: 'マイクの初期化中に問題が発生しました',
    body: 'ページを再読み込みしてから、もう一度お試しください。改善しない場合はマイクの接続やブラウザの権限設定をご確認ください。',
    cta: 'もう一度試す',
  },
};

function renderError(kind: ErrorKind): void {
  const copy = ERROR_COPY[kind];
  const panel = el('section', 'panel panel--error');
  panel.appendChild(el('p', 'eyebrow eyebrow--error', 'FIELD NOTE — 記録できませんでした'));
  panel.appendChild(el('h2', 'panel__error-title', copy.title));
  panel.appendChild(el('p', 'panel__lede', copy.body));

  const retryBtn = el('button', 'btn btn--primary', copy.cta);
  retryBtn.addEventListener('click', () => resetToIdle());
  panel.appendChild(retryBtn);

  stage.appendChild(panel);
}

// ---------------------------------------------------------------------------
// Flow control
// ---------------------------------------------------------------------------
async function beginRecording(): Promise<void> {
  if (!VoiceRecorder.isSupported()) {
    setState({ kind: 'error', errorKind: 'unsupported' });
    return;
  }

  recordingStopped = false;
  lastRawSamples = [];
  recorder = new VoiceRecorder({
    onLevelTick: (rms, elapsedSec) => {
      liveMeter?.push(rms);
      if (elapsedTimerEl) {
        const m = Math.floor(elapsedSec / 60);
        const s = Math.floor(elapsedSec % 60);
        elapsedTimerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
      }
    },
    onAutoStop: () => stopRecording(true),
  });

  try {
    await recorder.start();
  } catch (err) {
    const kind: ErrorKind = err instanceof RecorderError ? err.kind : 'unknown';
    setState({ kind: 'error', errorKind: kind });
    return;
  }

  setState({ kind: 'recording' });
}

function stopRecording(auto: boolean): void {
  if (recordingStopped || !recorder) return;
  recordingStopped = true;

  const samples = recorder.stop();
  lastRawSamples = samples;
  const duration = samples.length > 0 ? samples[samples.length - 1].t : 0;

  if (duration < MIN_RECORDING_SEC) {
    setState({ kind: 'error', errorKind: 'too-short' });
    return;
  }

  setState({ kind: 'generating', autoStopped: auto });

  // Small perceived-processing delay keeps the transition legible instead of
  // an instant flash, while the actual layout computation runs synchronously.
  window.setTimeout(() => {
    const meta = buildSpecimenMeta(savedTitle, savedCollector);
    const { segments, stats } = buildStrata(lastRawSamples, duration, COLUMN_HEIGHT);
    setState({ kind: 'poster', segments, stats, meta });
  }, 650);
}

function resetToIdle(): void {
  recorder = null;
  liveMeter = null;
  elapsedTimerEl = null;
  recordingStopped = false;
  setState({ kind: 'idle' });
}

render();
