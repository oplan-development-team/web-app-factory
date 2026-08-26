import './styles/global.css';
import type { AppState, EdgeStyle, LayoutId } from './types';
import { INK_PRESETS, LAYOUT_SIZES, PREVIEW_MAX_WIDTH } from './core/presets';
import { renderPoster, type RenderParams } from './core/compose';
import { loadImageFile, ImageLoadError } from './ui/imageLoader';
import { analyzeFile } from './label/specimenId';
import { getCurrentPosition, formatCoordinate } from './label/geolocation';
import { exportPoster } from './ui/exportImage';

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`要素が見つかりません: #${id}`);
  return found as T;
}

// ---------- DOM references ----------

const dropzone = el<HTMLDivElement>('dropzone');
const fileInput = el<HTMLInputElement>('fileInput');
const uploadFileName = el<HTMLParagraphElement>('uploadFileName');

const revealCards = ['cardTone', 'cardInk', 'cardTexture', 'cardLayout', 'cardLabel', 'cardExport'].map((id) =>
  el<HTMLElement>(id),
);

const rangeContrast = el<HTMLInputElement>('rangeContrast');
const outContrast = el<HTMLOutputElement>('outContrast');
const rangeThreshold = el<HTMLInputElement>('rangeThreshold');
const outThreshold = el<HTMLOutputElement>('outThreshold');

const inkSwatches = el<HTMLDivElement>('inkSwatches');

const rangeMottle = el<HTMLInputElement>('rangeMottle');
const outMottle = el<HTMLOutputElement>('outMottle');
const rangeGrain = el<HTMLInputElement>('rangeGrain');
const outGrain = el<HTMLOutputElement>('outGrain');
const rangeVignette = el<HTMLInputElement>('rangeVignette');
const outVignette = el<HTMLOutputElement>('outVignette');

const fieldTitle = el<HTMLInputElement>('fieldTitle');
const fieldSubtitle = el<HTMLInputElement>('fieldSubtitle');
const fieldLocality = el<HTMLInputElement>('fieldLocality');
const fieldLat = el<HTMLInputElement>('fieldLat');
const fieldLon = el<HTMLInputElement>('fieldLon');
const btnGeolocate = el<HTMLButtonElement>('btnGeolocate');
const geoStatus = el<HTMLParagraphElement>('geoStatus');
const fieldDate = el<HTMLInputElement>('fieldDate');
const fieldSpecimenNo = el<HTMLInputElement>('fieldSpecimenNo');

const btnExport = el<HTMLButtonElement>('btnExport');
const exportStatus = el<HTMLParagraphElement>('exportStatus');

const previewCanvas = el<HTMLCanvasElement>('previewCanvas');
const stageEmpty = el<HTMLDivElement>('stageEmpty');
const stageLoading = el<HTMLDivElement>('stageLoading');
const stageLoadingText = el<HTMLSpanElement>('stageLoadingText');

// ---------- State ----------

const today = new Date().toISOString().slice(0, 10);

let state: AppState = {
  source: null,
  contrast: Number(rangeContrast.value),
  threshold: Number(rangeThreshold.value),
  inkPresetId: INK_PRESETS[0].id,
  mottle: Number(rangeMottle.value),
  grain: Number(rangeGrain.value),
  vignette: Number(rangeVignette.value),
  edgeStyle: 'rough',
  layout: 'vertical',
  label: {
    title: fieldTitle.value,
    subtitle: '',
    locality: '',
    lat: '',
    lon: '',
    date: today,
    specimenNo: '',
  },
};

fieldDate.value = today;

function updateState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
}

function updateLabel(patch: Partial<AppState['label']>): void {
  state = { ...state, label: { ...state.label, ...patch } };
}

// ---------- Render scheduling ----------

let renderQueued = false;

function scheduleRender(): void {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderPreview();
  });
}

function computePreviewSize(layout: LayoutId): { width: number; height: number } {
  const base = LAYOUT_SIZES[layout];
  const width = Math.min(PREVIEW_MAX_WIDTH, base.width);
  const height = Math.round(width * (base.height / base.width));
  return { width, height };
}

