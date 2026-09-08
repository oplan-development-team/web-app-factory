import './style.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';

import { Rng } from './lib/prng.ts';
import { proceduralCountryName, proceduralCurrencyName, proceduralPersonName } from './lib/nameGen.ts';
import { randomPlausibleYear, type ScriptMode } from './lib/banknoteData.ts';
import { DENOMINATIONS, INK_PRESETS, PAPER_PRESETS, defaultInkIndexFor, defaultPaperIndexFor } from './lib/presets.ts';
import { buildNotePlan } from './lib/notePlan.ts';
import { renderNoteToCanvas } from './lib/canvasRenderer.ts';
import { planToSvgString } from './lib/svgExport.ts';
import { canvasToPngDownload, downloadSvgString, safeFilenameFragment } from './lib/download.ts';

interface AppState {
  country: string;
  currency: string;
  year: string;
  portraitSeed: string;
  denomination: number;
  script: ScriptMode;
  precision: number;
  weight: number;
  inkIndex: number;
  paperIndex: number;
  inkManual: boolean;
}

function randomState(): AppState {
  const rng = new Rng(Date.now() ^ Math.floor(Math.random() * 0xffffffff));
  const denomination = rng.pick(DENOMINATIONS);
  return {
    country: proceduralCountryName(rng),
    currency: proceduralCurrencyName(rng),
    year: randomPlausibleYear(rng),
    portraitSeed: proceduralPersonName(rng),
    denomination,
    script: rng.chance(0.5) ? 'EN' : 'JA',
    precision: rng.int(35, 85),
    weight: rng.int(30, 75),
    inkIndex: defaultInkIndexFor(denomination),
    paperIndex: defaultPaperIndexFor(denomination),
    inkManual: false,
  };
}

let state: AppState = randomState();
let previousState: AppState | null = null;

// --- DOM refs ---
const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;

const inCountry = $<HTMLInputElement>('#in-country');
const inCurrency = $<HTMLInputElement>('#in-currency');
const inYear = $<HTMLInputElement>('#in-year');
const inPortrait = $<HTMLInputElement>('#in-portrait');
const inPrecision = $<HTMLInputElement>('#in-precision');
const inWeight = $<HTMLInputElement>('#in-weight');
const outPrecision = $<HTMLOutputElement>('#out-precision');
const outWeight = $<HTMLOutputElement>('#out-weight');
const inScale = $<HTMLSelectElement>('#in-scale');
const denominationRow = $<HTMLDivElement>('#denomination-row');
const scriptRow = $<HTMLDivElement>('#script-row');
const inkRow = $<HTMLDivElement>('#ink-row');
const paperRow = $<HTMLDivElement>('#paper-row');
const btnRandom = $<HTMLButtonElement>('#btn-random');
const btnUndo = $<HTMLButtonElement>('#btn-undo');
const btnExportPng = $<HTMLButtonElement>('#btn-export-png');
const btnExportSvg = $<HTMLButtonElement>('#btn-export-svg');
const canvas = $<HTMLCanvasElement>('#note-canvas');
const stageCaption = $<HTMLParagraphElement>('#stage-caption');
const ctx = canvas.getContext('2d')!;

// --- build static preset UI ---
DENOMINATIONS.forEach((d) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip';
  btn.dataset.value = String(d);
  btn.textContent = String(d);
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', () => {
    state.denomination = d;
    if (!state.inkManual) state.inkIndex = defaultInkIndexFor(d);
    state.paperIndex = defaultPaperIndexFor(d);
    syncUiFromState();
    scheduleRender();
  });
  denominationRow.appendChild(btn);
});

INK_PRESETS.forEach((preset, i) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'swatch';
  btn.style.setProperty('--swatch-color', preset.main);
  btn.title = preset.name;
  btn.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-label', preset.name);
  btn.addEventListener('click', () => {
    state.inkIndex = i;
    state.inkManual = true;
    syncUiFromState();
    scheduleRender();
  });
  inkRow.appendChild(btn);
});
const inkResetBtn = document.createElement('button');
inkResetBtn.type = 'button';
inkResetBtn.className = 'link-btn';
inkResetBtn.textContent = '額面既定に戻す';
inkResetBtn.addEventListener('click', () => {
  state.inkManual = false;
  state.inkIndex = defaultInkIndexFor(state.denomination);
  syncUiFromState();
  scheduleRender();
});
inkRow.after(inkResetBtn);

PAPER_PRESETS.forEach((preset, i) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'swatch';
  btn.style.setProperty('--swatch-color', preset.color);
  btn.title = preset.name;
  btn.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-label', preset.name);
  btn.addEventListener('click', () => {
    state.paperIndex = i;
    syncUiFromState();
    scheduleRender();
  });
  paperRow.appendChild(btn);
});

