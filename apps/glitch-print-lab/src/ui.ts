import type { LayerState } from './pipeline.ts';

export interface LayerUIRefs {
  jpegRate: HTMLInputElement;
  jpegBlock: HTMLInputElement;
  jpegEnabled: HTMLInputElement;
  rowShiftMax: HTMLInputElement;
  rowShiftBand: HTMLInputElement;
  rowShiftEnabled: HTMLInputElement;
  rowShiftModeButtons: HTMLButtonElement[];
  channelOffset: HTMLInputElement;
  channelEnabled: HTMLInputElement;
  scanlineDensity: HTMLInputElement;
  scanlineEnabled: HTMLInputElement;
  scanlineModeButtons: HTMLButtonElement[];
}

interface SliderSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  get: () => number;
  set: (v: number) => void;
}

function buildSlider(spec: SliderSpec, onChange: () => void): { row: HTMLDivElement; input: HTMLInputElement } {
  const row = document.createElement('div');
  row.className = 'param';

  const labelRow = document.createElement('div');
  labelRow.className = 'param__label-row';
  const label = document.createElement('span');
  label.className = 'param__label';
  label.textContent = spec.label;
  const value = document.createElement('span');
  value.className = 'param__value';
  const unit = spec.unit ?? '';
  value.textContent = `${spec.get()}${unit}`;
  labelRow.append(label, value);

  const wrap = document.createElement('div');
  wrap.className = 'slider-wrap';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(spec.min);
  input.max = String(spec.max);
  input.step = String(spec.step ?? 1);
  input.value = String(spec.get());
  input.setAttribute('aria-label', spec.label);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    spec.set(v);
    value.textContent = `${v}${unit}`;
    onChange();
  });
  wrap.appendChild(input);

  row.append(labelRow, wrap);
  return { row, input };
}

function buildModeSelect(
  labelText: string,
  options: { id: string; label: string }[],
  getActive: () => string,
  setActive: (id: string) => void,
  onChange: () => void,
): { row: HTMLDivElement; buttons: HTMLButtonElement[] } {
  const row = document.createElement('div');
  row.className = 'param';
  const label = document.createElement('span');
  label.className = 'param__label';
  label.textContent = labelText;
  const group = document.createElement('div');
  group.className = 'mode-select';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', labelText);

  const buttons: HTMLButtonElement[] = [];
  options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = opt.label;
    btn.className = getActive() === opt.id ? 'is-active' : '';
    btn.addEventListener('click', () => {
      setActive(opt.id);
      buttons.forEach((b, i) => b.classList.toggle('is-active', options[i]?.id === opt.id));
      onChange();
    });
    group.appendChild(btn);
    buttons.push(btn);
  });

  row.append(label, group);
  return { row, buttons };
}

function buildToggle(checked: boolean, onChange: (checked: boolean) => void): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'switch';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  const span = document.createElement('span');
  label.append(input, span);
  return label;
}

function buildLayerPanel(opts: {
  index: string;
  title: string;
  colorVar: string;
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  body: HTMLElement[];
}): { panel: HTMLDivElement; toggleInput: HTMLInputElement } {
  const panel = document.createElement('div');
  panel.className = 'layer-panel';
  panel.style.setProperty('--layer-color', `var(${opts.colorVar})`);
  if (!opts.enabled) panel.classList.add('is-disabled');

  const head = document.createElement('div');
  head.className = 'layer-panel__head';
  const indexEl = document.createElement('span');
  indexEl.className = 'layer-index';
  indexEl.textContent = opts.index;
  const h3 = document.createElement('h3');
  h3.textContent = opts.title;
  const toggleLabel = buildToggle(opts.enabled, (checked) => {
    panel.classList.toggle('is-disabled', !checked);
    opts.onToggle(checked);
  });
  head.append(indexEl, h3, toggleLabel);

  const body = document.createElement('div');
  body.className = 'layer-panel__body';
  body.append(...opts.body);

  panel.append(head, body);
  return { panel, toggleInput: toggleLabel.querySelector('input') as HTMLInputElement };
}