function currentRenderParams(): RenderParams {
  return {
    source: state.source?.bitmap ?? null,
    seed: state.source?.seed ?? 0,
    contrast: state.contrast,
    threshold: state.threshold,
    inkPresetId: state.inkPresetId,
    mottle: state.mottle,
    grain: state.grain,
    vignette: state.vignette,
    edgeStyle: state.edgeStyle,
    layout: state.layout,
    label: state.label,
  };
}

function renderPreview(): void {
  if (!state.source) return;
  const { width, height } = computePreviewSize(state.layout);
  renderPoster(previewCanvas, width, height, currentRenderParams());
}

// ---------- Ink swatches ----------

function buildInkSwatches(): void {
  inkSwatches.innerHTML = '';
  for (const preset of INK_PRESETS) {
    const label = document.createElement('label');
    label.className = 'swatch';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'inkPreset';
    input.value = preset.id;
    input.checked = preset.id === state.inkPresetId;
    input.addEventListener('change', () => {
      updateState({ inkPresetId: preset.id });
      scheduleRender();
    });

    const chip = document.createElement('span');
    chip.className = 'swatch__chip';
    chip.style.background = `linear-gradient(135deg, ${preset.ink} 0%, ${preset.ink} 58%, ${preset.paper} 58%, ${preset.paper} 100%)`;

    const name = document.createElement('span');
    name.className = 'swatch__name';
    name.textContent = preset.label;

    label.append(input, chip, name);
    inkSwatches.appendChild(label);
  }
}

// ---------- Upload flow ----------

function showLoading(text: string): void {
  stageLoadingText.textContent = text;
  stageLoading.hidden = false;
}

function hideLoading(): void {
  stageLoading.hidden = true;
}

function showUploadHint(message: string, tone: 'success' | 'error'): void {
  uploadFileName.hidden = false;
  uploadFileName.textContent = message;
  uploadFileName.dataset.tone = tone;
}

async function handleFile(file: File): Promise<void> {
  showLoading('標本を感光処理しています…');
  try {
    const [bitmap, analysis] = await Promise.all([loadImageFile(file), analyzeFile(file)]);
    updateState({
      source: {
        bitmap,
        width: bitmap.naturalWidth,
        height: bitmap.naturalHeight,
        seed: analysis.seed,
      },
    });
    updateLabel({ specimenNo: analysis.specimenNo });
    fieldSpecimenNo.value = analysis.specimenNo;

    for (const card of revealCards) card.hidden = false;
    stageEmpty.hidden = true;
    btnExport.disabled = false;

    showUploadHint(`${file.name}（${bitmap.naturalWidth}×${bitmap.naturalHeight}px）を採取しました`, 'success');
    scheduleRender();
  } catch (error) {
    const message = error instanceof ImageLoadError ? error.message : '画像の読み込みに失敗しました';
    showUploadHint(message, 'error');
  } finally {
    hideLoading();
  }
}

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
});
dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('is-dragover');
});
dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('is-dragover');
});
dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('is-dragover');
  const file = event.dataTransfer?.files?.[0];
  if (file) void handleFile(file);
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void handleFile(file);
  fileInput.value = '';
});

// ---------- Tone & texture sliders ----------

function bindSlider(input: HTMLInputElement, output: HTMLOutputElement, apply: (value: number) => void): void {
  const sync = () => {
    output.textContent = input.value;
    apply(Number(input.value));
    scheduleRender();
  };
  input.addEventListener('input', sync);
  output.textContent = input.value;
}

bindSlider(rangeContrast, outContrast, (value) => updateState({ contrast: value }));
bindSlider(rangeThreshold, outThreshold, (value) => updateState({ threshold: value }));
bindSlider(rangeMottle, outMottle, (value) => updateState({ mottle: value }));
bindSlider(rangeGrain, outGrain, (value) => updateState({ grain: value }));
bindSlider(rangeVignette, outVignette, (value) => updateState({ vignette: value }));

