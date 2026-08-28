import type { Store } from '../lib/state';
import { ACCEPTED_TYPES, MULTI_PRESETS, PAPER_PRESETS } from '../lib/constants';
import { buildPosterSvg } from '../lib/poster';
import { downloadPng, downloadSvg, slugifyTitle } from '../lib/export';
import { hypsometricColor } from '../lib/palette';
import type { MultiPreset } from '../types';

export interface PanelHandle {
  el: HTMLElement;
  update: () => void;
}

export function createPanel(store: Store): PanelHandle {
  const panel = document.createElement('div');
  panel.className = 'panel';

  const source = buildSourceSection(store);
  const contour = buildContourSection(store);
  const palette = buildPaletteSection(store);
  const label = buildLabelSection(store);
  const exportSection = buildExportSection(store);

  panel.append(source.el, contour.el, palette.el, label.el, exportSection.el);

  function update(): void {
    source.update();
    contour.update();
    palette.update();
    label.update();
    exportSection.update();
  }

  return { el: panel, update };
}

function section(index: string, title: string): { el: HTMLElement; body: HTMLElement } {
  const el = document.createElement('section');
  el.className = 'panel-section';
  const h = document.createElement('h3');
  h.className = 'section-title';
  h.innerHTML = `<span class="idx">${index}</span><span>${title}</span>`;
  const body = document.createElement('div');
  el.append(h, body);
  return { el, body };
}

// ---------- 01 SOURCE ----------

function buildSourceSection(store: Store): { el: HTMLElement; update: () => void } {
  const { el, body } = section('01', 'SOURCE');

  const dropzone = document.createElement('button');
  dropzone.type = 'button';
  dropzone.className = 'dropzone btn-block';
  dropzone.innerHTML = `<div style="font-size:11px;font-weight:600;letter-spacing:0.08em;">SELECT IMAGE</div>
    <div class="dropzone-hint">JPEG · PNG · WEBP — UP TO 10MB</div>`;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = ACCEPTED_TYPES.join(',');
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void store.loadFile(file);
    fileInput.value = '';
  });
  dropzone.addEventListener('click', () => fileInput.click());

  const loadedView = document.createElement('div');
  loadedView.hidden = true;
  const fileName = document.createElement('div');
  fileName.className = 'source-file';
  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  const replaceBtn = document.createElement('button');
  replaceBtn.type = 'button';
  replaceBtn.className = 'btn';
  replaceBtn.textContent = 'REPLACE';
  replaceBtn.addEventListener('click', () => fileInput.click());
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn';
  removeBtn.textContent = 'REMOVE';
  removeBtn.addEventListener('click', () => store.reset());
  btnRow.append(replaceBtn, removeBtn);
  loadedView.append(fileName, btnRow);

  body.append(dropzone, loadedView, fileInput);

  function update(): void {
    const { source } = store.state;
    dropzone.hidden = !!source;
    loadedView.hidden = !source;
    if (source) fileName.textContent = `${source.fileName}  (${source.width}×${source.height}px)`;
  }

  return { el, update };
}

// ---------- 02 CONTOUR ----------

function buildContourSection(store: Store): { el: HTMLElement; update: () => void } {
  const { el, body } = section('02', 'CONTOUR');

  const lineCount = sliderField('LINES', 5, 60, 1, (v) => String(v));
  const lineWeight = sliderField('LINE WEIGHT', 0.4, 3.2, 0.1, (v) => v.toFixed(1));
  const smoothing = sliderField('SMOOTHING', 0, 10, 1, (v) => String(v));

  const invertRow = document.createElement('label');
  invertRow.className = 'check-row field';
  const invertInput = document.createElement('input');
  invertInput.type = 'checkbox';
  const invertLabel = document.createElement('span');
  invertLabel.className = 'field-label';
  invertLabel.textContent = 'INVERT TONE (DARK = SUMMIT)';
  invertRow.append(invertInput, invertLabel);

  body.append(lineCount.el, lineWeight.el, smoothing.el, invertRow);

  lineCount.input.addEventListener('input', () => store.updateSettings({ lineCount: Number(lineCount.input.value) }));
  lineWeight.input.addEventListener('input', () => store.updateSettings({ lineWeight: Number(lineWeight.input.value) }));
  smoothing.input.addEventListener('input', () => store.updateSettings({ smoothing: Number(smoothing.input.value) }));
  invertInput.addEventListener('change', () => store.updateSettings({ invert: invertInput.checked }));

  const controls = [lineCount.input, lineWeight.input, smoothing.input, invertInput];

  function update(): void {
    const { settings, source } = store.state;
    lineCount.set(settings.lineCount);
    lineWeight.set(settings.lineWeight);
    smoothing.set(settings.smoothing);
    invertInput.checked = settings.invert;
    for (const c of controls) c.disabled = !source;
  }

  return { el, update };
}

