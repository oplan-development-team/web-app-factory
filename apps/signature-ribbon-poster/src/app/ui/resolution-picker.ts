import { RESOLUTION_PRESETS, type ResolutionId } from "../../core/export-presets";

export interface ResolutionPickerOptions {
  readonly container: HTMLElement;
  readonly readout: HTMLElement;
  readonly selected: ResolutionId;
  readonly onSelect: (id: ResolutionId) => void;
}

/**
 * Segmented control for the export size.
 *
 * Deliberately not a native `<select>`: a dropdown hides the sizes behind a click
 * and looks like stock browser chrome, which would break the gallery-placard feel
 * of the panel (NFR-004.4).
 */
export class ResolutionPicker {
  private readonly buttons: HTMLButtonElement[] = [];
  private selected: ResolutionId;

  constructor(private readonly options: ResolutionPickerOptions) {
    this.selected = options.selected;
    options.container.setAttribute("role", "radiogroup");
    options.container.setAttribute("aria-label", "書き出し解像度");

    for (const preset of RESOLUTION_PRESETS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "segment";
      button.setAttribute("role", "radio");
      button.dataset.id = preset.id;
      button.textContent = preset.label;
      button.setAttribute("aria-label", `${preset.label} — ${preset.width}×${preset.height}px`);
      button.addEventListener("click", () => this.select(preset.id));
      this.buttons.push(button);
      options.container.appendChild(button);
    }

    this.sync();
  }

  private select(id: ResolutionId): void {
    if (this.selected === id) {
      return;
    }
    this.setSelected(id);
    this.options.onSelect(id);
  }

  setSelected(id: ResolutionId): void {
    this.selected = id;
    this.sync();
  }

  private sync(): void {
    RESOLUTION_PRESETS.forEach((preset, index) => {
      const isSelected = preset.id === this.selected;
      const button = this.buttons[index];
      button?.setAttribute("aria-checked", String(isSelected));
      if (button) {
        button.tabIndex = isSelected ? 0 : -1;
      }
      if (isSelected) {
        // Shows the concrete pixel size, so the choice is not just a label (FR-010.2).
        this.options.readout.textContent = `${preset.width} × ${preset.height} px — ${preset.note}`;
      }
    });
  }
}
