import { DEFAULT_INK, DEFAULT_INK_2, DEFAULT_INK_2_LIGHT, DEFAULT_INK_LIGHT, PAPERS } from './constants';
import { BASE_INK_WIDTH_MM, HarmonographRenderer, computeGeometry, type RenderProgress } from './renderer';
import { downloadBlob, renderHighResPNG } from './pngExport';
import { PRESETS, generateRandomConfig, instantiatePreset, nextPendulumId } from './presets';
import { buildHarmonographSVG, downloadTextFile } from './svgExport';
import type { AppState, Pendulum, PaperType } from './types';

const PARAM_DEFS = [
  { key: 'frequency', label: '周波数', min: 0.2, max: 12, step: 0.01 },
  { key: 'decay', label: '減衰率', min: 0, max: 1.2, step: 0.001 },
  { key: 'phaseDeg', label: '位相 (°)', min: 0, max: 360, step: 0.5 },
  { key: 'amplitude', label: '振幅', min: 1, max: 100, step: 0.5 },
  { key: 'angleDeg', label: '角度 (°)', min: 0, max: 360, step: 0.5 },
] as const satisfies readonly { key: keyof Omit<Pendulum, 'id'>; label: string; min: number; max: number; step: number }[];

const MIN_PENDULUMS = 2;
const MAX_PENDULUMS = 5;

