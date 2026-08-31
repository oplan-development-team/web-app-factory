import './style.css';
import { WaveField } from './lib/heightField';
import { computeNormal, shadeCell, type Vec3 } from './lib/color';
import { angularSpeed, lowPass, orientationToGravity, type Gravity } from './lib/tilt';

// ---------------------------------------------------------------------------
// DOM shell
// ---------------------------------------------------------------------------

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('missing #app root');

app.innerHTML = `
  <div class="stage">
    <div class="grain" aria-hidden="true"></div>

    <header class="hud-top">
      <div class="brand">
        <span class="brand-jp">液だまり</span>
        <span class="brand-en">Puddle Tilt</span>
      </div>
      <div class="status" id="status" data-state="off">
        <span class="status-dot"></span>
        <span id="status-text">POINTER ONLY</span>
      </div>
    </header>

    <main class="puddle-wrap">
      <div class="puddle-socket" id="socket">
        <canvas id="puddle-canvas"></canvas>
      </div>
    </main>

    <footer class="hud-bottom">
      <button type="button" class="glass-btn" id="tilt-btn">傾きを有効にする</button>
      <p class="hint" id="hint">なぞって波紋を起こす</p>
      <button type="button" class="glass-btn glass-btn--gold" id="export-btn">書き出す</button>
    </footer>

    <div class="onboarding" id="onboarding">
      <div class="onboarding-card">
        <p class="onboarding-title">液だまり</p>
        <p class="onboarding-body">
          指でなぞって波紋を起こす。<br />
          端末を傾ければ、水は低いほうへ流れていく。
        </p>
        <button type="button" class="glass-btn glass-btn--gold" id="onboarding-start">はじめる</button>
      </div>
    </div>
  </div>
`;

function required<T>(value: T | null, label: string): T {
  if (value === null) {
    throw new Error(`puddle-tilt: missing required element/context "${label}"`);
  }
  return value;
}

const canvas = required(document.querySelector<HTMLCanvasElement>('#puddle-canvas'), 'puddle-canvas');
const socket = required(document.querySelector<HTMLDivElement>('#socket'), 'socket');
const statusEl = required(document.querySelector<HTMLDivElement>('#status'), 'status');
const statusText = required(document.querySelector<HTMLSpanElement>('#status-text'), 'status-text');
const hintEl = required(document.querySelector<HTMLParagraphElement>('#hint'), 'hint');
const tiltBtn = required(document.querySelector<HTMLButtonElement>('#tilt-btn'), 'tilt-btn');
const exportBtn = required(document.querySelector<HTMLButtonElement>('#export-btn'), 'export-btn');
const onboarding = required(document.querySelector<HTMLDivElement>('#onboarding'), 'onboarding');
const onboardingStart = required(
  document.querySelector<HTMLButtonElement>('#onboarding-start'),
  'onboarding-start',
);

const ctx = required(canvas.getContext('2d', { alpha: true }), 'canvas-2d-context');

// ---------------------------------------------------------------------------
// Sizing
// ---------------------------------------------------------------------------

const MAX_DPR = 2;

function pickGridSize(displaySize: number): number {
  if (displaySize < 380) return 96;
  if (displaySize < 620) return 112;
  return 128;
}

let gridSize = 112;
let field = new WaveField({ size: gridSize });

const fieldCanvas = document.createElement('canvas');
const fieldCtx = required(fieldCanvas.getContext('2d', { alpha: true }), 'offscreen-2d-context');

function resize(): void {
  const wrap = socket.parentElement as HTMLElement;
  const available = Math.min(wrap.clientWidth, wrap.clientHeight);
  const next = Math.max(200, Math.min(560, available - 24));

  const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
  const bufferPx = Math.round(next * dpr);
  canvas.width = bufferPx;
  canvas.height = bufferPx;
  canvas.style.width = `${next}px`;
  canvas.style.height = `${next}px`;

  const nextGrid = pickGridSize(next);
  if (nextGrid !== gridSize) {
    gridSize = nextGrid;
    field = new WaveField({ size: gridSize });
    fieldCanvas.width = gridSize;
    fieldCanvas.height = gridSize;
  } else if (fieldCanvas.width !== gridSize) {
    fieldCanvas.width = gridSize;
    fieldCanvas.height = gridSize;
  }
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => window.setTimeout(resize, 60));
resize();

