import '@fontsource/anton/400.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/900.css';
import './style.css';

import type { CoverState, Mode, TemplateId } from './lib/types.ts';
import { TEMPLATES } from './lib/templates.ts';
import { PALETTES } from './lib/palettes.ts';
import { renderCover, CANVAS_SIZE } from './lib/renderer.ts';
import { randomizeState } from './lib/random.ts';
import { generateCatalogLabel } from './lib/catalogLabel.ts';

const MAX_TRACKS = 5;

const state: CoverState = {
  bandName: '',
  albumName: '',
  tracks: Array(MAX_TRACKS).fill(''),
  mode: 'photo',
  templateId: 'diagonal',
  paletteId: PALETTES[0]!.id,
  photo: null,
  transform: { cropX: 0, cropY: 0, zoom: 100, angle: -14, threshold: 50 },
  catalogLabel: generateCatalogLabel(),
};

const $ = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el;
};

const canvas = $<HTMLCanvasElement>('#cover-canvas');
const ctx = canvas.getContext('2d')!;
const previewEmpty = $<HTMLDivElement>('#preview-empty');
const bandInput = $<HTMLInputElement>('#band-name');
const albumInput = $<HTMLInputElement>('#album-name');
const trackListEl = $<HTMLDivElement>('#track-list');
const modeTabs = $<HTMLDivElement>('#mode-tabs');
const templateGrid = $<HTMLDivElement>('#template-grid');
const paletteGrid = $<HTMLDivElement>('#palette-grid');
const photoPanel = $<HTMLDivElement>('#photo-panel');
const photoInput = $<HTMLInputElement>('#photo-input');
const photoHint = $<HTMLParagraphElement>('#photo-hint');
const errorEl = $<HTMLParagraphElement>('#form-error');
const downloadBtn = $<HTMLButtonElement>('#btn-download');
const randomizeBtn = $<HTMLButtonElement>('#btn-randomize');

const sliderIds = ['threshold', 'cropx', 'cropy', 'zoom', 'angle'] as const;
type SliderKey = (typeof sliderIds)[number];
const sliderInputs: Record<SliderKey, HTMLInputElement> = {
  threshold: $('#ctl-threshold'),
  cropx: $('#ctl-cropx'),
  cropy: $('#ctl-cropy'),
  zoom: $('#ctl-zoom'),
  angle: $('#ctl-angle'),
};
const sliderValueEls: Record<SliderKey, HTMLElement> = {
  threshold: $('#val-threshold'),
  cropx: $('#val-cropx'),
  cropy: $('#val-cropy'),
  zoom: $('#val-zoom'),
  angle: $('#val-angle'),
};

function buildTrackInputs() {
  trackListEl.innerHTML = '';
  for (let i = 0; i < MAX_TRACKS; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'field__input field__input--track';
    input.maxLength = 40;
    input.placeholder = `${i + 1}. 曲名（任意）`;
    input.autocomplete = 'off';
    input.value = state.tracks[i] ?? '';
    input.addEventListener('input', () => {
      state.tracks[i] = input.value;
      schedule();
    });
    trackListEl.appendChild(input);
  }
}

function buildTemplateGrid() {
  templateGrid.innerHTML = '';
  TEMPLATES.forEach((tpl) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option';
    btn.dataset.template = tpl.id;
    btn.setAttribute('role', 'radio');
    btn.innerHTML = `
      <span class="option__num">${tpl.num}</span>
      <span class="option__body">
        <span class="option__name">${tpl.name}</span>
        <span class="option__desc">${tpl.description}</span>
      </span>
    `;
    btn.addEventListener('click', () => {
      state.templateId = tpl.id as TemplateId;
      syncTemplateGrid();
      schedule();
    });
    templateGrid.appendChild(btn);
  });
  syncTemplateGrid();
}

function syncTemplateGrid() {
  templateGrid.querySelectorAll<HTMLButtonElement>('.option').forEach((btn) => {
    const active = btn.dataset.template === state.templateId;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-checked', String(active));
  });
}

function buildPaletteGrid() {
  paletteGrid.innerHTML = '';
  PALETTES.forEach((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.dataset.palette = p.id;
    btn.setAttribute('role', 'radio');
    btn.title = p.name;
    btn.innerHTML = `
      <span class="swatch__chips">
        <span class="swatch__chip" style="background:${p.highlight}"></span>
        <span class="swatch__chip" style="background:${p.shadow}"></span>
      </span>
      <span class="swatch__label"><span class="swatch__num">${p.num}</span>${p.name}</span>
    `;
    btn.addEventListener('click', () => {
      state.paletteId = p.id;
      syncPaletteGrid();
      schedule();
    });
    paletteGrid.appendChild(btn);
  });
  syncPaletteGrid();
}