// ---------- Edge style / layout radios ----------

document.querySelectorAll<HTMLInputElement>('input[name="edgeStyle"]').forEach((input) => {
  input.addEventListener('change', () => {
    if (input.checked) {
      updateState({ edgeStyle: input.value as EdgeStyle });
      scheduleRender();
    }
  });
});

document.querySelectorAll<HTMLInputElement>('input[name="layout"]').forEach((input) => {
  input.addEventListener('change', () => {
    if (input.checked) {
      updateState({ layout: input.value as LayoutId });
      scheduleRender();
    }
  });
});

// ---------- Label form ----------

fieldTitle.addEventListener('input', () => {
  updateLabel({ title: fieldTitle.value });
  scheduleRender();
});
fieldSubtitle.addEventListener('input', () => {
  updateLabel({ subtitle: fieldSubtitle.value });
  scheduleRender();
});
fieldLocality.addEventListener('input', () => {
  updateLabel({ locality: fieldLocality.value });
  scheduleRender();
});
fieldLat.addEventListener('input', () => {
  updateLabel({ lat: fieldLat.value });
  scheduleRender();
});
fieldLon.addEventListener('input', () => {
  updateLabel({ lon: fieldLon.value });
  scheduleRender();
});
fieldDate.addEventListener('input', () => {
  updateLabel({ date: fieldDate.value });
  scheduleRender();
});
fieldSpecimenNo.addEventListener('input', () => {
  updateLabel({ specimenNo: fieldSpecimenNo.value });
  scheduleRender();
});

btnGeolocate.addEventListener('click', async () => {
  btnGeolocate.disabled = true;
  geoStatus.hidden = false;
  geoStatus.dataset.tone = '';
  geoStatus.textContent = '現在地を取得しています…';
  try {
    const position = await getCurrentPosition();
    const lat = formatCoordinate(position.lat);
    const lon = formatCoordinate(position.lon);
    fieldLat.value = lat;
    fieldLon.value = lon;
    updateLabel({ lat, lon });
    geoStatus.dataset.tone = 'success';
    geoStatus.textContent = `取得しました（${lat}, ${lon}）`;
    scheduleRender();
  } catch (error) {
    geoStatus.dataset.tone = 'error';
    geoStatus.textContent = error instanceof Error ? error.message : '位置情報の取得に失敗しました';
  } finally {
    btnGeolocate.disabled = false;
  }
});

// ---------- Export ----------

function getSelectedScale(): number {
  const checked = document.querySelector<HTMLInputElement>('input[name="scale"]:checked');
  return checked ? Number(checked.value) : 2;
}

btnExport.addEventListener('click', async () => {
  if (!state.source) return;
  btnExport.disabled = true;
  exportStatus.hidden = false;
  exportStatus.dataset.tone = '';
  exportStatus.textContent = '高解像度で書き出しています…';
  // Yield one frame so the loading text actually paints before the
  // synchronous, potentially heavy render work below.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  try {
    await exportPoster(currentRenderParams(), getSelectedScale());
    exportStatus.dataset.tone = 'success';
    exportStatus.textContent = 'PNGを書き出しました';
  } catch (error) {
    exportStatus.dataset.tone = 'error';
    exportStatus.textContent = error instanceof Error ? error.message : '書き出しに失敗しました';
  } finally {
    btnExport.disabled = false;
  }
});

document.querySelectorAll<HTMLInputElement>('input[name="scale"]').forEach((input) => {
  input.addEventListener('change', () => {
    exportStatus.hidden = true;
  });
});

// ---------- Boot ----------

async function ensureFontsReady(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('italic 500 40px "EB Garamond"'),
      document.fonts.load('400 40px "EB Garamond"'),
      document.fonts.load('400 40px "Special Elite"'),
    ]);
    await document.fonts.ready;
  } catch {
    // Fall back silently to system fonts if webfont loading fails.
  }
  scheduleRender();
}

buildInkSwatches();
void ensureFontsReady();
