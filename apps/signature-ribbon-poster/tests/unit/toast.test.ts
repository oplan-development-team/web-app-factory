import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOAST_DURATION_MS, TOAST_LEAVE_MS, Toaster } from "../../src/app/ui/toast";

function container(): HTMLElement {
  const element = document.createElement("div");
  document.body.appendChild(element);
  return element;
}

beforeEach(() => {
  document.body.innerHTML = "";
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Toaster", () => {
  it("appends a toast carrying the message", () => {
    const host = container();
    new Toaster(host).success("書き出しました");
    expect(host.textContent).toBe("書き出しました");
  });

  it("marks toasts as a live status region (NFR-006.2)", () => {
    const host = container();
    new Toaster(host).success("保存しました");
    expect(host.firstElementChild!.getAttribute("role")).toBe("status");
  });

  it("announces errors assertively and successes politely", () => {
    const host = container();
    const toaster = new Toaster(host);
    toaster.success("ok");
    toaster.error("ng");
    const [success, error] = [...host.children];
    expect(success!.getAttribute("aria-live")).toBe("polite");
    expect(error!.getAttribute("aria-live")).toBe("assertive");
  });

  it("distinguishes tone with a modifier class", () => {
    const host = container();
    new Toaster(host).error("失敗しました");
    expect(host.firstElementChild!.className).toContain("toast--error");
  });

  it("becomes visible on the next tick so the enter transition runs", () => {
    const host = container();
    new Toaster(host).success("ok");
    expect(host.firstElementChild!.classList.contains("is-visible")).toBe(false);
    vi.advanceTimersByTime(0);
    expect(host.firstElementChild!.classList.contains("is-visible")).toBe(true);
  });

  it("fades out and removes itself automatically", () => {
    const host = container();
    new Toaster(host).success("ok");
    vi.advanceTimersByTime(TOAST_DURATION_MS);
    expect(host.firstElementChild!.classList.contains("is-visible")).toBe(false);
    vi.advanceTimersByTime(TOAST_LEAVE_MS);
    expect(host.children).toHaveLength(0);
  });

  it("stacks concurrent toasts instead of replacing them", () => {
    const host = container();
    const toaster = new Toaster(host);
    toaster.success("one");
    toaster.error("two");
    expect(host.children).toHaveLength(2);
  });

  it("uses text content, never innerHTML, so a caption cannot inject markup (NFR-007.2)", () => {
    const host = container();
    new Toaster(host).error('<img src=x onerror="alert(1)">');
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toContain("<img");
  });

  it("clears everything on dispose", () => {
    const host = container();
    const toaster = new Toaster(host);
    toaster.success("ok");
    toaster.dispose();
    expect(host.children).toHaveLength(0);
    vi.advanceTimersByTime(TOAST_DURATION_MS + TOAST_LEAVE_MS);
    expect(host.children).toHaveLength(0);
  });

  it("honours a custom duration", () => {
    const host = container();
    new Toaster(host, { durationMs: 100, leaveMs: 10 }).success("ok");
    vi.advanceTimersByTime(110);
    expect(host.children).toHaveLength(0);
  });
});
