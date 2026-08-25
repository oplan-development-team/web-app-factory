import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResponseSlider } from "../../src/app/ui/response-slider";
import { ResolutionPicker } from "../../src/app/ui/resolution-picker";
import { RESOLUTION_PRESETS, resolveResolution } from "../../src/core/export-presets";
import { RESPONSE_LABELS } from "../../src/core/ribbon-metrics";

beforeEach(() => {
  document.body.innerHTML = "";
});

function mountSlider(value = 50): {
  input: HTMLInputElement;
  readout: HTMLElement;
  slider: ResponseSlider;
  onChange: ReturnType<typeof vi.fn>;
} {
  const input = document.createElement("input");
  const readout = document.createElement("span");
  document.body.append(input, readout);
  const onChange = vi.fn();
  return { input, readout, onChange, slider: new ResponseSlider({ input, readout, value, onChange }) };
}

describe("ResponseSlider", () => {
  it("configures the input as a 0-100 range", () => {
    const { input } = mountSlider();
    expect(input.type).toBe("range");
    expect(input.min).toBe("0");
    expect(input.max).toBe("100");
  });

  it("starts at the given value", () => {
    const { input, readout } = mountSlider(20);
    expect(input.value).toBe("20");
    expect(readout.textContent).toBe(RESPONSE_LABELS.calm);
  });

  it("names the zone rather than showing a bare number (FR-013.4)", () => {
    const { input, readout } = mountSlider();
    expect(readout.textContent).toBe(RESPONSE_LABELS.balanced);
    input.value = "90";
    input.dispatchEvent(new Event("input"));
    expect(readout.textContent).toBe(RESPONSE_LABELS.volatile);
  });

  it("reports changes as a number", () => {
    const { input, onChange } = mountSlider();
    input.value = "77";
    input.dispatchEvent(new Event("input"));
    expect(onChange).toHaveBeenCalledWith(77);
  });

  it("exposes the zone name to assistive technology", () => {
    const { input } = mountSlider(5);
    expect(input.getAttribute("aria-valuetext")).toBe(RESPONSE_LABELS.calm);
    expect(input.getAttribute("aria-label")).toContain("レスポンス");
  });

  it("drives the custom track fill via a CSS variable", () => {
    const { input } = mountSlider(30);
    expect(input.style.getPropertyValue("--slider-progress")).toBe("30%");
  });

  it("reflects an external value without firing the callback", () => {
    const { slider, input, readout, onChange } = mountSlider();
    slider.setValue(100);
    expect(input.value).toBe("100");
    expect(readout.textContent).toBe(RESPONSE_LABELS.volatile);
    expect(onChange).not.toHaveBeenCalled();
  });
});

function mountPicker(): {
  container: HTMLElement;
  readout: HTMLElement;
  picker: ResolutionPicker;
  onSelect: ReturnType<typeof vi.fn>;
  buttons: HTMLButtonElement[];
} {
  const container = document.createElement("div");
  const readout = document.createElement("p");
  document.body.append(container, readout);
  const onSelect = vi.fn();
  const picker = new ResolutionPicker({ container, readout, selected: "edition", onSelect });
  return { container, readout, picker, onSelect, buttons: [...container.querySelectorAll("button")] };
}

describe("ResolutionPicker", () => {
  it("renders a segment per preset, not a native select (NFR-004.4)", () => {
    const { container, buttons } = mountPicker();
    expect(buttons).toHaveLength(RESOLUTION_PRESETS.length);
    expect(container.querySelector("select")).toBeNull();
    expect(container.getAttribute("role")).toBe("radiogroup");
  });

  it("labels segments with the preset name", () => {
    const { buttons } = mountPicker();
    expect(buttons.map((button) => button.textContent)).toEqual(
      RESOLUTION_PRESETS.map((preset) => preset.label)
    );
  });

  it("shows the concrete pixel size of the current choice (FR-010.2)", () => {
    const { readout } = mountPicker();
    const edition = resolveResolution("edition");
    expect(readout.textContent).toContain(`${edition.width} × ${edition.height} px`);
  });

  it("updates the readout when another size is chosen", () => {
    const { buttons, readout, onSelect } = mountPicker();
    buttons[2]!.click();
    const archival = resolveResolution("archival");
    expect(onSelect).toHaveBeenCalledWith("archival");
    expect(readout.textContent).toContain(`${archival.width} × ${archival.height} px`);
  });

  it("marks the selection and keeps only it in the tab order", () => {
    const { buttons } = mountPicker();
    expect(buttons[1]!.getAttribute("aria-checked")).toBe("true");
    expect(buttons[1]!.tabIndex).toBe(0);
    expect(buttons[0]!.tabIndex).toBe(-1);
  });

  it("puts the pixel size in the accessible name too", () => {
    const { buttons } = mountPicker();
    const study = resolveResolution("study");
    expect(buttons[0]!.getAttribute("aria-label")).toContain(`${study.width}×${study.height}px`);
  });

  it("stays silent when the current size is clicked again", () => {
    const { buttons, onSelect } = mountPicker();
    buttons[1]!.click();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("reflects an external selection without firing the callback", () => {
    const { picker, buttons, onSelect } = mountPicker();
    picker.setSelected("study");
    expect(buttons[0]!.getAttribute("aria-checked")).toBe("true");
    expect(onSelect).not.toHaveBeenCalled();
  });
});
