import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RestoreBanner } from "../../src/app/ui/restore-banner";

function mount(strokeCount = 3): {
  host: HTMLElement;
  banner: RestoreBanner;
  onRestore: ReturnType<typeof vi.fn>;
  onDiscard: ReturnType<typeof vi.fn>;
  buttons: HTMLButtonElement[];
} {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const onRestore = vi.fn();
  const onDiscard = vi.fn();
  const banner = new RestoreBanner({ host, strokeCount, onRestore, onDiscard });
  return { host, banner, onRestore, onDiscard, buttons: [...host.querySelectorAll("button")] };
}

beforeEach(() => {
  document.body.innerHTML = "";
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RestoreBanner", () => {
  it("announces itself as a labelled region (NFR-006.2)", () => {
    const { host } = mount();
    const banner = host.firstElementChild!;
    expect(banner.getAttribute("role")).toBe("region");
    expect(banner.getAttribute("aria-label")).toBeTruthy();
  });

  it("says how much work is waiting", () => {
    const { host } = mount(7);
    expect(host.textContent).toContain("7 ストローク");
  });

  it("offers both a restore and a discard action", () => {
    const { buttons } = mount();
    expect(buttons.map((button) => button.textContent)).toEqual(["復元する", "破棄する"]);
  });

  it("restores and dismisses itself", () => {
    const { host, buttons, onRestore, onDiscard } = mount();
    buttons[0]!.click();
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onDiscard).not.toHaveBeenCalled();
    expect(host.children).toHaveLength(0);
  });

  it("discards and dismisses itself", () => {
    const { host, buttons, onDiscard, onRestore } = mount();
    buttons[1]!.click();
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onRestore).not.toHaveBeenCalled();
    expect(host.children).toHaveLength(0);
  });

  it("never restores on its own (FR-011.2)", () => {
    const { onRestore } = mount();
    vi.advanceTimersByTime(10_000);
    expect(onRestore).not.toHaveBeenCalled();
  });

  it("becomes visible on the next tick so the enter transition runs", () => {
    const { host } = mount();
    expect(host.firstElementChild!.classList.contains("is-visible")).toBe(false);
    vi.advanceTimersByTime(0);
    expect(host.firstElementChild!.classList.contains("is-visible")).toBe(true);
  });

  it("puts focus on the restore action", () => {
    const { buttons } = mount();
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("can be dismissed programmatically", () => {
    const { host, banner } = mount();
    banner.dismiss();
    expect(host.children).toHaveLength(0);
  });
});
