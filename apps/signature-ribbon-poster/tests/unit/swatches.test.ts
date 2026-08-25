import { beforeEach, describe, expect, it, vi } from "vitest";
import { SwatchGroup } from "../../src/app/ui/swatches";
import { RIBBON_HUES, type RibbonHueId } from "../../src/core/palette";

function mount(onSelect = vi.fn()): {
  container: HTMLElement;
  group: SwatchGroup<RibbonHueId>;
  onSelect: ReturnType<typeof vi.fn>;
  buttons: HTMLButtonElement[];
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const group = new SwatchGroup<RibbonHueId>({
    container,
    presets: RIBBON_HUES,
    selected: "gold",
    onSelect,
  });
  return {
    container,
    group,
    onSelect,
    buttons: [...container.querySelectorAll("button")],
  };
}

function press(button: HTMLButtonElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  button.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("SwatchGroup", () => {
  it("renders one radio per preset inside a radiogroup", () => {
    const { container, buttons } = mount();
    expect(container.getAttribute("role")).toBe("radiogroup");
    expect(buttons).toHaveLength(RIBBON_HUES.length);
    expect(buttons.every((button) => button.getAttribute("role") === "radio")).toBe(true);
  });

  it("labels each swatch so its colour is not the only cue (NFR-006.3)", () => {
    const { buttons } = mount();
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(
      RIBBON_HUES.map((hue) => hue.label)
    );
  });

  it("exposes the colour to CSS as a custom property", () => {
    const { buttons } = mount();
    expect(buttons[0]!.style.getPropertyValue("--swatch-color")).toBe(RIBBON_HUES[0]!.hex);
  });

  it("marks the initial selection", () => {
    const { buttons } = mount();
    expect(buttons[0]!.getAttribute("aria-checked")).toBe("true");
    expect(buttons[1]!.getAttribute("aria-checked")).toBe("false");
  });

  it("keeps only the selected swatch in the tab order", () => {
    const { buttons } = mount();
    expect(buttons[0]!.tabIndex).toBe(0);
    expect(buttons.slice(1).every((button) => button.tabIndex === -1)).toBe(true);
  });

  it("reports a click", () => {
    const { buttons, onSelect } = mount();
    buttons[2]!.click();
    expect(onSelect).toHaveBeenCalledWith("crimson");
    expect(buttons[2]!.getAttribute("aria-checked")).toBe("true");
  });

  it("stays silent when the already-selected swatch is clicked", () => {
    const { buttons, onSelect } = mount();
    buttons[0]!.click();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("moves the selection with the arrow keys (NFR-006.1)", () => {
    const { buttons, onSelect } = mount();
    press(buttons[0]!, "ArrowRight");
    expect(onSelect).toHaveBeenCalledWith("ice-blue");
    press(buttons[1]!, "ArrowDown");
    expect(onSelect).toHaveBeenLastCalledWith("crimson");
  });

  it("wraps around at both ends", () => {
    const { buttons, onSelect } = mount();
    press(buttons[0]!, "ArrowLeft");
    expect(onSelect).toHaveBeenCalledWith(RIBBON_HUES.at(-1)!.id);
  });

  it("prevents the default so arrow keys do not also scroll the panel", () => {
    const { buttons } = mount();
    expect(press(buttons[0]!, "ArrowRight").defaultPrevented).toBe(true);
  });

  it("ignores unrelated keys", () => {
    const { buttons, onSelect } = mount();
    const event = press(buttons[0]!, "a");
    expect(onSelect).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("reflects an external selection without firing the callback", () => {
    const { group, buttons, onSelect } = mount();
    group.setSelected("pearl");
    expect(buttons[3]!.getAttribute("aria-checked")).toBe("true");
    expect(onSelect).not.toHaveBeenCalled();
  });
});