// ---------------------------------------------------------------------------
// Pointer interaction — always active, independent of tilt permission
// ---------------------------------------------------------------------------

let pointerActive = false;
let lastPointer: { x: number; y: number; t: number } | null = null;

function normalizedFromEvent(e: PointerEvent): { nx: number; ny: number; inside: boolean } | null {
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const nx = px / rect.width;
  const ny = py / rect.height;
  const dx = nx - 0.5;
  const dy = ny - 0.5;
  const inside = dx * dx + dy * dy <= 0.25; // within the visible circle
  return { nx, ny, inside };
}

const TAP_IMPULSE_STRENGTH = 3.4;
const DRAG_IMPULSE_GAIN = 0.14;
const IMPULSE_RADIUS_RATIO = 0.055;

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointerActive = true;
  const p = normalizedFromEvent(e);
  if (p && p.inside) {
    field.addImpulse(p.nx, p.ny, gridSize * IMPULSE_RADIUS_RATIO, TAP_IMPULSE_STRENGTH);
  }
  lastPointer = p ? { x: p.nx, y: p.ny, t: performance.now() } : null;
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointerActive) return;
  const p = normalizedFromEvent(e);
  if (!p || !p.inside) return;
  const now = performance.now();
  if (lastPointer) {
    const dt = Math.max(1, now - lastPointer.t);
    const speed = Math.hypot(p.nx - lastPointer.x, p.ny - lastPointer.y) / (dt / 1000);
    const strength = Math.min(6, speed * DRAG_IMPULSE_GAIN);
    if (strength > 0.05) {
      field.addImpulse(p.nx, p.ny, gridSize * IMPULSE_RADIUS_RATIO, strength);
    }
  }
  lastPointer = { x: p.nx, y: p.ny, t: now };
});

