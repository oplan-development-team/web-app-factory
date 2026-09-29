import './style.css';
import { buildWaveform, isPathUsable, RESAMPLE_N, type Point, type Waveform } from './geometry';
import { getPreset, PRESET_LABELS, type PresetId } from './presets';
import { AudioEngine } from './audioEngine';
import { ScopeCanvas } from './scopeCanvas';
import { downloadBlob, encodeWav } from './wavEncoder';
import { renderWaveformToPngBlob } from './snapshot';
import { captureGif } from './gifExporter';

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;

// ---------- DOM refs ----------
const canvasEl = $<HTMLCanvasElement>('#scopeCanvas');
const stampGrid = $<HTMLDivElement>('#stampGrid');
const sharpnessSlider = $<HTMLInputElement>('#sharpnessSlider');
const sharpnessValue = $<HTMLSpanElement>('#sharpnessValue');
const undoBtn = $<HTMLButtonElement>('#undoBtn');
const clearBtn = $<HTMLButtonElement>('#clearBtn');

const freqSlider = $<HTMLInputElement>('#freqSlider');
const freqSliderValue = $<HTMLSpanElement>('#freqSliderValue');
const volSlider = $<HTMLInputElement>('#volSlider');
const volSliderValue = $<HTMLSpanElement>('#volSliderValue');

const playBtn = $<HTMLButtonElement>('#playBtn');
const pauseBtn = $<HTMLButtonElement>('#pauseBtn');
const stopBtn = $<HTMLButtonElement>('#stopBtn');

const exportWavBtn = $<HTMLButtonElement>('#exportWavBtn');
const exportPngBtn = $<HTMLButtonElement>('#exportPngBtn');
const exportGifBtn = $<HTMLButtonElement>('#exportGifBtn');
const exportProgressTrack = $<HTMLDivElement>('#exportProgressTrack');
const exportProgressFill = $<HTMLDivElement>('#exportProgressFill');
const exportStatus = $<HTMLParagraphElement>('#exportStatus');

const freqReadout = $<HTMLSpanElement>('#freqReadout');
const dbReadout = $<HTMLSpanElement>('#dbReadout');
const samplesReadout = $<HTMLSpanElement>('#samplesReadout');
const stateReadout = $<HTMLSpanElement>('#stateReadout');

const ledPlay = $<HTMLDivElement>('#ledPlay');
const ledRec = $<HTMLDivElement>('#ledRec');

// ---------- State ----------
let rawPoints: Point[] = getPreset('circle');
let undoStack: Point[][] = [];
const MAX_UNDO = 20;
let currentWaveform: Waveform | null = null;
let exportBusy = false;

const audioEngine = new AudioEngine();

const scope = new ScopeCanvas(canvasEl, {
  onStrokeStart: () => {
    scope.stopRaf();
  },
  onStrokeComplete: (points) => {
    commitNewPath(points);
    if (audioEngine.state === 'playing') {
      startVisualLoop();
    }
  }
});

// ---------- History / path management ----------

function pushHistory(prev: Point[]) {
  undoStack.push(prev);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  undoBtn.disabled = undoStack.length === 0;
}

function commitNewPath(points: Point[]) {
  pushHistory(rawPoints);
  rawPoints = points;
  onPathChanged();
}

function clearPath() {
  pushHistory(rawPoints);
  rawPoints = [];
  onPathChanged();
}

function undo() {
  if (undoStack.length === 0) return;
  rawPoints = undoStack.pop()!;
  undoBtn.disabled = undoStack.length === 0;
  onPathChanged();
}

function onPathChanged() {
  const sharpness = Number(sharpnessSlider.value) / 100;
  if (isPathUsable(rawPoints)) {
    currentWaveform = buildWaveform(rawPoints, sharpness, RESAMPLE_N);
    audioEngine.updateWaveform(currentWaveform);
    if (audioEngine.state !== 'playing') {
      scope.renderStaticWaveform(currentWaveform);
    }
  } else {
    currentWaveform = null;
    if (audioEngine.state !== 'playing') {
      scope.renderEmpty();
    }
  }
  updateControlAvailability();
  updateReadouts();
}

// ---------- Shape stamps ----------

