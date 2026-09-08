import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/900.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './style.css';

import { AudioProcessingError, type DiscOptions, type Envelope, type LabelPreset } from './types';
import { decodeFileToEnvelope } from './audio/decode';
import { MicRecorder, MAX_RECORD_SECONDS } from './audio/mic';
import { LABEL_PRESETS } from './disc/presets';
import { renderDisc } from './disc/render';
import { exportDiscPng } from './disc/export';

type StageState = 'idle' | 'loading' | 'error' | 'ready';

// --- DOM references -------------------------------------------------------
const canvas = document.getElementById('disc-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D context is not available.');

const stage = document.getElementById('stage') as HTMLElement;
const stageOverlay = document.getElementById('stage-overlay') as HTMLElement;

const tabFile = document.getElementById('tab-file') as HTMLButtonElement;
const tabMic = document.getElementById('tab-mic') as HTMLButtonElement;
const paneFile = document.getElementById('pane-file') as HTMLElement;
const paneMic = document.getElementById('pane-mic') as HTMLElement;

const dropzone = document.getElementById('dropzone') as HTMLLabelElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;

const micToggle = document.getElementById('mic-toggle') as HTMLButtonElement;
const micTimer = document.getElementById('mic-timer') as HTMLElement;
const levelMeter = document.getElementById('level-meter') as HTMLElement;
const levelMeterBar = document.getElementById('level-meter-bar') as HTMLElement;

const sourceInfo = document.getElementById('source-info') as HTMLElement;
const sourceName = document.getElementById('source-name') as HTMLElement;
const sourceMeta = document.getElementById('source-meta') as HTMLElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;

const inputTitle = document.getElementById('input-title') as HTMLInputElement;
const inputArtist = document.getElementById('input-artist') as HTMLInputElement;
const inputCatalog = document.getElementById('input-catalog') as HTMLInputElement;
const inputSide = document.getElementById('input-side') as HTMLInputElement;

const presetList = document.getElementById('preset-list') as HTMLElement;
const modStrengthSlider = document.getElementById('mod-strength') as HTMLInputElement;
const modStrengthValue = document.getElementById('mod-strength-value') as HTMLElement;

const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
const exportStatus = document.getElementById('export-status') as HTMLElement;

// --- state ------------------------------------------------------------
let envelope: Envelope | null = null;
let currentPreset: LabelPreset = LABEL_PRESETS[0];
let modStrength = Number(modStrengthSlider.value) / 100;
let micRecorder: MicRecorder | null = null;
let isRecording = false;
let isStoppingRecording = false;

// --- helpers ------------------------------------------------------------
function computeOptions(): DiscOptions {
  return {
    envelope,
    modStrength,
    preset: currentPreset,
    text: {
      title: inputTitle.value,
      artist: inputArtist.value,
      catalogNumber: inputCatalog.value,
      sideLabel: inputSide.value,
    },
  };
}

function rerender(): void {
  renderDisc(ctx!, canvas.width, computeOptions());
  updateExportButtonState();
}

function updateExportButtonState(): void {
  const ready = Boolean(envelope) && inputTitle.value.trim().length > 0 && inputArtist.value.trim().length > 0;
  exportBtn.disabled = !ready;
}

function setStageState(state: StageState, message?: string): void {
  stage.dataset.state = state;
  if (state === 'idle') {
    stageOverlay.innerHTML =
      '<p class="stage-caption__title">まだ何も刻まれていません</p>' +
      '<p class="stage-caption__body">音声ファイルを読み込むか、マイクで録音すると、その波形が溝として刻まれます。</p>';
  } else if (state === 'loading') {
    stageOverlay.innerHTML =
      '<div class="stage-loading"><span class="stage-loading__ring" aria-hidden="true"></span>' +
      '<span>波形を解析しています&hellip;</span></div>';
  } else if (state === 'error') {
    stageOverlay.innerHTML = `<div class="stage-error"><span class="stage-error__mark" aria-hidden="true">&#9888;</span><p>${escapeHtml(
      message ?? '不明なエラーが発生しました。',
    )}</p></div>`;
  } else {
    stageOverlay.innerHTML = '';
  }
}

function escapeHtml(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9぀-ヿ一-龯]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function triggerSettleAnimation(): void {
  canvas.classList.remove('stage__canvas--settle');
  // force reflow so the animation can restart
  void canvas.offsetWidth;
  canvas.classList.add('stage__canvas--settle');
}

function showSourceInfo(name: string, meta: string): void {
  sourceName.textContent = name;
  sourceMeta.textContent = meta;
  sourceInfo.hidden = false;
}

function hideSourceInfo(): void {
  sourceInfo.hidden = true;
}

function applyEnvelope(env: Envelope, name: string, meta: string): void {
  envelope = env;
  setStageState('ready');
  showSourceInfo(name, meta);
  triggerSettleAnimation();
  rerender();
}

function handleAudioError(err: unknown): void {
  const message =
    err instanceof AudioProcessingError
      ? err.message
      : '予期しないエラーが発生しました。もう一度お試しください。';
  setStageState('error', message);
}