scriptRow.querySelectorAll<HTMLButtonElement>('.segmented__btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.script = (btn.dataset.script as ScriptMode) ?? 'EN';
    syncUiFromState();
    scheduleRender();
  });
});

// --- text/number inputs ---
inCountry.addEventListener('input', () => {
  state.country = inCountry.value;
  scheduleRender();
});
inCurrency.addEventListener('input', () => {
  state.currency = inCurrency.value;
  scheduleRender();
});
inYear.addEventListener('input', () => {
  state.year = inYear.value.replace(/[^0-9]/g, '').slice(0, 4);
  if (inYear.value !== state.year) inYear.value = state.year;
  scheduleRender();
});
inPortrait.addEventListener('input', () => {
  state.portraitSeed = inPortrait.value;
  scheduleRender();
});
inPrecision.addEventListener('input', () => {
  state.precision = Number(inPrecision.value);
  outPrecision.textContent = String(state.precision).padStart(3, '0');
  scheduleRender();
});
inWeight.addEventListener('input', () => {
  state.weight = Number(inWeight.value);
  outWeight.textContent = String(state.weight).padStart(3, '0');
  scheduleRender();
});

// --- random generate / undo ---
btnRandom.addEventListener('click', () => {
  previousState = { ...state };
  state = randomState();
  btnUndo.disabled = false;
  syncUiFromState();
  scheduleRender();
});

btnUndo.addEventListener('click', () => {
  if (!previousState) return;
  state = previousState;
  previousState = null;
  btnUndo.disabled = true;
  syncUiFromState();
  scheduleRender();
});

// --- export ---
btnExportPng.addEventListener('click', async () => {
  const scale = Number(inScale.value) || 2;
  const plan = buildNotePlan(state, { precision: state.precision, weight: state.weight }, state.inkIndex, state.paperIndex);
  const off = document.createElement('canvas');
  off.width = plan.width * scale;
  off.height = plan.height * scale;
  const offCtx = off.getContext('2d')!;
  renderNoteToCanvas(offCtx, plan, scale);
  const filename = `guilloche-${safeFilenameFragment(state.country, 'note')}-${state.denomination}-${scale}x.png`;
  setExportBusy(true);
  try {
    await canvasToPngDownload(off, filename);
  } finally {
    setExportBusy(false);
  }
});

btnExportSvg.addEventListener('click', () => {
  const plan = buildNotePlan(state, { precision: state.precision, weight: state.weight }, state.inkIndex, state.paperIndex);
  const svg = planToSvgString(plan);
  const filename = `guilloche-${safeFilenameFragment(state.country, 'note')}-${state.denomination}.svg`;
  downloadSvgString(svg, filename);
});

function setExportBusy(busy: boolean) {
  btnExportPng.disabled = busy;
  btnExportPng.textContent = busy ? '書き出し中…' : 'PNG 書き出し';
}

// --- render scheduling ---
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    doRender();
  });
}

function doRender() {
  const plan = buildNotePlan(state, { precision: state.precision, weight: state.weight }, state.inkIndex, state.paperIndex);
  renderNoteToCanvas(ctx, plan, 1);
  const denomLabel = `${state.currency.trim() || 'CURRENCY'} ${state.denomination}`;
  stageCaption.textContent = `${state.country.trim() || 'NOWHERE'} · ${denomLabel} · SPECIMEN`;
}

// --- sync widget values/pressed-state from state (used after preset clicks / random / undo) ---
function syncUiFromState() {
  inCountry.value = state.country;
  inCurrency.value = state.currency;
  inYear.value = state.year;
  inPortrait.value = state.portraitSeed;
  inPrecision.value = String(state.precision);
  inWeight.value = String(state.weight);
  outPrecision.textContent = String(state.precision).padStart(3, '0');
  outWeight.textContent = String(state.weight).padStart(3, '0');
  inScale.value = inScale.value || '2';

  denominationRow.querySelectorAll<HTMLButtonElement>('.chip').forEach((btn) => {
    const active = Number(btn.dataset.value) === state.denomination;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  inkRow.querySelectorAll<HTMLButtonElement>('.swatch').forEach((btn, i) => {
    const active = i === state.inkIndex;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  paperRow.querySelectorAll<HTMLButtonElement>('.swatch').forEach((btn, i) => {
    const active = i === state.paperIndex;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  scriptRow.querySelectorAll<HTMLButtonElement>('.segmented__btn').forEach((btn) => {
    const active = btn.dataset.script === state.script;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

// --- boot ---
syncUiFromState();
doRender();

// Re-render once webfonts finish loading so the very first paint doesn't get
// stuck with fallback-font metrics baked into the title arch / serial layout.
if ('fonts' in document) {
  document.fonts.ready.then(() => doRender()).catch(() => {});
}
