import { INK_PRESETS } from '../core/presets';

/** スライダーと数値表示の結線。 */
export function bindSlider(
  input: HTMLInputElement,
  output: HTMLOutputElement,
  apply: (value: number) => void,
): void {
  const sync = (): void => {
    output.textContent = input.value;
    apply(Number(input.value));
  };
  input.addEventListener('input', sync);
  output.textContent = input.value;
}

export function bindRadioGroup<T extends string>(name: string, apply: (value: T) => void): void {
  for (const input of document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)) {
    input.addEventListener('change', () => {
      if (input.checked) apply(input.value as T);
    });
  }
}

/** インク・紙色のスウォッチを組む。 */
export function buildInkSwatches(container: HTMLElement, selectedId: string, onSelect: (id: string) => void): void {
  container.textContent = '';

  for (const preset of INK_PRESETS) {
    const label = document.createElement('label');
    label.className = 'swatch';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'inkPreset';
    input.value = preset.id;
    input.checked = preset.id === selectedId;
    input.addEventListener('change', () => {
      if (input.checked) onSelect(preset.id);
    });

    const chip = document.createElement('span');
    chip.className = 'swatch__chip';
    // インクと紙の対を斜めに割った見本。単色の丸より、実際に出る2色が分かる
    chip.style.background = `linear-gradient(135deg, ${preset.ink} 0%, ${preset.ink} 58%, ${preset.paper} 58%, ${preset.paper} 100%)`;

    const name = document.createElement('span');
    name.className = 'swatch__name';
    name.textContent = preset.label;

    label.append(input, chip, name);
    container.appendChild(label);
  }
}