function releasePointer(): void {
  pointerActive = false;
  lastPointer = null;
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('pointerleave', releasePointer);

// ---------------------------------------------------------------------------
// Tilt input
// ---------------------------------------------------------------------------

type TiltState = 'idle' | 'requesting' | 'on' | 'unsupported' | 'denied';

let tiltState: TiltState = 'idle';
let rawBeta: number | null = null;
let rawGamma: number | null = null;
// Browsers without a real orientation sensor (most desktops) still fire a
// single deviceorientation event per the spec, but with beta/gamma left
// null — that must NOT be mistaken for genuine sensor data, or the "no
// sensor" fallback never triggers.
let receivedRealData = false;

function handleOrientation(e: DeviceOrientationEvent): void {
  rawBeta = e.beta;
  rawGamma = e.gamma;
  if (e.beta !== null && e.gamma !== null) {
    receivedRealData = true;
  }
}

function setTiltState(next: TiltState): void {
  tiltState = next;
  switch (next) {
    case 'idle':
      statusEl.dataset.state = 'off';
      statusText.textContent = 'POINTER ONLY';
      tiltBtn.disabled = false;
      tiltBtn.textContent = '傾きを有効にする';
      hintEl.textContent = 'なぞって波紋を起こす';
      hintEl.removeAttribute('data-tone');
      break;
    case 'requesting':
      statusEl.dataset.state = 'off';
      statusText.textContent = 'REQUESTING…';
      tiltBtn.disabled = true;
      tiltBtn.textContent = '確認中…';
      break;
    case 'on':
      statusEl.dataset.state = 'on';
      statusText.textContent = 'POINTER + TILT';
      tiltBtn.disabled = true;
      tiltBtn.textContent = '傾き: 有効';
      hintEl.textContent = '端末を傾けて水を流す';
      hintEl.removeAttribute('data-tone');
      break;
    case 'unsupported':
      statusEl.dataset.state = 'warn';
      statusText.textContent = 'TILT UNAVAILABLE';
      tiltBtn.disabled = true;
      tiltBtn.textContent = '非対応の環境です';
      hintEl.textContent = 'この端末はセンサーに対応していません。なぞって波紋を起こす';
      hintEl.dataset.tone = 'warn';
      break;
    case 'denied':
      statusEl.dataset.state = 'warn';
      statusText.textContent = 'PERMISSION DENIED';
      tiltBtn.disabled = false;
      tiltBtn.textContent = '再度許可を求める';
      hintEl.textContent = '傾きの許可が得られませんでした。なぞって波紋を起こす';
      hintEl.dataset.tone = 'warn';
      break;
  }
}

async function enableTilt(): Promise<void> {
  if (!('DeviceOrientationEvent' in window)) {
    setTiltState('unsupported');
    return;
  }
  setTiltState('requesting');

  const DOE = window.DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };

  if (typeof DOE.requestPermission === 'function') {
    try {
      const result = await DOE.requestPermission();
      if (result !== 'granted') {
        setTiltState('denied');
        return;
      }
    } catch {
      setTiltState('denied');
      return;
    }
  }

  window.addEventListener('deviceorientation', handleOrientation);

  // Some browsers (most desktops) expose the API and even fire one event,
  // but never with real beta/gamma values because there is no sensor —
  // fall back gracefully instead of claiming success.
  receivedRealData = false;
  window.setTimeout(() => {
    if (tiltState === 'requesting' || tiltState === 'on') {
      if (receivedRealData) {
        setTiltState('on');
      } else {
        window.removeEventListener('deviceorientation', handleOrientation);
        setTiltState('unsupported');
      }
    }
  }, 900);

  // Optimistically flip to "on" the moment we see real data too, so it
  // doesn't feel like it's stuck "requesting" for the full timeout.
  const checkInterval = window.setInterval(() => {
    if (receivedRealData) {
      window.clearInterval(checkInterval);
      if (tiltState === 'requesting') setTiltState('on');
    }
  }, 80);
}