export function buildLayerStack(container: HTMLElement, layers: LayerState, onChange: () => void): LayerUIRefs {
  container.innerHTML = '';

  // Layer 1 — JPEG byte corruption
  const rateSlider = buildSlider(
    {
      key: 'rate',
      label: 'BYTE CORRUPTION RATE',
      min: 0,
      max: 60,
      unit: '%',
      get: () => layers.jpegCorrupt.rate,
      set: (v) => (layers.jpegCorrupt.rate = v),
    },
    onChange,
  );
  const blockSlider = buildSlider(
    {
      key: 'blockSize',
      label: 'CORRUPTION BLOCK SIZE (BYTES)',
      min: 1,
      max: 96,
      unit: 'B',
      get: () => layers.jpegCorrupt.blockSize,
      set: (v) => (layers.jpegCorrupt.blockSize = v),
    },
    onChange,
  );
  const layer1 = buildLayerPanel({
    index: '01',
    title: 'JPEG BYTE CORRUPTION',
    colorVar: '--magenta',
    enabled: layers.jpegCorrupt.enabled,
    onToggle: (checked) => {
      layers.jpegCorrupt.enabled = checked;
      onChange();
    },
    body: [rateSlider.row, blockSlider.row],
  });

  // Layer 2 — row pixel shift
  const shiftSlider = buildSlider(
    {
      key: 'maxShift',
      label: 'MAX SHIFT (PX)',
      min: 0,
      max: 80,
      unit: 'px',
      get: () => layers.rowShift.maxShift,
      set: (v) => (layers.rowShift.maxShift = v),
    },
    onChange,
  );
  const bandSlider = buildSlider(
    {
      key: 'bandHeight',
      label: 'BAND HEIGHT (PX)',
      min: 1,
      max: 60,
      unit: 'px',
      get: () => layers.rowShift.bandHeight,
      set: (v) => (layers.rowShift.bandHeight = v),
    },
    onChange,
  );
  const rowShiftMode = buildModeSelect(
    'OFFSET MODE',
    [
      { id: 'random', label: 'RANDOM' },
      { id: 'wave', label: 'WAVE' },
    ],
    () => layers.rowShift.mode,
    (id) => (layers.rowShift.mode = id as 'random' | 'wave'),
    onChange,
  );
  const layer2 = buildLayerPanel({
    index: '02',
    title: 'ROW PIXEL SHIFT',
    colorVar: '--cyan',
    enabled: layers.rowShift.enabled,
    onToggle: (checked) => {
      layers.rowShift.enabled = checked;
      onChange();
    },
    body: [shiftSlider.row, bandSlider.row, rowShiftMode.row],
  });

  // Layer 3 — channel drift
  const channelSlider = buildSlider(
    {
      key: 'maxOffset',
      label: 'CHANNEL DRIFT (PX)',
      min: 0,
      max: 30,
      unit: 'px',
      get: () => layers.channelShift.maxOffset,
      set: (v) => (layers.channelShift.maxOffset = v),
    },
    onChange,
  );
  const layer3 = buildLayerPanel({
    index: '03',
    title: 'CHANNEL SEPARATION',
    colorVar: '--green',
    enabled: layers.channelShift.enabled,
    onToggle: (checked) => {
      layers.channelShift.enabled = checked;
      onChange();
    },
    body: [channelSlider.row],
  });

  // Layer 4 — scanline replace
  const densitySlider = buildSlider(
    {
      key: 'density',
      label: 'SCAN LINE DENSITY',
      min: 0,
      max: 100,
      unit: '%',
      get: () => layers.scanline.density,
      set: (v) => (layers.scanline.density = v),
    },
    onChange,
  );
  const scanlineMode = buildModeSelect(
    'REPLACE MODE',
    [
      { id: 'noise', label: 'NOISE' },
      { id: 'duplicate', label: 'DUPLICATE' },
    ],
    () => layers.scanline.mode,
    (id) => (layers.scanline.mode = id as 'noise' | 'duplicate'),
    onChange,
  );
  const layer4 = buildLayerPanel({
    index: '04',
    title: 'SCAN LINE REPLACE',
    colorVar: '--magenta',
    enabled: layers.scanline.enabled,
    onToggle: (checked) => {
      layers.scanline.enabled = checked;
      onChange();
    },
    body: [densitySlider.row, scanlineMode.row],
  });

  container.append(layer1.panel, layer2.panel, layer3.panel, layer4.panel);

  return {
    jpegRate: rateSlider.input,
    jpegBlock: blockSlider.input,
    jpegEnabled: layer1.toggleInput,
    rowShiftMax: shiftSlider.input,
    rowShiftBand: bandSlider.input,
    rowShiftEnabled: layer2.toggleInput,
    rowShiftModeButtons: rowShiftMode.buttons,
    channelOffset: channelSlider.input,
    channelEnabled: layer3.toggleInput,
    scanlineDensity: densitySlider.input,
    scanlineEnabled: layer4.toggleInput,
    scanlineModeButtons: scanlineMode.buttons,
  };
}

/** Re-syncs already-built slider/toggle DOM elements to the current LayerState (used after preset apply / reroll-adjacent state changes). */
export function syncLayerUI(refs: LayerUIRefs, layers: LayerState): void {
  refs.jpegRate.value = String(layers.jpegCorrupt.rate);
  refs.jpegBlock.value = String(layers.jpegCorrupt.blockSize);
  refs.jpegEnabled.checked = layers.jpegCorrupt.enabled;
  refs.jpegEnabled.closest('.layer-panel')?.classList.toggle('is-disabled', !layers.jpegCorrupt.enabled);

  refs.rowShiftMax.value = String(layers.rowShift.maxShift);
  refs.rowShiftBand.value = String(layers.rowShift.bandHeight);
  refs.rowShiftEnabled.checked = layers.rowShift.enabled;
  refs.rowShiftEnabled.closest('.layer-panel')?.classList.toggle('is-disabled', !layers.rowShift.enabled);
  refs.rowShiftModeButtons.forEach((b) => b.classList.toggle('is-active', b.textContent === layers.rowShift.mode.toUpperCase()));

  refs.channelOffset.value = String(layers.channelShift.maxOffset);
  refs.channelEnabled.checked = layers.channelShift.enabled;
  refs.channelEnabled.closest('.layer-panel')?.classList.toggle('is-disabled', !layers.channelShift.enabled);

  refs.scanlineDensity.value = String(layers.scanline.density);
  refs.scanlineEnabled.checked = layers.scanline.enabled;
  refs.scanlineEnabled.closest('.layer-panel')?.classList.toggle('is-disabled', !layers.scanline.enabled);
  refs.scanlineModeButtons.forEach((b) => b.classList.toggle('is-active', b.textContent === layers.scanline.mode.toUpperCase()));

  // Refresh visible numeric readouts next to each slider.
  document.querySelectorAll<HTMLElement>('.param').forEach((row) => {
    const input = row.querySelector('input[type="range"]') as HTMLInputElement | null;
    const out = row.querySelector('.param__value') as HTMLElement | null;
    if (input && out) {
      const unit = out.textContent?.replace(/[-\d.]/g, '') ?? '';
      out.textContent = `${input.value}${unit}`;
    }
  });
}
