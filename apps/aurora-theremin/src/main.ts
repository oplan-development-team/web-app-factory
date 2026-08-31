import './style.css';
import { ThereminEngine, Voice } from './audio';
import { AuroraRenderer, type AudioVisualState } from './visual';
import { GestureRecorder, LoopLayer, type Sample } from './recorder';
import { xToFreq, yToGainDb, pitchToHue, clamp01, dbToLinear } from './mapping';

const LAYER_COUNT = 3;
// A gesture crossing ~1.4 screen-widths per second reads as "fast".
const REFERENCE_SPEED_PX_PER_MS = 1.4;

const canvas = document.getElementById('aurora-canvas') as HTMLCanvasElement;
const hintOverlay = document.getElementById('hint-overlay') as HTMLDivElement;
const recToggle = document.getElementById('rec-toggle') as HTMLButtonElement;
const resetAll = document.getElementById('reset-all') as HTMLButtonElement;
const readoutHz = document.getElementById('readout-hz') as HTMLSpanElement;
const readoutDb = document.getElementById('readout-db') as HTMLSpanElement;

const layerUnits = Array.from(document.querySelectorAll<HTMLElement>('.layer-unit')).sort(
  (a, b) => Number(a.dataset.layerIndex) - Number(b.dataset.layerIndex),
);

const renderer = new AuroraRenderer(canvas);

let engine: ThereminEngine | null = null;
function ensureEngine(): ThereminEngine {
  if (!engine) {
    engine = new ThereminEngine(LAYER_COUNT);
  }
  void engine.resume();
  return engine;
}

// --- Live pointer state -----------------------------------------------------

let pointerDown = false;
let pointerX = 0.5; // normalised 0..1
let pointerY = 0.5; // normalised 0..1, 1 = top
let pointerSpeedNorm = 0;
let lastPointerSampleX = 0.5;
let lastPointerSampleY = 0.5;
let lastPointerSampleT = performance.now();
let activePointerId: number | null = null;
let hintDismissed = false;

function dismissHint(): void {
  if (hintDismissed) return;
  hintDismissed = true;
  hintOverlay.setAttribute('hidden', '');
}

function updatePointerFromEvent(ev: PointerEvent): void {
  const rect = canvas.getBoundingClientRect();
  const x = clamp01((ev.clientX - rect.left) / rect.width);
  const y = clamp01((ev.clientY - rect.top) / rect.height);
  const now = performance.now();
  const dt = Math.max(1, now - lastPointerSampleT);
  const dx = x - lastPointerSampleX;
  const dy = y - lastPointerSampleY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  pointerSpeedNorm = clamp01(dist / dt / REFERENCE_SPEED_PX_PER_MS);

  pointerX = x;
  pointerY = 1 - y; // invert so "up" = loud, matching mapping.ts convention
  lastPointerSampleX = x;
  lastPointerSampleY = y;
  lastPointerSampleT = now;
}

canvas.addEventListener('pointerdown', (ev) => {
  dismissHint();
  const eng = ensureEngine();
  activePointerId = ev.pointerId;
  canvas.setPointerCapture(ev.pointerId);
  lastPointerSampleX = clamp01((ev.clientX - canvas.getBoundingClientRect().left) / canvas.getBoundingClientRect().width);
  lastPointerSampleY = clamp01((ev.clientY - canvas.getBoundingClientRect().top) / canvas.getBoundingClientRect().height);
  lastPointerSampleT = performance.now();
  updatePointerFromEvent(ev);
  pointerDown = true;
  eng.liveVoice.noteOn();
  ev.preventDefault();
});

canvas.addEventListener('pointermove', (ev) => {
  if (ev.pointerId !== activePointerId || !pointerDown) return;
  updatePointerFromEvent(ev);
});

function endLivePointer(ev: PointerEvent): void {
  if (ev.pointerId !== activePointerId) return;
  pointerDown = false;
  pointerSpeedNorm = 0;
  activePointerId = null;
  engine?.liveVoice.noteOff();
}

