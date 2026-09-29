import './style.css';
import { LavaSimulation } from './lib/simulation';
import { LampRenderer } from './ui/lampRenderer';
import { createKnob, type KnobHandle } from './ui/knob';
import { lampCapSvg, lampBaseSvg } from './ui/lampChrome';
import { recordWebm, recordGif } from './ui/exportManager';

interface Preset {
  name: string;
  label: string;
  hue: number;
}

const PRESETS: Preset[] = [
  { name: 'amber', label: 'クラシック橙', hue: 28 },
  { name: 'psych', label: 'サイケ紫', hue: 280 },
  { name: 'retro', label: 'レトログリーン', hue: 140 },
];

const DEFAULT_PARAMS = {
  hue: 28,
  viscosity: 0.42,
  heat: 0.55,
  dropletCount: 6,
};

const app = document.getElementById('app');
if (!app) throw new Error('#app root not found');

app.innerHTML = `
  <header class="brand">
    <h1 class="brand__title">LAVA LAMP STUDIO</h1>
    <p class="brand__subtitle">Retro Fluid Chamber &middot; Est. Simulated 1968</p>
  </header>

  <div class="studio">
    <div class="lamp">
      ${lampCapSvg()}
      <div class="lamp__glass-wrap" id="glass-wrap">
        <canvas class="lamp__canvas" id="sim-canvas" aria-label="シミュレーションされたラバランプの液体。クリックで熱パルスを注入できます。"></canvas>
        <div class="lamp__glass-sheen"></div>
      </div>
      ${lampBaseSvg()}
    </div>

    <div class="console">
      <p class="console__label">Control Console</p>
      <div class="knob-grid" id="knob-grid"></div>

      <div class="presets" id="presets" role="group" aria-label="色相クイックプリセット"></div>

      <div class="export-panel">
        <div class="export-row">
          <label class="sr-only" for="duration-select">書き出し秒数</label>
          <select class="export-select" id="duration-select">
            <option value="4">4秒</option>
            <option value="8" selected>8秒</option>
            <option value="12">12秒</option>
          </select>
        </div>
        <div class="export-row">
          <button class="export-btn" id="webm-btn" type="button" data-state="idle">
            <span class="rec-dot"></span>
            <span class="export-btn__label">WebM書き出し</span>
            <span class="export-btn__progress"></span>
          </button>
        </div>
        <div class="export-row">
          <button class="export-btn" id="gif-btn" type="button" data-state="idle">
            <span class="rec-dot"></span>
            <span class="export-btn__label">GIF書き出し</span>
            <span class="export-btn__progress"></span>
          </button>
        </div>
        <p class="export-status" id="export-status" role="status" aria-live="polite"></p>
      </div>
    </div>
  </div>

  <p class="disclaimer">
    ※ WebM/GIFは指定秒数のクリップをその場で録画・書き出しします。液体の動きは連続シミュレーションのため、
    クリップの先頭と末尾が完全に一致する物理的なシームレスループは保証されません。
  </p>
`;

const canvas = document.getElementById('sim-canvas') as HTMLCanvasElement;
const glassWrap = document.getElementById('glass-wrap') as HTMLDivElement;
const knobGrid = document.getElementById('knob-grid') as HTMLDivElement;
const presetsRow = document.getElementById('presets') as HTMLDivElement;
const durationSelect = document.getElementById('duration-select') as HTMLSelectElement;
const webmBtn = document.getElementById('webm-btn') as HTMLButtonElement;
const gifBtn = document.getElementById('gif-btn') as HTMLButtonElement;
const exportStatus = document.getElementById('export-status') as HTMLParagraphElement;

const sim = new LavaSimulation({ ...DEFAULT_PARAMS });
const renderer = new LampRenderer(canvas);

// --- Hue <-> CSS custom property + preset active state -------------------
let activePreset: string | null = 'amber';
let settingHueFromPreset = false;

function applyHueToDom(hue: number): void {
  document.documentElement.style.setProperty('--lamp-hue', String(hue));
}

function setActivePreset(name: string | null): void {
  activePreset = name;
  presetsRow.querySelectorAll<HTMLButtonElement>('.preset-btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.preset === name));
  });
}

function handleHueChange(v: number): void {
  sim.setParams({ hue: v });
  applyHueToDom(v);
  if (!settingHueFromPreset) setActivePreset(null);
}

// --- Knobs -----------------------------------------------------------------
const hueKnob: KnobHandle = createKnob({
  label: 'HUE',
  min: 0,
  max: 360,
  step: 1,
  value: DEFAULT_PARAMS.hue,
  format: (v) => `${Math.round(v)}°`,
  onChange: handleHueChange,
});

const viscosityKnob: KnobHandle = createKnob({
  label: 'VISCOSITY',
  min: 0,
  max: 1,
  step: 0.01,
  value: DEFAULT_PARAMS.viscosity,
  format: (v) => `${Math.round(v * 100)}%`,
  onChange: (v) => sim.setParams({ viscosity: v }),
});

