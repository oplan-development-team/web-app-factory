import { responseLabel } from "../../core/ribbon-metrics";

export interface ResponseSliderOptions {
  readonly input: HTMLInputElement;
  readonly readout: HTMLElement;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

/**
 * The response slider. Its readout names the zone (Calm / Balanced / Volatile)
 * rather than showing a bare number, because the number on its own says nothing
 * about what the ribbon will look like (FR-013.4).
 */
export class ResponseSlider {
  constructor(private readonly options: ResponseSliderOptions) {
    const { input } = options;
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    input.setAttribute("aria-label", "リボンのレスポンス（速度への感度）");

    input.addEventListener("input", () => {
      const value = Number(input.value);
      this.reflect(value);
      options.onChange(value);
    });

    this.setValue(options.value);
  }

  /** Reflects an externally driven change, e.g. restoring a draft. */
  setValue(value: number): void {
    this.options.input.value = String(value);
    this.reflect(value);
  }

  private reflect(value: number): void {
    const label = responseLabel(value);
    this.options.readout.textContent = label;
    this.options.input.setAttribute("aria-valuetext", label);
    // Drives the filled portion of the custom track.
    this.options.input.style.setProperty("--slider-progress", `${value}%`);
  }
}