function sliderField(
  label: string,
  min: number,
  max: number,
  step: number,
  format: (v: number) => string,
): { el: HTMLElement; input: HTMLInputElement; set: (v: number) => void } {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const row = document.createElement('div');
  row.className = 'field-row';
  const labelEl = document.createElement('span');
  labelEl.className = 'field-label';
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.className = 'field-value';
  row.append(labelEl, valueEl);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);

  wrap.append(row, input);

  function set(v: number): void {
    input.value = String(v);
    valueEl.textContent = format(v);
  }
  set(min);

  return { el: wrap, input, set };
}

// ---------- 03 PALETTE ----------

function buildPaletteSection(store: Store): { el: HTMLElement; update: () => void } {
  const { el, body } = section('03', 'PALETTE');

  const segmented = document.createElement('div');
  segmented.className = 'segmented field';
  const monoBtn = document.createElement('button');
  monoBtn.type = 'button';
  monoBtn.textContent = 'MONO';
  const multiBtn = document.createElement('button');
  multiBtn.type = 'button';
  multiBtn.textContent = 'MULTI';
  segmented.append(monoBtn, multiBtn);
  monoBtn.addEventListener('click', () => store.updateSettings({ colorMode: 'mono' }));
  multiBtn.addEventListener('click', () => store.updateSettings({ colorMode: 'multi' }));

  const monoPanel = document.createElement('div');
  const inkField = document.createElement('div');
  inkField.className = 'field';
  inkField.innerHTML = `<div class="field-row"><span class="field-label">INK COLOR</span></div>`;
  const inkColorField = colorField();
  inkField.appendChild(inkColorField.el);

  const paperField = document.createElement('div');
  paperField.className = 'field';
  paperField.innerHTML = `<div class="field-row"><span class="field-label">PAPER</span></div>`;
  const swatchGrid = document.createElement('div');
  swatchGrid.className = 'swatch-grid';
  const swatchButtons = PAPER_PRESETS.map((preset) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.background = preset.hex;
    b.title = `${preset.label} ${preset.hex}`;
    b.addEventListener('click', () => store.updateSettings({ paperColor: preset.hex }));
    swatchGrid.appendChild(b);
    return { btn: b, hex: preset.hex };
  });
  paperField.appendChild(swatchGrid);
  const paperCustom = colorField();
  paperCustom.el.style.marginTop = '8px';
  paperField.appendChild(paperCustom.el);

  monoPanel.append(inkField, paperField);

  const multiPanel = document.createElement('div');
  multiPanel.hidden = true;
  const presetList = document.createElement('div');
  presetList.className = 'preset-list field';
  const presetRows = (Object.keys(MULTI_PRESETS) as MultiPreset[]).map((key) => {
    const preset = MULTI_PRESETS[key];
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'preset-row';
    const ramp = document.createElement('span');
    ramp.className = 'ramp';
    ramp.style.background = `linear-gradient(90deg, ${sampleRamp(key).join(',')})`;
    const labelSpan = document.createElement('span');
    labelSpan.className = 'preset-label';
    labelSpan.textContent = preset.label;
    row.append(ramp, labelSpan);
    row.addEventListener('click', () => store.updateSettings({ multiPreset: key }));
    presetList.appendChild(row);
    return { key, row };
  });
  multiPanel.appendChild(presetList);

  body.append(segmented, monoPanel, multiPanel);

  inkColorField.onChange((hex) => store.updateSettingsQuiet({ inkColor: hex }));
  paperCustom.onChange((hex) => store.updateSettingsQuiet({ paperColor: hex }));

  function update(): void {
    const { settings, source } = store.state;
    const isMono = settings.colorMode === 'mono';
    monoBtn.setAttribute('aria-pressed', String(isMono));
    multiBtn.setAttribute('aria-pressed', String(!isMono));
    monoPanel.hidden = !isMono;
    multiPanel.hidden = isMono;

    inkColorField.set(settings.inkColor);
    paperCustom.set(settings.paperColor);
    for (const { btn, hex } of swatchButtons) btn.setAttribute('aria-pressed', String(hex.toLowerCase() === settings.paperColor.toLowerCase()));
    for (const { key, row } of presetRows) row.setAttribute('aria-pressed', String(key === settings.multiPreset));

    for (const b of [monoBtn, multiBtn]) b.disabled = !source;
    inkColorField.setDisabled(!source);
    paperCustom.setDisabled(!source);
    for (const { btn } of swatchButtons) btn.disabled = !source;
    for (const { row } of presetRows) row.disabled = !source;
  }

  return { el, update };
}

function sampleRamp(key: MultiPreset): string[] {
  return [0, 0.25, 0.5, 0.75, 1].map((t) => hypsometricColor(key, t));
}

function colorField(): {
  el: HTMLElement;
  set: (hex: string) => void;
  onChange: (fn: (hex: string) => void) => void;
  setDisabled: (v: boolean) => void;
} {
  const wrap = document.createElement('div');
  wrap.className = 'color-field';
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.maxLength = 7;
  wrap.append(colorInput, textInput);

  let handler: ((hex: string) => void) | null = null;
  const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

  colorInput.addEventListener('input', () => {
    textInput.value = colorInput.value;
    handler?.(colorInput.value);
  });
  textInput.addEventListener('change', () => {
    const v = textInput.value.trim();
    if (isHex(v)) {
      colorInput.value = v;
      handler?.(v);
    }
  });

  return {
    el: wrap,
    set(hex: string) {
      if (document.activeElement !== textInput) textInput.value = hex;
      colorInput.value = hex;
    },
    onChange(fn) {
      handler = fn;
    },
    setDisabled(v: boolean) {
      colorInput.disabled = v;
      textInput.disabled = v;
    },
  };
}