canvas.addEventListener('pointerup', endLivePointer);
canvas.addEventListener('pointercancel', endLivePointer);
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

// --- Loop layers -------------------------------------------------------------

const recorder = new GestureRecorder();
let recordingTargetLayer: number | null = null;
const layers: LoopLayer[] = Array.from({ length: LAYER_COUNT }, () => new LoopLayer());

interface LayerDom {
  root: HTMLElement;
  led: HTMLElement;
  muteBtn: HTMLButtonElement;
  clearBtn: HTMLButtonElement;
}

const layerDom: LayerDom[] = layerUnits.map((root) => ({
  root,
  led: root.querySelector('.led') as HTMLElement,
  muteBtn: root.querySelector('[data-role="mute"]') as HTMLButtonElement,
  clearBtn: root.querySelector('[data-role="clear"]') as HTMLButtonElement,
}));

function refreshLayerUI(index: number): void {
  const layer = layers[index];
  const dom = layerDom[index];
  const isRecordingTarget = recordingTargetLayer === index;

  dom.led.classList.remove('led--playing', 'led--muted', 'led--recording');
  if (isRecordingTarget) {
    dom.led.classList.add('led--recording');
  } else if (layer.hasData && layer.muted) {
    dom.led.classList.add('led--muted');
  } else if (layer.hasData) {
    dom.led.classList.add('led--playing');
  }

  dom.muteBtn.disabled = !layer.hasData || isRecordingTarget;
  dom.clearBtn.disabled = !layer.hasData || isRecordingTarget;
}

function refreshAllLayersUI(): void {
  for (let i = 0; i < LAYER_COUNT; i++) refreshLayerUI(i);
}

layerDom.forEach((dom, index) => {
  dom.muteBtn.addEventListener('click', () => {
    const layer = layers[index];
    if (!layer.hasData) return;
    layer.muted = !layer.muted;
    if (layer.muted) {
      engine?.layerVoices[index].noteOff();
      layer.resetEdge();
    }
    refreshLayerUI(index);
  });

  dom.clearBtn.addEventListener('click', () => {
    const layer = layers[index];
    if (!layer.hasData) return;
    layer.clear();
    engine?.layerVoices[index].noteOff();
    refreshLayerUI(index);
    updateRecToggleAvailability();
  });
});

function updateRecToggleAvailability(): void {
  const hasFreeSlot = layers.some((l) => !l.hasData);
  recToggle.disabled = !hasFreeSlot && recordingTargetLayer === null;
}

recToggle.addEventListener('click', () => {
  dismissHint();
  ensureEngine();

  if (recorder.isRecording) {
    stopRecording();
    return;
  }

  const freeIndex = layers.findIndex((l) => !l.hasData);
  if (freeIndex === -1) return;
  recordingTargetLayer = freeIndex;
  recorder.start();
  recToggle.setAttribute('aria-pressed', 'true');
  refreshLayerUI(freeIndex);
});

function stopRecording(): void {
  const samples = recorder.stop();
  recToggle.setAttribute('aria-pressed', 'false');
  const targetLayer = recordingTargetLayer;
  // Clear the target *before* refreshing the DOM: refreshLayerUI() reads
  // recordingTargetLayer to decide whether a layer is still "armed", and
  // must not see this now-finished layer as the recording target anymore.
  recordingTargetLayer = null;
  if (targetLayer !== null) {
    if (samples.length > 2) {
      layers[targetLayer].assign(samples);
    }
    refreshLayerUI(targetLayer);
  }
  updateRecToggleAvailability();
}

resetAll.addEventListener('click', () => {
  if (recorder.isRecording) {
    recorder.stop();
    recToggle.setAttribute('aria-pressed', 'false');
    recordingTargetLayer = null;
  }
  layers.forEach((layer, index) => {
    layer.clear();
    engine?.layerVoices[index].noteOff();
  });
  refreshAllLayersUI();
  updateRecToggleAvailability();
});

