import { BLEND_LABELS, PATTERN_LABELS, type BlendMode, type Layer, type PatternType, type StudioState } from '../types';
import { fieldLabels } from '../layerPlan';

export interface LayerPanelCallbacks {
  onParamChange: () => void;
  onStructuralChange: () => void;
  onSelect: (index: number) => void;
}

const BLEND_OPTIONS: { value: BlendMode; label: string }[] = (
  Object.keys(BLEND_LABELS) as BlendMode[]
).map((value) => ({ value, label: BLEND_LABELS[value] }));

const PATTERN_OPTIONS: { value: PatternType; label: string }[] = (
  Object.keys(PATTERN_LABELS) as PatternType[]
).map((value) => ({ value, label: PATTERN_LABELS[value] }));

function fmt(n: number, digits = 0): string {
  return n.toFixed(digits);
}

export function renderLayerPanel(
  container: HTMLElement,
  state: StudioState,
  selectedIndex: number,
  callbacks: LayerPanelCallbacks
): void {
  container.innerHTML = '';

  state.layers.forEach((layer, index) => {
    const labels = fieldLabels(layer.type);
    const card = document.createElement('article');
    card.className = 'layer-card';
    card.dataset.index = String(index);
    if (index === selectedIndex) card.classList.add('layer-card--selected');

    card.innerHTML = `
      <header class="layer-card__head">
        <span class="layer-card__numeral">${String(index + 1).padStart(2, '0')}</span>
        <div class="layer-card__title-group">
          <span class="layer-card__eyebrow">LAYER ${String(index + 1).padStart(2, '0')}</span>
          <select class="layer-card__type" aria-label="レイヤー${index + 1}のパターン種別">
            ${PATTERN_OPTIONS.map(
              (opt) => `<option value="${opt.value}" ${opt.value === layer.type ? 'selected' : ''}>${opt.label}</option>`
            ).join('')}
          </select>
        </div>
        <div class="layer-card__zorder" role="group" aria-label="重なり順">
          <button type="button" class="icon-btn" data-action="front" title="前面へ" ${
            index === state.layers.length - 1 ? 'disabled' : ''
          }>&#9650;</button>
          <button type="button" class="icon-btn" data-action="back" title="背面へ" ${index === 0 ? 'disabled' : ''}>&#9660;</button>
        </div>
      </header>

      <div class="layer-card__fields">
        <div class="field field--slider">
          <div class="field__row">
            <label>${labels.rotation}</label>
            <span class="field__readout" data-readout="rotation">${fmt(layer.rotation)}&deg;</span>
          </div>
          <input type="range" data-param="rotation" min="0" max="180" step="1" value="${layer.rotation}" />
        </div>
        <div class="field field--slider">
          <div class="field__row">
            <label>${labels.spacing}</label>
            <span class="field__readout" data-readout="spacing">${fmt(layer.spacing)}px</span>
          </div>
          <input type="range" data-param="spacing" min="4" max="60" step="1" value="${layer.spacing}" />
        </div>
        <div class="field field--slider">
          <div class="field__row">
            <label>${labels.thickness}</label>
            <span class="field__readout" data-readout="thickness">${fmt(layer.thickness, 1)}px</span>
          </div>
          <input type="range" data-param="thickness" min="0.5" max="16" step="0.5" value="${layer.thickness}" />
        </div>
        <div class="field field--slider">
          <div class="field__row">
            <label>OPACITY</label>
            <span class="field__readout" data-readout="opacity">${fmt(layer.opacity * 100)}%</span>
          </div>
          <input type="range" data-param="opacity" min="0" max="100" step="1" value="${layer.opacity * 100}" />
        </div>
        <div class="field field--color">
          <label for="color-${layer.id}">COLOR</label>
          <input type="color" id="color-${layer.id}" data-param="color" value="${layer.color}" />
        </div>
      </div>

      <div class="layer-card__toggles">
        <label class="checkline">
          <input type="checkbox" data-toggle="blendOverride" ${layer.blendOverride ? 'checked' : ''} />
          <span>OVERRIDE BLEND MODE</span>
        </label>
        <select class="layer-card__blend-select" data-param="blendMode" ${layer.blendOverride ? '' : 'hidden'}>
          ${BLEND_OPTIONS.map(
            (opt) => `<option value="${opt.value}" ${opt.value === layer.blendMode ? 'selected' : ''}>${opt.label}</option>`
          ).join('')}
        </select>
        <label class="checkline">
          <input type="checkbox" data-toggle="kinetic" ${layer.kinetic ? 'checked' : ''} />
          <span>INCLUDE IN KINETIC MOTION</span>
        </label>
      </div>
    `;

    // Selecting a card (for the red "registration mark" highlight) should
    // only happen when clicking the header itself — not when clicking any
    // interactive control inside it. A whole-card click listener would also
    // fire (and rebuild the whole panel via onSelect) whenever a checkbox,
    // select, or slider inside the card is used, racing the control's own
    // native state change.
    const head = card.querySelector<HTMLElement>('.layer-card__head');
    head?.addEventListener('click', (evt) => {
      const target = evt.target as HTMLElement;
      if (target.closest('select, button')) return;
      callbacks.onSelect(index);
    });

    const typeSelect = card.querySelector<HTMLSelectElement>('.layer-card__type');
    typeSelect?.addEventListener('change', () => {
      layer.type = typeSelect.value as PatternType;
      callbacks.onStructuralChange();
    });

    card.querySelectorAll<HTMLButtonElement>('.icon-btn').forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        const action = btn.dataset.action;
        const swapWith = action === 'front' ? index + 1 : index - 1;
        if (swapWith < 0 || swapWith >= state.layers.length) return;
        const tmp = state.layers[index];
        state.layers[index] = state.layers[swapWith];
        state.layers[swapWith] = tmp;
        callbacks.onStructuralChange();
      });
    });

    card.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input) => {
      input.addEventListener('input', () => {
        const param = input.dataset.param as 'rotation' | 'spacing' | 'thickness' | 'opacity';
        const raw = Number(input.value);
        const readout = card.querySelector(`[data-readout="${param}"]`);
        if (param === 'opacity') {
          layer.opacity = raw / 100;
          if (readout) readout.textContent = `${fmt(raw)}%`;
        } else if (param === 'rotation') {
          layer.rotation = raw;
          if (readout) readout.textContent = `${fmt(raw)}°`;
        } else if (param === 'spacing') {
          layer.spacing = raw;
          if (readout) readout.textContent = `${fmt(raw)}px`;
        } else if (param === 'thickness') {
          layer.thickness = raw;
          if (readout) readout.textContent = `${fmt(raw, 1)}px`;
        }
        callbacks.onParamChange();
      });
    });

    const colorInput = card.querySelector<HTMLInputElement>('input[type="color"]');
    colorInput?.addEventListener('input', () => {
      layer.color = colorInput.value;
      callbacks.onParamChange();
    });

    const overrideToggle = card.querySelector<HTMLInputElement>('[data-toggle="blendOverride"]');
    const blendSelect = card.querySelector<HTMLSelectElement>('[data-param="blendMode"]');
    overrideToggle?.addEventListener('change', () => {
      layer.blendOverride = overrideToggle.checked;
      if (blendSelect) blendSelect.hidden = !layer.blendOverride;
      callbacks.onParamChange();
    });
    blendSelect?.addEventListener('change', () => {
      layer.blendMode = blendSelect.value as BlendMode;
      callbacks.onParamChange();
    });

    const kineticToggle = card.querySelector<HTMLInputElement>('[data-toggle="kinetic"]');
    kineticToggle?.addEventListener('change', () => {
      layer.kinetic = kineticToggle.checked;
      callbacks.onParamChange();
    });

    container.appendChild(card);
  });
}

/** Updates only the rotation slider position + readout for each layer,
 * without rebuilding the DOM — used by the Kinetic mode animation loop so
 * dragging another control isn't interrupted 60 times a second. */
export function syncRotationDisplays(container: HTMLElement, layers: Layer[]): void {
  layers.forEach((layer, index) => {
    const card = container.querySelector<HTMLElement>(`.layer-card[data-index="${index}"]`);
    if (!card) return;
    const input = card.querySelector<HTMLInputElement>('input[data-param="rotation"]');
    const readout = card.querySelector('[data-readout="rotation"]');
    if (input && document.activeElement !== input) input.value = String(layer.rotation);
    if (readout) readout.textContent = `${layer.rotation.toFixed(0)}°`;
  });
}