// ---------- 04 LABEL ----------

function buildLabelSection(store: Store): { el: HTMLElement; update: () => void } {
  const { el, body } = section('04', 'LABEL');

  const titleField = document.createElement('div');
  titleField.className = 'field';
  titleField.innerHTML = `<div class="field-row"><span class="field-label">TITLE</span></div>`;
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'text-input';
  titleInput.maxLength = 40;
  titleInput.placeholder = 'UNTITLED SUMMIT';
  titleField.appendChild(titleInput);
  titleInput.addEventListener('input', () => store.updateSettingsQuiet({ title: titleInput.value }));

  const readouts = document.createElement('div');
  readouts.className = 'field';
  body.append(titleField, readouts);

  function update(): void {
    const { settings, trace, source } = store.state;
    if (document.activeElement !== titleInput) titleInput.value = settings.title;
    titleInput.disabled = !source;

    const date = new Date().toISOString().slice(0, 10);
    const ci = trace && trace.contourInterval ? trace.contourInterval.toFixed(2) : '—';
    const lines = trace ? String(trace.bands.length) : '—';
    readouts.innerHTML = `
      <div class="readout-row"><span class="k">DATE</span><span>${date}</span></div>
      <div class="readout-row"><span class="k">CI VALUE</span><span>${ci}</span></div>
      <div class="readout-row"><span class="k">LINES TRACED</span><span>${lines}</span></div>
    `;
  }

  return { el, update };
}

// ---------- 05 EXPORT ----------

function buildExportSection(store: Store): { el: HTMLElement; update: () => void } {
  const { el, body } = section('05', 'EXPORT');

  let scale: 1 | 2 | 3 = 2;

  const scaleRow = document.createElement('div');
  scaleRow.className = 'segmented field';
  const scaleButtons = ([1, 2, 3] as const).map((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${s}X`;
    b.addEventListener('click', () => {
      scale = s;
      refreshScaleButtons();
    });
    scaleRow.appendChild(b);
    return b;
  });
  function refreshScaleButtons(): void {
    scaleButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(i + 1 === scale)));
  }
  refreshScaleButtons();

  const frameRow = document.createElement('label');
  frameRow.className = 'check-row field';
  const frameInput = document.createElement('input');
  frameInput.type = 'checkbox';
  frameInput.checked = true;
  const frameLabel = document.createElement('span');
  frameLabel.className = 'field-label';
  frameLabel.textContent = 'INCLUDE FRAME (RULERS / LEGEND)';
  frameRow.append(frameInput, frameLabel);
  frameInput.addEventListener('change', () => store.updateSettingsQuiet({ includeFrame: frameInput.checked }));

  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row field';
  const pngBtn = document.createElement('button');
  pngBtn.type = 'button';
  pngBtn.className = 'btn';
  pngBtn.textContent = 'EXPORT PNG';
  const svgBtn = document.createElement('button');
  svgBtn.type = 'button';
  svgBtn.className = 'btn';
  svgBtn.textContent = 'EXPORT SVG';
  btnRow.append(pngBtn, svgBtn);

  const feedback = document.createElement('div');

  body.append(scaleRow, frameRow, btnRow, feedback);

  pngBtn.addEventListener('click', async () => {
    const { trace, settings, source } = store.state;
    if (!trace) return;
    pngBtn.disabled = true;
    try {
      const svg = buildPosterSvg(trace, settings, source);
      await downloadPng(svg, slugifyTitle(settings.title), scale);
      showFeedback(`PNG EXPORTED @ ${scale}X`, false);
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'PNG の書き出しに失敗しました。', true);
    } finally {
      pngBtn.disabled = !store.state.trace;
    }
  });

  svgBtn.addEventListener('click', () => {
    const { trace, settings, source } = store.state;
    if (!trace) return;
    try {
      const svg = buildPosterSvg(trace, settings, source);
      downloadSvg(svg, slugifyTitle(settings.title));
      showFeedback('SVG EXPORTED', false);
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'SVG の書き出しに失敗しました。', true);
    }
  });

  function showFeedback(message: string, isError: boolean): void {
    feedback.innerHTML = '';
    const node = document.createElement('div');
    node.className = isError ? 'export-feedback error' : 'export-feedback';
    node.textContent = message;
    feedback.appendChild(node);
    store.setExportMessage(message);
    window.setTimeout(() => {
      if (feedback.contains(node)) feedback.removeChild(node);
    }, 4200);
  }

  function update(): void {
    const { trace, settings } = store.state;
    frameInput.checked = settings.includeFrame;
    const disabled = !trace;
    pngBtn.disabled = disabled;
    svgBtn.disabled = disabled;
    frameInput.disabled = disabled;
    for (const b of scaleButtons) b.disabled = disabled;
  }

  return { el, update };
}