refreshAllLayersUI();
updateRecToggleAvailability();

// --- Readout formatting -------------------------------------------------------

function formatHz(freq: number): string {
  return `${freq.toFixed(1).padStart(6, '0')} Hz`;
}

function formatDb(db: number): string {
  const sign = db >= 0 ? '+' : '-';
  return `${sign}${Math.abs(db).toFixed(1).padStart(5, '0')} dB`;
}

// --- Aggregate sounding voices into one audio-visual state --------------------

interface Contribution {
  xNorm: number;
  gainLinear: number;
  speedNorm: number;
}

const visualState: AudioVisualState = { hue: 190, brightness: 0, turbulence: 0.1, energy: 0 };

function stepAudioVisuals(nowMs: number): void {
  const contributions: Contribution[] = [];

  if (pointerDown && engine) {
    const freq = xToFreq(pointerX);
    const gainDb = yToGainDb(pointerY);
    engine.liveVoice.update(freq, gainDb, pointerSpeedNorm);
    contributions.push({ xNorm: pointerX, gainLinear: dbToLinear(gainDb), speedNorm: pointerSpeedNorm });
    readoutHz.textContent = formatHz(freq);
    readoutDb.textContent = formatDb(gainDb);
    readoutHz.classList.add('readout__value--live');
    readoutDb.classList.add('readout__value--live');
  } else {
    readoutHz.classList.remove('readout__value--live');
    readoutDb.classList.remove('readout__value--live');
  }

  if (recorder.isRecording) {
    const autoStopped = recorder.push(pointerX, pointerY, pointerDown, pointerSpeedNorm);
    if (autoStopped) stopRecording();
  }

  if (engine) {
    for (let i = 0; i < LAYER_COUNT; i++) {
      const layer = layers[i];
      const voice: Voice = engine.layerVoices[i];
      if (!layer.hasData) continue;

      const sample: Sample | null = layer.sampleAt(nowMs);
      if (!sample) continue;

      const effectiveDown = sample.down && !layer.muted;
      const edge = layer.consumeDownEdge(effectiveDown);
      if (edge === 'on') voice.noteOn();
      if (edge === 'off') voice.noteOff();

      if (effectiveDown) {
        const freq = xToFreq(sample.x);
        const gainDb = yToGainDb(sample.y);
        voice.update(freq, gainDb, sample.speed);
        contributions.push({ xNorm: sample.x, gainLinear: dbToLinear(gainDb), speedNorm: sample.speed });
      }
    }
  }

  let targetHue = visualState.hue;
  let targetBrightness = 0;
  let targetTurbulence = 0.12; // gentle ambient drift even when silent
  let targetEnergy = 0;

  if (contributions.length > 0) {
    const totalGain = contributions.reduce((sum, c) => sum + c.gainLinear, 0);
    targetHue = contributions.reduce((sum, c) => sum + pitchToHue(c.xNorm) * c.gainLinear, 0) / totalGain;
    targetBrightness = clamp01(totalGain * 1.1);
    targetTurbulence = clamp01(Math.max(...contributions.map((c) => c.speedNorm), 0.12));
    targetEnergy = clamp01(totalGain * 1.3);
  }

  const smoothing = 0.09;
  visualState.hue += (targetHue - visualState.hue) * smoothing;
  visualState.brightness += (targetBrightness - visualState.brightness) * (smoothing * 1.4);
  visualState.turbulence += (targetTurbulence - visualState.turbulence) * (smoothing * 1.6);
  visualState.energy += (targetEnergy - visualState.energy) * (smoothing * 1.4);
}

// --- Main loop -----------------------------------------------------------------

let lastFrameTime = performance.now();

function frame(now: number): void {
  const dt = now - lastFrameTime;
  lastFrameTime = now;

  stepAudioVisuals(now);
  renderer.render(dt, visualState);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