tiltBtn.addEventListener('click', () => {
  void enableTilt();
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

onboardingStart.addEventListener('click', () => {
  onboarding.classList.add('is-hidden');
});

// ---------------------------------------------------------------------------
// PNG export
// ---------------------------------------------------------------------------

exportBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `puddle-tilt-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  exportBtn.classList.add('is-pressed');
  window.setTimeout(() => exportBtn.classList.remove('is-pressed'), 420);
});

// ---------------------------------------------------------------------------
// Simulation + render loop
// ---------------------------------------------------------------------------

const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 4;

let smoothedGravity: Gravity = { gx: 0, gy: 0 };
let prevGravityForAngular: Gravity = { gx: 0, gy: 0 };
let sloshCooldown = 0;
let phase = 0;
let ambientTime = 0;

const LIGHT: Vec3 = normalize({ x: 0.42, y: -0.55, z: 0.72 });

// A puddle left completely untouched settles to a perfectly flat height
// field, which reads as a single flat colour disc — dead, not gem-like. A
// tiny continuous forcing at a slowly drifting point keeps it visibly
// "breathing" (and cycling through the full teal/magenta/gold range) even
// when nobody is touching or tilting it.
const AMBIENT_FORCE_STRENGTH = 2.4;
const AMBIENT_RADIUS_RATIO = 0.18;

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function simulationStep(dt: number): void {
  const target = orientationToGravity(rawBeta, rawGamma);
  smoothedGravity = {
    gx: lowPass(smoothedGravity.gx, target.gx, 0.12),
    gy: lowPass(smoothedGravity.gy, target.gy, 0.12),
  };

  const angSpeed = angularSpeed(prevGravityForAngular, smoothedGravity, dt);
  prevGravityForAngular = smoothedGravity;

  const sloshBoost = 1 + Math.min(3, angSpeed * 3.2);

  sloshCooldown -= dt;
  if (angSpeed > 0.9 && sloshCooldown <= 0) {
    const gMag = Math.hypot(smoothedGravity.gx, smoothedGravity.gy) || 1;
    const dirX = smoothedGravity.gx / gMag;
    const dirY = smoothedGravity.gy / gMag;
    const nx = 0.5 + dirX * 0.32;
    const ny = 0.5 + dirY * 0.32;
    field.addImpulse(nx, ny, gridSize * 0.07, Math.min(2.2, angSpeed * 0.8));
    sloshCooldown = 0.12;
  }

  ambientTime += dt;
  const ambientX = 0.5 + 0.19 * Math.cos(ambientTime * 0.17);
  const ambientY = 0.5 + 0.19 * Math.sin(ambientTime * 0.23 + 1.3);
  field.addImpulse(ambientX, ambientY, gridSize * AMBIENT_RADIUS_RATIO, AMBIENT_FORCE_STRENGTH * dt);

  field.step(smoothedGravity.gx, smoothedGravity.gy, dt, sloshBoost);
  phase += dt * 0.07;
}

let imageData: ImageData | null = null;
let pixelBuffer: Uint8ClampedArray | null = null;

function renderField(): void {
  const n = gridSize;
  if (!imageData || imageData.width !== n) {
    imageData = fieldCtx.createImageData(n, n);
    pixelBuffer = imageData.data;
  }
  const heights = field.heights;
  const data = pixelBuffer as Uint8ClampedArray;

  for (let y = 0; y < n; y++) {
    const yUp = y > 0 ? y - 1 : 0;
    const yDown = y < n - 1 ? y + 1 : n - 1;
    for (let x = 0; x < n; x++) {
      const xLeft = x > 0 ? x - 1 : 0;
      const xRight = x < n - 1 ? x + 1 : n - 1;
      const idx = y * n + x;

      const h = heights[idx] as number;
      const left = heights[y * n + xLeft] as number;
      const right = heights[y * n + xRight] as number;
      const up = heights[yUp * n + x] as number;
      const down = heights[yDown * n + x] as number;

      const normal = computeNormal(left, right, up, down, 3.2);
      const [r, g, b] = shadeCell({ height: h, normal, light: LIGHT, phase });

      const p = idx * 4;
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = 255;
    }
  }

  fieldCtx.putImageData(imageData, 0, 0);

  const size = canvas.width;
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fieldCanvas, 0, 0, n, n, 0, 0, size, size);

  // Overhead "spotlight" sheen — the gem-under-a-light read.
  const sheen = ctx.createRadialGradient(
    size * 0.32,
    size * 0.26,
    0,
    size * 0.32,
    size * 0.26,
    size * 0.9,
  );
  sheen.addColorStop(0, 'rgba(255,255,255,0.10)');
  sheen.addColorStop(0.4, 'rgba(255,255,255,0.02)');
  sheen.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);

  // Inner rim shadow to seat the puddle into its socket.
  const rim = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.42,
    size / 2,
    size / 2,
    size * 0.5,
  );
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, size, size);

  ctx.restore();
}

let lastTime = performance.now();
let accumulator = 0;
let firstFrame = true;

function frame(now: number): void {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
    simulationStep(FIXED_DT);
    accumulator -= FIXED_DT;
    steps++;
  }

  renderField();

  if (firstFrame) {
    firstFrame = false;
    socket.classList.add('is-ready');
  }

  requestAnimationFrame(frame);
}

// A gentle initial ripple so the surface isn't perfectly static on load.
field.addImpulse(0.5, 0.5, gridSize * 0.12, 1.6);

requestAnimationFrame(frame);