function formatNumber(n: number): string {
  return n.toFixed(n < 10 ? 3 : 2).replace(/0+$/, '').replace(/\.$/, '.0');
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildSkeleton(): string {
  return `
    <div class="stage">
      <header class="masthead">
        <div class="masthead__plate">
          <h1 class="masthead__title">ハーモノグラフ・ジェネレーター</h1>
          <p class="masthead__subtitle">振り子の詩</p>
        </div>
        <p class="masthead__tagline">DAMPED PENDULUM SYNTHESIS &mdash; INK PLOTTER CONSOLE</p>
      </header>

      <main class="console">
        <aside class="panel panel--pendulums">
          <h2 class="panel__heading">プリセット</h2>
          <div class="preset-grid" id="presetGrid"></div>
          <button class="brass-button brass-button--dice" id="randomizeBtn" type="button">
            <span class="brass-button__icon" aria-hidden="true">&#10227;</span> 乱数生成
          </button>

          <div class="panel__header-row panel__header-row--spaced">
            <h2 class="panel__heading panel__heading--flush">振り子構成</h2>
            <div class="pendulum-count-controls">
              <button id="removePendulum" class="brass-icon-btn" type="button" aria-label="振り子を削除">&minus;</button>
              <span id="pendulumCountLabel" class="mono-readout"></span>
              <button id="addPendulum" class="brass-icon-btn" type="button" aria-label="振り子を追加">+</button>
            </div>
          </div>
          <div id="pendulumList" class="pendulum-list"></div>
        </aside>

        <section class="drawing-desk">
          <div class="paper-wrapper">
            <span class="paper-pin paper-pin--left" aria-hidden="true"></span>
            <span class="paper-pin paper-pin--right" aria-hidden="true"></span>
            <div class="paper" id="paper">
              <canvas id="inkCanvas"></canvas>
              <canvas id="tipCanvas"></canvas>
            </div>
          </div>
          <div class="status-bar">
            <div class="status-bar__gauge">
              <div class="status-bar__fill" id="progressFill"></div>
            </div>
            <span class="status-bar__label mono-readout" id="progressLabel">待機中</span>
          </div>
        </section>

        <aside class="panel panel--settings">
          <h2 class="panel__heading">描画設定</h2>
          <div class="field">
            <label for="periodsSlider">継続時間 (周期数) <span class="mono-readout" id="periodsValue"></span></label>
            <input type="range" id="periodsSlider" min="4" max="30" step="1" />
          </div>
          <div class="field">
            <label for="traceSecondsSlider">トレース時間 (秒/パス) <span class="mono-readout" id="traceSecondsValue"></span></label>
            <input type="range" id="traceSecondsSlider" min="2" max="15" step="0.5" />
          </div>
          <div class="field field--toggle">
            <label class="toggle">
              <input type="checkbox" id="animateToggle" />
              <span class="toggle__track"></span>
              <span class="toggle__label">トレース・アニメーション (OFFで即時全描画)</span>
            </label>
          </div>

          <h2 class="panel__heading panel__heading--spaced">紙面</h2>
          <div class="paper-swatches" id="paperSwatches"></div>

          <h2 class="panel__heading panel__heading--spaced">インク</h2>
          <div class="field field--inline">
            <label for="inkColorPicker">インク色</label>
            <input type="color" id="inkColorPicker" />
          </div>
          <div class="field field--toggle">
            <label class="toggle">
              <input type="checkbox" id="twoPassToggle" />
              <span class="toggle__track"></span>
              <span class="toggle__label">2パス (2色ペン切替)</span>
            </label>
          </div>
          <div class="field field--inline" id="inkColor2Field" hidden>
            <label for="inkColor2Picker">2色目 (パス2)</label>
            <input type="color" id="inkColor2Picker" />
          </div>

          <h2 class="panel__heading panel__heading--spaced">書き出し</h2>
          <div class="field">
            <label for="rdpSlider">SVG簡略化許容誤差 (mm) <span class="mono-readout" id="rdpValue"></span></label>
            <input type="range" id="rdpSlider" min="0.02" max="1.2" step="0.02" />
          </div>
          <div class="export-buttons">
            <button class="brass-button" id="exportSvg" type="button">SVG書き出し (プロッター用)</button>
            <button class="brass-button" id="exportPng2000" type="button">PNG書き出し 2000px</button>
            <button class="brass-button" id="exportPng4000" type="button">PNG書き出し 4000px</button>
          </div>
        </aside>
      </main>

      <footer class="footnote">
        <p>減衰正弦波の合成による簡易モデルです。実振り子の厳密な物理演算(ラグランジュ方程式・空気抵抗・支点摩擦係数)は再現していません。</p>
      </footer>
    </div>
  `;
}

export function initApp(root: HTMLElement): void {
  const initial = instantiatePreset(PRESETS[0] ?? PRESETS[0]!);
  const state: AppState = {
    pendulums: initial.pendulums,
    periods: initial.periods,
    traceSeconds: 6,
    animate: true,
    paper: 'kinari',
    inkColor: DEFAULT_INK,
    twoPass: false,
    inkColor2: DEFAULT_INK_2,
    rdpTolerance: 0.15,
  };
  let selectedPresetId: string | null = PRESETS[0]?.id ?? null;

  root.innerHTML = buildSkeleton();

  const q = <T extends HTMLElement>(sel: string): T => {
    const node = root.querySelector<T>(sel);
    if (!node) throw new Error(`要素が見つかりません: ${sel}`);
    return node;
  };

  const presetGrid = q<HTMLDivElement>('#presetGrid');
  const randomizeBtn = q<HTMLButtonElement>('#randomizeBtn');
  const pendulumList = q<HTMLDivElement>('#pendulumList');
  const pendulumCountLabel = q<HTMLSpanElement>('#pendulumCountLabel');
  const addPendulumBtn = q<HTMLButtonElement>('#addPendulum');
  const removePendulumBtn = q<HTMLButtonElement>('#removePendulum');

  const paperEl = q<HTMLDivElement>('#paper');
  const inkCanvas = q<HTMLCanvasElement>('#inkCanvas');
  const tipCanvas = q<HTMLCanvasElement>('#tipCanvas');
  const progressFill = q<HTMLDivElement>('#progressFill');
  const progressLabel = q<HTMLSpanElement>('#progressLabel');

  const periodsSlider = q<HTMLInputElement>('#periodsSlider');
  const periodsValue = q<HTMLSpanElement>('#periodsValue');
  const traceSecondsSlider = q<HTMLInputElement>('#traceSecondsSlider');
  const traceSecondsValue = q<HTMLSpanElement>('#traceSecondsValue');
  const animateToggle = q<HTMLInputElement>('#animateToggle');

  const paperSwatches = q<HTMLDivElement>('#paperSwatches');
  const inkColorPicker = q<HTMLInputElement>('#inkColorPicker');
  const twoPassToggle = q<HTMLInputElement>('#twoPassToggle');
  const inkColor2Field = q<HTMLDivElement>('#inkColor2Field');
  const inkColor2Picker = q<HTMLInputElement>('#inkColor2Picker');
  const rdpSlider = q<HTMLInputElement>('#rdpSlider');
  const rdpValue = q<HTMLSpanElement>('#rdpValue');

  const exportSvgBtn = q<HTMLButtonElement>('#exportSvg');
  const exportPng2000Btn = q<HTMLButtonElement>('#exportPng2000');
  const exportPng4000Btn = q<HTMLButtonElement>('#exportPng4000');

  const renderer = new HarmonographRenderer(inkCanvas, tipCanvas);

  function updateProgress(p: RenderProgress): void {
    const passLabel = p.totalPasses === 2 ? `パス ${p.pass}/2` : 'パス 1';
    const pct = Math.round(p.fraction * 100);
    progressFill.style.width = `${pct}%`;
    progressLabel.textContent = p.done ? `描画完了 — ${passLabel}` : `描画中 — ${passLabel} — ${pct}%`;
  }

  let dirty = false;
  function scheduleRender(): void {
    if (dirty) return;
    dirty = true;
    requestAnimationFrame(() => {
      dirty = false;
      doRender();
    });
  }

  function doRender(): void {
    const geometry = computeGeometry(state);
    if (state.animate) {
      renderer.startTrace(state, geometry, state.traceSeconds, updateProgress);
    } else {
      renderer.instantDraw(state, geometry);
      updateProgress({ pass: 1, totalPasses: state.twoPass ? 2 : 1, fraction: 1, done: true });
    }
  }

  function sizePaper(): void {
    const cssSize = paperEl.clientWidth;
    if (cssSize > 0) renderer.resize(cssSize);
  }

  // --- プリセット -----------------------------------------------------
  function renderPresetGrid(): void {
    presetGrid.innerHTML = '';
    for (const preset of PRESETS) {
      const btn = el('button', 'preset-btn', undefined);
      btn.type = 'button';
      btn.dataset.presetId = preset.id;
      btn.setAttribute('aria-pressed', String(preset.id === selectedPresetId));
      if (preset.id === selectedPresetId) btn.classList.add('is-active');

      const name = el('span', 'preset-btn__name', preset.name);
      const desc = el('span', 'preset-btn__desc', preset.description);
      btn.append(name, desc);

      btn.addEventListener('click', () => {
        selectedPresetId = preset.id;
        const inst = instantiatePreset(preset);
        state.pendulums = inst.pendulums;
        state.periods = inst.periods;
        periodsSlider.value = String(state.periods);
        periodsValue.textContent = String(state.periods);
        renderPresetGrid();
        renderPendulumList();
        scheduleRender();
      });

      presetGrid.appendChild(btn);
    }
  }

  randomizeBtn.addEventListener('click', () => {
    selectedPresetId = null;
    const generated = generateRandomConfig();
    state.pendulums = generated.pendulums;
    state.periods = generated.periods;
    periodsSlider.value = String(state.periods);
    periodsValue.textContent = String(state.periods);
    renderPresetGrid();
    renderPendulumList();
    scheduleRender();
  });

  // --- 振り子リスト -----------------------------------------------------
  function createPendulumModule(pendulum: Pendulum, index: number): HTMLDivElement {
    const module = el('div', 'pendulum-module');
    module.dataset.id = pendulum.id;

    const header = el('div', 'pendulum-module__header');
    header.append(el('span', 'pendulum-module__index', `振り子 ${String(index + 1).padStart(2, '0')}`));
    module.appendChild(header);

    for (const def of PARAM_DEFS) {
      const field = el('div', 'field field--compact');
      const label = el('label', undefined, undefined);
      label.textContent = def.label + ' ';
      const valueSpan = el('span', 'mono-readout', formatNumber(pendulum[def.key]));
      label.appendChild(valueSpan);
      const input = el('input', undefined) as HTMLInputElement;
      input.type = 'range';
      input.min = String(def.min);
      input.max = String(def.max);
      input.step = String(def.step);
      input.value = String(pendulum[def.key]);
      input.addEventListener('input', () => {
        const val = Number(input.value);
        (pendulum[def.key] as number) = val;
        valueSpan.textContent = formatNumber(val);
        selectedPresetId = null;
        renderPresetGrid();
        scheduleRender();
      });
      field.append(label, input);
      module.appendChild(field);
    }

    return module;
  }

  function renderPendulumList(): void {
    pendulumList.innerHTML = '';
    state.pendulums.forEach((p, i) => {
      pendulumList.appendChild(createPendulumModule(p, i));
    });
    pendulumCountLabel.textContent = `${state.pendulums.length} / ${MAX_PENDULUMS}`;
    addPendulumBtn.disabled = state.pendulums.length >= MAX_PENDULUMS;
    removePendulumBtn.disabled = state.pendulums.length <= MIN_PENDULUMS;
  }

  addPendulumBtn.addEventListener('click', () => {
    if (state.pendulums.length >= MAX_PENDULUMS) return;
    const i = state.pendulums.length;
    const newPendulum: Pendulum = {
      id: nextPendulumId(),
      frequency: 2 + i * 0.7,
      decay: 0.08,
      phaseDeg: (90 * i) % 360,
      amplitude: 45,
      angleDeg: (90 * i) % 360,
    };
    state.pendulums.push(newPendulum);
    selectedPresetId = null;
    renderPresetGrid();
    renderPendulumList();
    scheduleRender();
  });

  removePendulumBtn.addEventListener('click', () => {
    if (state.pendulums.length <= MIN_PENDULUMS) return;
    state.pendulums.pop();
    selectedPresetId = null;
    renderPresetGrid();
    renderPendulumList();
    scheduleRender();
  });

  // --- 描画設定 -----------------------------------------------------
  periodsSlider.value = String(state.periods);
  periodsValue.textContent = String(state.periods);
  periodsSlider.addEventListener('input', () => {
    state.periods = Number(periodsSlider.value);
    periodsValue.textContent = String(state.periods);
    scheduleRender();
  });

  traceSecondsSlider.value = String(state.traceSeconds);
  traceSecondsValue.textContent = `${state.traceSeconds.toFixed(1)}s`;
  traceSecondsSlider.addEventListener('input', () => {
    state.traceSeconds = Number(traceSecondsSlider.value);
    traceSecondsValue.textContent = `${state.traceSeconds.toFixed(1)}s`;
  });

  animateToggle.checked = state.animate;
  animateToggle.addEventListener('change', () => {
    state.animate = animateToggle.checked;
    scheduleRender();
  });

  // --- 紙面 -----------------------------------------------------
  function renderPaperSwatches(): void {
    paperSwatches.innerHTML = '';
    (Object.keys(PAPERS) as PaperType[]).forEach((key) => {
      const def = PAPERS[key];
      const btn = el('button', 'paper-swatch', undefined);
      btn.type = 'button';
      btn.style.setProperty('--swatch-color', def.base);
      btn.setAttribute('aria-pressed', String(state.paper === key));
      if (state.paper === key) btn.classList.add('is-active');
      btn.append(el('span', 'paper-swatch__chip'), el('span', 'paper-swatch__label', def.label));
      btn.addEventListener('click', () => {
        const goingDark = key === 'charcoal' && state.paper !== 'charcoal';
        const leavingDark = key !== 'charcoal' && state.paper === 'charcoal';
        state.paper = key;

        // 紙面が暗転すると既定の濃色インクが読めなくなるため、ユーザーが手を
        // 加えていない (既定値のままの) 場合に限り、視認性の良い色へ自動で振り替える。
        if (goingDark) {
          if (state.inkColor === DEFAULT_INK) {
            state.inkColor = DEFAULT_INK_LIGHT;
            inkColorPicker.value = state.inkColor;
          }
          if (state.inkColor2 === DEFAULT_INK_2) {
            state.inkColor2 = DEFAULT_INK_2_LIGHT;
            inkColor2Picker.value = state.inkColor2;
          }
        } else if (leavingDark) {
          if (state.inkColor === DEFAULT_INK_LIGHT) {
            state.inkColor = DEFAULT_INK;
            inkColorPicker.value = state.inkColor;
          }
          if (state.inkColor2 === DEFAULT_INK_2_LIGHT) {
            state.inkColor2 = DEFAULT_INK_2;
            inkColor2Picker.value = state.inkColor2;
          }
        }

        renderPaperSwatches();
        scheduleRender();
      });
      paperSwatches.appendChild(btn);
    });
  }
  renderPaperSwatches();

  // --- インク -----------------------------------------------------
  inkColorPicker.value = state.inkColor;
  inkColorPicker.addEventListener('input', () => {
    state.inkColor = inkColorPicker.value;
    scheduleRender();
  });

  twoPassToggle.checked = state.twoPass;
  inkColor2Field.hidden = !state.twoPass;
  twoPassToggle.addEventListener('change', () => {
    state.twoPass = twoPassToggle.checked;
    inkColor2Field.hidden = !state.twoPass;
    scheduleRender();
  });

  inkColor2Picker.value = state.inkColor2;
  inkColor2Picker.addEventListener('input', () => {
    state.inkColor2 = inkColor2Picker.value;
    scheduleRender();
  });

  // --- 書き出し -----------------------------------------------------
  rdpSlider.value = String(state.rdpTolerance);
  rdpValue.textContent = state.rdpTolerance.toFixed(2);
  rdpSlider.addEventListener('input', () => {
    state.rdpTolerance = Number(rdpSlider.value);
    rdpValue.textContent = state.rdpTolerance.toFixed(2);
  });

  function timestampSlug(): string {
    const d = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  exportSvgBtn.addEventListener('click', () => {
    const geometry = computeGeometry(state);
    const passes = [{ points: geometry.pass1.points, color: state.inkColor }];
    if (geometry.pass2) passes.push({ points: geometry.pass2.points, color: state.inkColor2 });
    const svg = buildHarmonographSVG(passes, state.rdpTolerance);
    downloadTextFile(`harmonograph-${timestampSlug()}.svg`, svg, 'image/svg+xml');
  });

  async function exportPng(sizePx: number): Promise<void> {
    const geometry = computeGeometry(state);
    const passes = [{ geometry: geometry.pass1, color: state.inkColor }];
    if (geometry.pass2) passes.push({ geometry: geometry.pass2, color: state.inkColor2 });
    const originalLabel = progressLabel.textContent;
    progressLabel.textContent = `PNG (${sizePx}px) 書き出し中…`;
    try {
      const blob = await renderHighResPNG(sizePx, state.paper, passes, BASE_INK_WIDTH_MM);
      downloadBlob(`harmonograph-${sizePx}px-${timestampSlug()}.png`, blob);
    } finally {
      progressLabel.textContent = originalLabel;
    }
  }

  exportPng2000Btn.addEventListener('click', () => {
    void exportPng(2000);
  });
  exportPng4000Btn.addEventListener('click', () => {
    void exportPng(4000);
  });

  // --- 初期化 -----------------------------------------------------
  renderPresetGrid();
  renderPendulumList();

  window.addEventListener('resize', () => {
    sizePaper();
    doRender();
  });

  // レイアウト確定後にサイズを取得するため次フレームまで待つ。
  requestAnimationFrame(() => {
    sizePaper();
    doRender();
  });
}