const heatKnob: KnobHandle = createKnob({
  label: 'HEAT',
  min: 0,
  max: 1,
  step: 0.01,
  value: DEFAULT_PARAMS.heat,
  format: (v) => `${Math.round(v * 100)}%`,
  onChange: (v) => sim.setParams({ heat: v }),
});

const dropletKnob: KnobHandle = createKnob({
  label: 'DROPLETS',
  min: 4,
  max: 10,
  step: 1,
  value: DEFAULT_PARAMS.dropletCount,
  format: (v) => `${Math.round(v)}`,
  onChange: (v) => sim.setParams({ dropletCount: Math.round(v) }),
});

[hueKnob, viscosityKnob, heatKnob, dropletKnob].forEach((k) => knobGrid.appendChild(k.element));
applyHueToDom(DEFAULT_PARAMS.hue);

// --- Presets -----------------------------------------------------------------
for (const preset of PRESETS) {
  const btn = document.createElement('button');
  btn.className = 'preset-btn';
  btn.type = 'button';
  btn.dataset.preset = preset.name;
  btn.setAttribute('aria-pressed', String(preset.name === activePreset));
  btn.innerHTML = `<span class="preset-btn__swatch" style="background:hsl(${preset.hue} 82% 52%); color:hsl(${preset.hue} 82% 52%);"></span>${preset.label}`;
  btn.addEventListener('click', () => {
    settingHueFromPreset = true;
    hueKnob.setValue(preset.hue);
    settingHueFromPreset = false;
    setActivePreset(preset.name);
  });
  presetsRow.appendChild(btn);
}

// --- Glass click -> temperature pulse + immediate visual feedback ---------
glassWrap.addEventListener('pointerdown', (e: PointerEvent) => {
  const rect = canvas.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = (e.clientY - rect.top) / rect.height;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
  sim.addPulse(nx, ny);
  renderer.addRipple(nx, ny);
});

// --- Export: WebM / GIF, each with idle/working/done states ---------------
type BtnState = 'idle' | 'working' | 'done';

function setButtonState(btn: HTMLButtonElement, state: BtnState, label: string): void {
  btn.dataset.state = state;
  btn.disabled = state === 'working';
  const labelEl = btn.querySelector('.export-btn__label');
  if (labelEl) labelEl.textContent = label;
}

function setProgress(btn: HTMLButtonElement, fraction: number): void {
  const bar = btn.querySelector<HTMLElement>('.export-btn__progress');
  if (bar) bar.style.width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
}

function setStatus(message: string, tone: 'neutral' | 'success' | 'error' = 'neutral'): void {
  exportStatus.textContent = message;
  exportStatus.dataset.tone = tone;
}

webmBtn.addEventListener('click', () => {
  if (webmBtn.dataset.state === 'working') return;
  const duration = Number(durationSelect.value);
  setButtonState(webmBtn, 'working', `録画中… (${duration}秒)`);
  setProgress(webmBtn, 0);
  setStatus('WebMを録画しています…');

  recordWebm(canvas, duration, {
    onProgress: (f) => setProgress(webmBtn, f),
    onDone: (filename) => {
      setButtonState(webmBtn, 'done', 'ダウンロード済み ✓');
      setProgress(webmBtn, 1);
      setStatus(`保存しました: ${filename}`, 'success');
      window.setTimeout(() => {
        setButtonState(webmBtn, 'idle', 'WebM書き出し');
        setProgress(webmBtn, 0);
      }, 3200);
    },
    onError: (message) => {
      setButtonState(webmBtn, 'idle', 'WebM書き出し');
      setProgress(webmBtn, 0);
      setStatus(message, 'error');
    },
  });
});

gifBtn.addEventListener('click', () => {
  if (gifBtn.dataset.state === 'working') return;
  const duration = Number(durationSelect.value);
  setButtonState(gifBtn, 'working', 'エンコード中… 0%');
  setProgress(gifBtn, 0);
  setStatus('GIFを書き出しています…');

  recordGif(canvas, duration, {
    onProgress: (f) => {
      setProgress(gifBtn, f);
      setButtonState(gifBtn, 'working', `エンコード中… ${Math.round(f * 100)}%`);
    },
    onDone: (filename) => {
      setButtonState(gifBtn, 'done', 'ダウンロード済み ✓');
      setProgress(gifBtn, 1);
      setStatus(`保存しました: ${filename}`, 'success');
      window.setTimeout(() => {
        setButtonState(gifBtn, 'idle', 'GIF書き出し');
        setProgress(gifBtn, 0);
      }, 3200);
    },
    onError: (message) => {
      setButtonState(gifBtn, 'idle', 'GIF書き出し');
      setProgress(gifBtn, 0);
      setStatus(message, 'error');
    },
  });
});

// --- Simulation loop --------------------------------------------------------
let lastTime = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 1 / 20);
  lastTime = now;
  sim.step(dt);
  renderer.render(sim, sim.params.hue, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