function syncPaletteGrid() {
  paletteGrid.querySelectorAll<HTMLButtonElement>('.swatch').forEach((btn) => {
    const active = btn.dataset.palette === state.paletteId;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-checked', String(active));
  });
}

function syncSliders() {
  sliderInputs.threshold.value = String(state.transform.threshold);
  sliderInputs.cropx.value = String(state.transform.cropX);
  sliderInputs.cropy.value = String(state.transform.cropY);
  sliderInputs.zoom.value = String(state.transform.zoom);
  sliderInputs.angle.value = String(state.transform.angle);
  sliderValueEls.threshold.textContent = String(state.transform.threshold);
  sliderValueEls.cropx.textContent = String(state.transform.cropX);
  sliderValueEls.cropy.textContent = String(state.transform.cropY);
  sliderValueEls.zoom.textContent = `${state.transform.zoom}%`;
  sliderValueEls.angle.textContent = `${state.transform.angle}°`;
}

function setMode(mode: Mode) {
  state.mode = mode;
  modeTabs.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  photoPanel.classList.toggle('is-disabled', mode !== 'photo');
  schedule();
}

function schedule() {
  const bandOk = state.bandName.trim().length > 0;
  const albumOk = state.albumName.trim().length > 0;

  if (!bandOk || !albumOk) {
    previewEmpty.classList.remove('is-hidden');
    canvas.classList.add('is-hidden');
    downloadBtn.disabled = true;
    errorEl.textContent = '';
    return;
  }

  previewEmpty.classList.add('is-hidden');
  canvas.classList.remove('is-hidden');
  downloadBtn.disabled = false;
  errorEl.textContent = '';

  try {
    renderCover(ctx, state);
  } catch (err) {
    console.error(err);
    errorEl.textContent = '生成中にエラーが発生しました。入力内容や画像を確認してください。';
  }
}

function slugify(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9぀-ヿ一-龯]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'cover'
  );
}

function wireEvents() {
  bandInput.addEventListener('input', () => {
    state.bandName = bandInput.value;
    schedule();
  });
  albumInput.addEventListener('input', () => {
    state.albumName = albumInput.value;
    schedule();
  });

  modeTabs.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode as Mode));
  });

  (Object.keys(sliderInputs) as SliderKey[]).forEach((key) => {
    sliderInputs[key].addEventListener('input', () => {
      const value = Number(sliderInputs[key].value);
      switch (key) {
        case 'threshold':
          state.transform.threshold = value;
          break;
        case 'cropx':
          state.transform.cropX = value;
          break;
        case 'cropy':
          state.transform.cropY = value;
          break;
        case 'zoom':
          state.transform.zoom = value;
          break;
        case 'angle':
          state.transform.angle = value;
          break;
      }
      syncSliders();
      schedule();
    });
  });

  photoInput.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      photoHint.textContent = '画像ファイルを選択してください。';
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.photo = img;
      photoHint.textContent = `読み込み済み: ${file.name}（サーバー送信なし）`;
      URL.revokeObjectURL(url);
      schedule();
    };
    img.onerror = () => {
      photoHint.textContent = '画像の読み込みに失敗しました。別のファイルを試してください。';
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

  randomizeBtn.addEventListener('click', () => {
    randomizeState(state);
    state.catalogLabel = generateCatalogLabel();
    syncTemplateGrid();
    syncPaletteGrid();
    syncSliders();
    schedule();
  });

  downloadBtn.addEventListener('click', () => {
    if (downloadBtn.disabled) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${slugify(state.bandName)}-${slugify(state.albumName)}-cover.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  });
}

function init() {
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  buildTrackInputs();
  buildTemplateGrid();
  buildPaletteGrid();
  syncSliders();
  wireEvents();
  schedule();

  // The cover render measures text with canvas.measureText() to compute
  // extreme tracking / fit-to-width, which depends on the *actual* display
  // fonts (Anton/Oswald/Bebas Neue) being loaded. Until they finish loading,
  // measurements silently fall back to a system font with different glyph
  // widths, so the fitted size/tracking computed pre-load can overflow once
  // the real font paints. Re-render once every requested weight is ready.
  document.fonts.ready.then(() => schedule());
}

init();