function pointsToSvgPath(points: Point[]): string {
  const scale = 12;
  const cx = 16;
  const cy = 16;
  return (
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${(cx + p.x * scale).toFixed(1)},${(cy + p.y * scale).toFixed(1)}`)
      .join(' ') + ' Z'
  );
}

(Object.keys(PRESET_LABELS) as PresetId[]).forEach((id) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'stamp-btn';
  btn.setAttribute('aria-label', `${PRESET_LABELS[id]} スタンプを挿入`);
  const pathD = pointsToSvgPath(getPreset(id));
  btn.innerHTML = `
    <svg viewBox="0 0 32 32" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
      <path d="${pathD}" />
    </svg>
    <span>${PRESET_LABELS[id]}</span>
  `;
  btn.addEventListener('click', () => {
    commitNewPath(getPreset(id));
    if (audioEngine.state === 'playing') startVisualLoop();
  });
  stampGrid.appendChild(btn);
});

// ---------- Sharpness ----------

function setSliderFill(el: HTMLInputElement) {
  const min = Number(el.min);
  const max = Number(el.max);
  const pct = ((Number(el.value) - min) / (max - min)) * 100;
  el.style.setProperty('--fill', `${pct}%`);
}

sharpnessSlider.addEventListener('input', () => {
  sharpnessValue.textContent = `${sharpnessSlider.value}%`;
  setSliderFill(sharpnessSlider);
  onPathChanged();
});

undoBtn.addEventListener('click', undo);
clearBtn.addEventListener('click', clearPath);

// ---------- Frequency / Volume ----------

freqSlider.addEventListener('input', () => {
  const hz = Number(freqSlider.value);
  audioEngine.setFrequency(hz);
  freqSliderValue.textContent = `${hz} HZ`;
  setSliderFill(freqSlider);
  updateReadouts();
});

volSlider.addEventListener('input', () => {
  const v = Number(volSlider.value);
  audioEngine.setVolume(v / 100);
  volSliderValue.textContent = `${v}%`;
  setSliderFill(volSlider);
});

// ---------- Transport ----------

let dbTickCounter = 0;

function startVisualLoop() {
  scope.startRaf(() => {
    if (audioEngine.state !== 'playing' || !audioEngine.analyserL || !audioEngine.analyserR) return;
    const bufL = new Float32Array(audioEngine.analyserL.fftSize);
    const bufR = new Float32Array(audioEngine.analyserR.fftSize);
    audioEngine.analyserL.getFloatTimeDomainData(bufL);
    audioEngine.analyserR.getFloatTimeDomainData(bufR);
    scope.renderAnalyserFrame(bufL, bufR, 0.14);

    dbTickCounter++;
    if (dbTickCounter % 4 === 0) {
      dbReadout.innerHTML = `${audioEngine.getEstimatedDb().toFixed(0)}<small>DB</small>`;
    }
  });
}

playBtn.addEventListener('click', async () => {
  if (!currentWaveform || audioEngine.state === 'playing') return;
  await audioEngine.play();
  updateTransportUI();
  startVisualLoop();
});

pauseBtn.addEventListener('click', async () => {
  if (audioEngine.state !== 'playing') return;
  await audioEngine.pause();
  scope.stopRaf();
  updateTransportUI();
});

stopBtn.addEventListener('click', () => {
  if (audioEngine.state === 'idle') return;
  audioEngine.stop();
  scope.stopRaf();
  dbReadout.innerHTML = `&minus;60<small>DB</small>`;
  if (currentWaveform) scope.renderStaticWaveform(currentWaveform);
  else scope.renderEmpty();
  updateTransportUI();
});

// ---------- UI sync helpers ----------

function updateControlAvailability() {
  const hasPath = !!currentWaveform;
  const playing = audioEngine.state === 'playing';
  const paused = audioEngine.state === 'paused';

  playBtn.disabled = !hasPath || exportBusy || playing;
  pauseBtn.disabled = !hasPath || exportBusy || !playing;
  stopBtn.disabled = !hasPath || exportBusy || audioEngine.state === 'idle';

  playBtn.classList.toggle('active', playing);
  pauseBtn.classList.toggle('active', paused);

  const exportsAllowed = hasPath && !exportBusy;
  exportWavBtn.disabled = !exportsAllowed;
  exportPngBtn.disabled = !exportsAllowed;
  exportGifBtn.disabled = !exportsAllowed;

  undoBtn.disabled = undoStack.length === 0;
}

function updateTransportUI() {
  updateControlAvailability();
  ledPlay.classList.toggle('lit', audioEngine.state === 'playing');
  stateReadout.textContent = audioEngine.state.toUpperCase();
}

function updateReadouts() {
  freqReadout.innerHTML = `${audioEngine.getFrequency()}<small>HZ</small>`;
  samplesReadout.innerHTML = currentWaveform ? `${RESAMPLE_N}<small>SMP</small>` : `&mdash;<small>SMP</small>`;
  stateReadout.textContent = audioEngine.state.toUpperCase();
}

function setExportBusy(busy: boolean) {
  exportBusy = busy;
  ledRec.classList.toggle('lit', busy);
  updateControlAvailability();
}

function setProgress(fraction: number) {
  exportProgressTrack.hidden = false;
  exportProgressFill.style.width = `${Math.round(fraction * 100)}%`;
}

function hideProgress() {
  exportProgressTrack.hidden = true;
  exportProgressFill.style.width = '0%';
}

// ---------- Export handlers ----------

exportWavBtn.addEventListener('click', async () => {
  if (exportBusy || !currentWaveform) return;
  setExportBusy(true);
  exportStatus.textContent = 'レンダリング中… (WAV)';
  try {
    const rendered = await audioEngine.renderOffline(3);
    const blob = encodeWav(rendered);
    downloadBlob(blob, 'oscilloscope-synth.wav');
    exportStatus.textContent = 'WAVを書き出しました。';
  } catch (err) {
    console.error(err);
    exportStatus.textContent = 'WAVの書き出しに失敗しました。';
  } finally {
    setExportBusy(false);
  }
});

exportPngBtn.addEventListener('click', async () => {
  if (exportBusy || !currentWaveform) return;
  setExportBusy(true);
  exportStatus.textContent = 'レンダリング中… (PNG)';
  try {
    const blob = await renderWaveformToPngBlob(currentWaveform);
    downloadBlob(blob, 'oscilloscope-synth.png');
    exportStatus.textContent = 'PNGを書き出しました。';
  } catch (err) {
    console.error(err);
    exportStatus.textContent = 'PNGの書き出しに失敗しました。';
  } finally {
    setExportBusy(false);
  }
});

exportGifBtn.addEventListener('click', async () => {
  if (exportBusy || !currentWaveform) return;
  setExportBusy(true);
  setProgress(0);
  exportStatus.textContent = 'GIFをキャプチャ中…';

  const wasPlaying = audioEngine.state === 'playing';
  const wasPaused = audioEngine.state === 'paused';
  scope.stopRaf();

  try {
    if (audioEngine.state !== 'playing') {
      await audioEngine.play();
    }
    const blob = await captureGif({
      sourceCanvas: scope.getCanvasElement(),
      durationMs: 2000,
      fps: 18,
      onProgress: setProgress,
      onBeforeFrame: () => {
        if (!audioEngine.analyserL || !audioEngine.analyserR) return;
        const bufL = new Float32Array(audioEngine.analyserL.fftSize);
        const bufR = new Float32Array(audioEngine.analyserR.fftSize);
        audioEngine.analyserL.getFloatTimeDomainData(bufL);
        audioEngine.analyserR.getFloatTimeDomainData(bufR);
        scope.renderAnalyserFrame(bufL, bufR, 0.14);
      }
    });
    downloadBlob(blob, 'oscilloscope-synth.gif');
    exportStatus.textContent = 'GIFを書き出しました。';
  } catch (err) {
    console.error(err);
    exportStatus.textContent = 'GIFの書き出しに失敗しました。';
  } finally {
    if (wasPlaying) {
      startVisualLoop();
    } else if (wasPaused) {
      await audioEngine.pause();
    } else {
      audioEngine.stop();
      if (currentWaveform) scope.renderStaticWaveform(currentWaveform);
    }
    hideProgress();
    setExportBusy(false);
    updateTransportUI();
  }
});

// ---------- Init ----------

setSliderFill(sharpnessSlider);
setSliderFill(freqSlider);
setSliderFill(volSlider);
onPathChanged();
updateTransportUI();
