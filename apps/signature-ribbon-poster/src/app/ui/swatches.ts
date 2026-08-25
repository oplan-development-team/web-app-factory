import type { ColorPreset } from "../../core/palette";

export interface SwatchGroupOptions<Id extends string> {
  readonly container: HTMLElement;
  readonly presets: readonly ColorPreset<Id>[];
  readonly selected: Id;
  readonly onSelect: (id: Id) => void;
}

/**
 * A radiogroup of colour swatches. Roving tabindex plus arrow-key movement, so
 * the group behaves the way a keyboard user expects (NFR-006.1).
 */
export class SwatchGroup<Id extends string> {
  private readonly buttons: HTMLButtonElement[] = [];
  private selected: Id;

  constructor(private readonly options: SwatchGroupOptions<Id>) {
    this.selected = options.selected;
    options.container.setAttribute("role", "radiogroup");

    for (const preset of options.presets) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "swatch";
      button.style.setProperty("--swatch-color", preset.hex);
      button.setAttribute("role", "radio");
      button.setAttribute("aria-label", preset.label);
      button.title = preset.label;
      button.dataset.id = preset.id;
      button.addEventListener("click", () => this.select(preset.id));
      button.addEventListener("keydown", (event) => this.handleKeydown(event));
      this.buttons.push(button);
      options.container.appendChild(button);
    }

    this.sync();
  }

  private handleKeydown(event: KeyboardEvent): void {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();

    const current = this.options.presets.findIndex((preset) => preset.id === this.selected);
    const count = this.options.presets.length;
    const next = this.options.presets[(current + step + count) % count]!;
    this.select(next.id);
    this.buttons[(current + step + count) % count]?.focus();
  }

  private select(id: Id): void {
    if (this.selected === id) {
      return;
    }
    this.setSelected(id);
    this.options.onSelect(id);
  }

  /** Reflects an externally driven change, e.g. restoring a draft. */
  setSelected(id: Id): void {
    this.selected = id;
    this.sync();
  }

  private sync(): void {
    this.buttons.forEach((button, index) => {
      const isSelected = this.options.presets[index]?.id === this.selected;
      button.setAttribute("aria-checked", String(isSelected));
      button.tabIndex = isSelected ? 0 : -1;
    });
  }
}
