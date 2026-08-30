import './style.css';
import { estimateFrequencyHz, type PlateShape } from './chladni';
import {
  createParticles,
  resizeParticles,
  scatterInPlace,
  stepParticles,
  type Particle,
} from './particles';
import { downloadPng, downloadSvg, makeSerial, makeTimestamp } from './poster';

// ---------------------------------------------------------------- elements

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;

const canvas = $<HTMLCanvasElement>('#simCanvas');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D context unavailable');

const nSlider = $<HTMLInputElement>('#nSlider');
const mSlider = $<HTMLInputElement>('#mSlider');
const nValue = $<HTMLElement>('#nValue');
const mValue = $<HTMLElement>('#mValue');

const sizeSlider = $<HTMLInputElement>('#sizeSlider');
const sizeValue = $<HTMLElement>('#sizeValue');
const sizeLabel = $<HTMLElement>('#sizeLabel');

const amplitudeSlider = $<HTMLInputElement>('#amplitudeSlider');
const driveSlider = $<HTMLInputElement>('#driveSlider');
const amplitudeValue = $<HTMLElement>('#amplitudeValue');
const driveValue = $<HTMLElement>('#driveValue');

const shapeSquareBtn = $<HTMLButtonElement>('#shapeSquareBtn');
const shapeCircleBtn = $<HTMLButtonElement>('#shapeCircleBtn');
const densityBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-density]'));

const retryBtn = $<HTMLButtonElement>('#retryBtn');
const exportPngBtn = $<HTMLButtonElement>('#exportPngBtn');
const exportSvgBtn = $<HTMLButtonElement>('#exportSvgBtn');

const freqValue = $<HTMLElement>('#freqValue');
const hudMode = $<HTMLElement>('#hudMode');
const hudShape = $<HTMLElement>('#hudShape');
const loadingOverlay = $<HTMLElement>('#loadingOverlay');

const statusDot = $<HTMLElement>('#statusDot');
const statusText = $<HTMLElement>('#statusText');

const toast = $<HTMLElement>('#toast');

// ---------------------------------------------------------------- state

const DENSITY_COUNTS: Record<string, number> = {
  coarse: 2000,
  standard: 3500,
  dense: 5000,
};

interface AppState {
  targetN: number;
  targetM: number;
  currentN: number;
  currentM: number;
  shape: PlateShape;
  sizeMm: number;
  amplitude: number; // 0..1
  drive: number; // 0..1
  density: string;
}

const state: AppState = {
  targetN: 3,
  targetM: 5,
  currentN: 3,
  currentM: 5,
  shape: 'square',
  sizeMm: 220,
  amplitude: 0.6,
  drive: 0.55,
  density: 'standard',
};

let particles: Particle[] = createParticles(DENSITY_COUNTS[state.density], state.shape);
let isTransitioning = false;
let isExporting = false;

// ---------------------------------------------------------------- canvas sizing