// --- preset swatches ------------------------------------------------------
function buildPresetList(): void {
  presetList.innerHTML = '';
  LABEL_PRESETS.forEach((preset, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-swatch' + (index === 0 ? ' is-active' : '');
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', index === 0 ? 'true' : 'false');
    btn.style.setProperty('--swatch-base', preset.base);
    btn.style.setProperty('--swatch-accent', preset.accent);
    btn.innerHTML = `<span class="preset-swatch__ring" aria-hidden="true"></span><span class="preset-swatch__name">${escapeHtml(
      preset.name,
    )}</span>`;
    btn.addEventListener('click', () => {
      currentPreset = preset;
      presetList.querySelectorAll('.preset-swatch').forEach((el) => {
        el.classList.remove('is-active');
        el.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-checked', 'true');
      rerender();
    });
    presetList.appendChild(btn);
  });
}

// --- tabs -------------------------------------------------------------
function setActiveTab(tab: 'file' | 'mic'): void {
  const isFile = tab === 'file';
  tabFile.classList.toggle('is-active', isFile);
  tabMic.classList.toggle('is-active', !isFile);
  tabFile.setAttribute('aria-selected', String(isFile));
  tabMic.setAttribute('aria-selected', String(!isFile));
  paneFile.hidden = !isFile;
  paneMic.hidden = isFile;
  if (!isFile && isRecording === false) {
    // leaving the mic tab mid-recording is allowed but we don't auto-cancel;
    // recording continues in the background so switching back shows progress.
  }
}

tabFile.addEventListener('click', () => setActiveTab('file'));
tabMic.addEventListener('click', () => setActiveTab('mic'));

// --- file input ---------------------------------------------------------
async function loadFromFile(file: File): Promise<void> {
  setStageState('loading');
  try {
    const env = await decodeFileToEnvelope(file);
    applyEnvelope(env, file.name, `${formatDuration(env.durationSec)} 秒`);
  } catch (err) {
    handleAudioError(err);
  }
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) void loadFromFile(file);
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('is-dragover');
});
dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('is-dragover');
});
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('is-dragover');
  const file = e.dataTransfer?.files?.[0];
  if (file) void loadFromFile(file);
});

// --- mic recording --------------------------------------------------------
function resetLevelMeterUI(): void {
  levelMeterBar.style.width = '0%';
  levelMeterBar.classList.remove('is-peak');
  micTimer.textContent = `00:00 / 00:${MAX_RECORD_SECONDS}`;
}

function setLevel(level: number): void {
  const pct = Math.min(100, Math.round(level * 100));
  levelMeterBar.style.width = `${pct}%`;
  levelMeterBar.classList.toggle('is-peak', level > 0.72);
}

function updateTimer(elapsedSec: number): void {
  const s = Math.min(MAX_RECORD_SECONDS, Math.floor(elapsedSec));
  micTimer.textContent = `00:${String(s).padStart(2, '0')} / 00:${MAX_RECORD_SECONDS}`;
}

async function stopRecording(): Promise<void> {
  if (!isRecording || isStoppingRecording || !micRecorder) return;
  isStoppingRecording = true;
  micToggle.disabled = true;
  micToggle.textContent = '処理中…';
  setStageState('loading');
  try {
    const env = await micRecorder.stop();
    applyEnvelope(env, 'マイク録音', `${formatDuration(env.durationSec)} 秒`);
  } catch (err) {
    handleAudioError(err);
  } finally {
    isRecording = false;
    isStoppingRecording = false;
    micToggle.disabled = false;
    micToggle.textContent = '録音開始';
    levelMeter.classList.remove('is-live');
    resetLevelMeterUI();
  }
}

micToggle.addEventListener('click', async () => {
  if (isRecording) {
    void stopRecording();
    return;
  }
  micRecorder = new MicRecorder();
  try {
    micToggle.textContent = '録音を停止';
    levelMeter.classList.add('is-live');
    isRecording = true;
    await micRecorder.start({
      onLevel: setLevel,
      onTick: updateTimer,
      onAutoStop: () => void stopRecording(),
    });
  } catch (err) {
    isRecording = false;
    micToggle.textContent = '録音開始';
    levelMeter.classList.remove('is-live');
    handleAudioError(err);
  }
});

// --- reset ---------------------------------------------------------------
resetBtn.addEventListener('click', () => {
  envelope = null;
  hideSourceInfo();
  setStageState('idle');
  rerender();
});

// --- text + slider inputs -------------------------------------------------
[inputTitle, inputArtist, inputCatalog, inputSide].forEach((el) => {
  el.addEventListener('input', () => rerender());
});

modStrengthSlider.addEventListener('input', () => {
  const value = Number(modStrengthSlider.value);
  modStrength = value / 100;
  modStrengthValue.textContent = `${value}%`;
  rerender();
});

// --- export ---------------------------------------------------------------
let exportStatusTimer: number | null = null;

function showExportStatus(kind: 'success' | 'error', message: string): void {
  if (exportStatusTimer !== null) window.clearTimeout(exportStatusTimer);
  exportStatus.textContent = message;
  exportStatus.className = `export-status is-${kind}`;
  exportStatusTimer = window.setTimeout(() => {
    exportStatus.className = 'export-status';
    exportStatus.textContent = '';
  }, 3200);
}

exportBtn.addEventListener('click', async () => {
  if (exportBtn.disabled) return;
  const originalLabel = exportBtn.textContent ?? '';
  exportBtn.disabled = true;
  exportBtn.textContent = '書き出し中…';
  try {
    await exportDiscPng(computeOptions(), slugify(inputTitle.value) || 'vinyl-groove-label');
    showExportStatus('success', 'PNGを書き出しました。');
  } catch (err) {
    showExportStatus('error', '書き出しに失敗しました。もう一度お試しください。');
  } finally {
    exportBtn.textContent = originalLabel;
    updateExportButtonState();
  }
});

// --- boot ---------------------------------------------------------------
buildPresetList();
setStageState('idle');
resetLevelMeterUI();
rerender();