function resizeCanvas() {
  // canvas is absolutely positioned (100% of its frame) so its own rect is
  // stable and never feeds back into the parent's layout size — measuring
  // the parent directly here could create a resize/layout feedback loop.
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const resizeObserver = new ResizeObserver(() => resizeCanvas());
resizeObserver.observe(canvas.parentElement!);
resizeCanvas();

// ---------------------------------------------------------------- helpers

function plateRect() {
  const rect = canvas.getBoundingClientRect();
  const pad = 36;
  const size = Math.min(rect.width, rect.height) - pad * 2;
  const left = (rect.width - size) / 2;
  const top = (rect.height - size) / 2;
  return { left, top, size };
}

function toCanvasCoords(x: number, y: number, rect: { left: number; top: number; size: number }) {
  return {
    px: rect.left + ((x + 1) / 2) * rect.size,
    py: rect.top + ((y + 1) / 2) * rect.size,
  };
}

function setStatus(mode: 'standby' | 'live' | 'busy', label: string) {
  statusDot.classList.remove('is-live', 'is-busy');
  if (mode === 'live') statusDot.classList.add('is-live');
  if (mode === 'busy') statusDot.classList.add('is-busy');
  statusText.textContent = label;
}

let toastTimer: number | undefined;
function showToast(message: string, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('is-error', isError);
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function updateFrequencyReadout() {
  const f = estimateFrequencyHz(state.targetN, state.targetM, state.sizeMm);
  freqValue.textContent = `${f.toFixed(1)} Hz`;
}

function updateHud() {
  hudMode.textContent = `n=${state.targetN} m=${state.targetM}`;
  hudShape.textContent = `${state.shape === 'square' ? 'SQUARE' : 'CIRCLE'} · ${state.sizeMm}mm`;
}

function updateSizeLabel() {
  sizeLabel.textContent = state.shape === 'square' ? 'SIDE LENGTH' : 'DIAMETER';
  sizeValue.textContent = `${state.sizeMm} mm`;
}

// ---------------------------------------------------------------- controls

nSlider.addEventListener('input', () => {
  state.targetN = Number(nSlider.value);
  nValue.textContent = String(state.targetN);
  updateFrequencyReadout();
  updateHud();
});

mSlider.addEventListener('input', () => {
  state.targetM = Number(mSlider.value);
  mValue.textContent = String(state.targetM);
  updateFrequencyReadout();
  updateHud();
});

sizeSlider.addEventListener('input', () => {
  state.sizeMm = Number(sizeSlider.value);
  updateSizeLabel();
  updateFrequencyReadout();
  updateHud();
});

amplitudeSlider.addEventListener('input', () => {
  state.amplitude = Number(amplitudeSlider.value) / 100;
  amplitudeValue.textContent = amplitudeSlider.value;
});

driveSlider.addEventListener('input', () => {
  state.drive = Number(driveSlider.value) / 100;
  driveValue.textContent = driveSlider.value;
});

function setShape(shape: PlateShape) {
  if (shape === state.shape) return;
  state.shape = shape;
  shapeSquareBtn.classList.toggle('is-active', shape === 'square');
  shapeCircleBtn.classList.toggle('is-active', shape === 'circle');
  updateSizeLabel();
  updateHud();
  // structural domain change — reseed particles across the new plate shape
  particles = createParticles(particles.length, state.shape);
}

shapeSquareBtn.addEventListener('click', () => setShape('square'));
shapeCircleBtn.addEventListener('click', () => setShape('circle'));

densityBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const density = btn.dataset.density!;
    state.density = density;
    densityBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
    particles = resizeParticles(particles, DENSITY_COUNTS[density], state.shape);
  });
});

retryBtn.addEventListener('click', () => {
  const nextN = 1 + Math.floor(Math.random() * 9);
  const nextM = 1 + Math.floor(Math.random() * 9);
  state.targetN = nextN;
  state.targetM = nextM;
  nSlider.value = String(nextN);
  mSlider.value = String(nextM);
  nValue.textContent = String(nextN);
  mValue.textContent = String(nextM);
  updateFrequencyReadout();
  updateHud();

  retryBtn.classList.add('is-spinning');
  window.setTimeout(() => retryBtn.classList.remove('is-spinning'), 650);
  scatterInPlace(particles, state.shape, 0.55);
  setStatus('busy', 'RE-ARMING');
  showToast('EXPERIMENT RETRY — new mode selected');
});

// ---------------------------------------------------------------- export

function currentInfo() {
  return {
    n: state.targetN,
    m: state.targetM,
    shape: state.shape,
    sizeMm: state.sizeMm,
    frequencyHz: estimateFrequencyHz(state.targetN, state.targetM, state.sizeMm),
    serial: makeSerial(),
    timestamp: makeTimestamp(),
    approxNote:
      state.shape === 'circle'
        ? 'Square displacement field, circular-boundary clip (approx.)'
        : 'Standard Chladni free-plate mode equation',
  };
}

async function withExportState(btn: HTMLButtonElement, label: string, run: () => void | Promise<void>) {
  if (isExporting) return;
  isExporting = true;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'PROCESSING…';
  setStatus('busy', 'EXPORTING');
  try {
    // small minimum delay so the busy state is perceivable even when the
    // work itself is fast; the busy state also stays up for the full
    // duration of slower work (e.g. encoding a large PNG canvas)
    const minDelay = new Promise((resolve) => window.setTimeout(resolve, 380));
    await Promise.all([minDelay, run()]);
    showToast(`${label} EXPORT COMPLETE`);
  } catch (err) {
    console.error(err);
    showToast(`${label} EXPORT FAILED — ${(err as Error).message ?? 'unknown error'}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
    isExporting = false;
    setStatus('live', 'LIVE');
  }
}

exportPngBtn.addEventListener('click', () => {
  void withExportState(exportPngBtn, 'PNG', () => downloadPng(particles, currentInfo(), 2));
});

exportSvgBtn.addEventListener('click', () => {
  void withExportState(exportSvgBtn, 'SVG', () => {
    downloadSvg(currentInfo());
  });
});

// ---------------------------------------------------------------- main loop

let lastTime = performance.now();
let loadPhaseElapsed = 0;
const LOAD_PHASE_MS = 1500;
let loadingHidden = false;

function drawPlateOutline(rect: { left: number; top: number; size: number }) {
  ctx!.save();
  ctx!.strokeStyle = 'rgba(57, 255, 106, 0.35)';
  ctx!.lineWidth = 1.5;
  if (state.shape === 'circle') {
    ctx!.beginPath();
    ctx!.arc(rect.left + rect.size / 2, rect.top + rect.size / 2, rect.size / 2, 0, Math.PI * 2);
    ctx!.stroke();
  } else {
    ctx!.strokeRect(rect.left, rect.top, rect.size, rect.size);
  }
  ctx!.restore();
}

function frame(now: number) {
  const elapsed = now - lastTime;
  // normalize to a stable simulation timestep regardless of display refresh rate
  const stepDt = Math.min(1.4, Math.max(0.2, elapsed / (1000 / 60)));
  lastTime = now;

  // animate n/m toward target for a smooth mode transition
  const prevTransitioning = isTransitioning;
  const dn = state.targetN - state.currentN;
  const dm = state.targetM - state.currentM;
  state.currentN += dn * 0.06;
  state.currentM += dm * 0.06;
  isTransitioning = Math.abs(dn) > 0.01 || Math.abs(dm) > 0.01;
  if (isTransitioning && !prevTransitioning) setStatus('busy', 'SETTLING');
  if (!isTransitioning && prevTransitioning) setStatus('live', 'LIVE');

  stepParticles(
    particles,
    {
      shape: state.shape,
      n: state.currentN,
      m: state.currentM,
      drive: state.drive,
      amplitude: state.amplitude,
    },
    stepDt
  );

  const rect = plateRect();
  ctx!.clearRect(0, 0, canvas.width, canvas.height);
  ctx!.fillStyle = '#0c100d';
  ctx!.fillRect(0, 0, canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height);

  drawPlateOutline(rect);

  ctx!.fillStyle = '#39ff6a';
  ctx!.shadowColor = 'rgba(57, 255, 106, 0.55)';
  ctx!.shadowBlur = 1.4;
  for (const p of particles) {
    const { px, py } = toCanvasCoords(p.x, p.y, rect);
    ctx!.globalAlpha = 0.85;
    ctx!.fillRect(px - 0.9, py - 0.9, 1.8, 1.8);
  }
  ctx!.globalAlpha = 1;
  ctx!.shadowBlur = 0;

  if (!loadingHidden) {
    loadPhaseElapsed += elapsed;
    if (loadPhaseElapsed > LOAD_PHASE_MS) {
      loadingHidden = true;
      loadingOverlay.classList.add('is-hidden');
      setStatus('live', 'LIVE');
    }
  }

  requestAnimationFrame(frame);
}

updateFrequencyReadout();
updateHud();
updateSizeLabel();
setStatus('busy', 'INITIALIZING');
requestAnimationFrame(frame);
