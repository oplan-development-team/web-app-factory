import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOSAVE_DELAY_MS, DraftSync } from "../../src/app/draft-sync";
import { Studio } from "../../src/app/studio";
import { DraftStorage } from "../../src/core/draft-storage";

function memoryStorage(overrides: Partial<Storage> = {}): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    ...overrides,
  } as Storage;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DraftSync", () => {
  it("uses an 800ms debounce (FR-011.1)", () => {
    expect(AUTOSAVE_DELAY_MS).toBe(800);
  });

  it("saves after the debounce elapses", () => {
    const studio = new Studio();
    const storage = new DraftStorage(memoryStorage());
    const sync = new DraftSync({ studio, storage, onSaveFailed: vi.fn() });

    studio.setCaption("Hotta");
    expect(storage.load()).toBeNull();

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(storage.load()?.caption).toBe("Hotta");
    sync.dispose();
  });

  it("collapses a burst of changes into a single write", () => {
    const studio = new Studio();
    const setItem = vi.fn();
    const storage = new DraftStorage(memoryStorage({ setItem }));
    const sync = new DraftSync({ studio, storage, onSaveFailed: vi.fn() });

    studio.setCaption("a");
    studio.setCaption("ab");
    studio.setCaption("abc");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    expect(setItem).toHaveBeenCalledTimes(1);
    sync.dispose();
  });

  it("does not save on every point while a stroke is being drawn", () => {
    const studio = new Studio();
    const setItem = vi.fn();
    const storage = new DraftStorage(memoryStorage({ setItem }));
    const sync = new DraftSync({ studio, storage, onSaveFailed: vi.fn() });

    studio.beginStroke({ x: 0, y: 0 }, 0);
    for (let i = 1; i <= 20; i++) {
      studio.extendStroke({ x: i * 20, y: 0 }, i * 10);
    }
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(setItem).not.toHaveBeenCalled();

    studio.finishStroke();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(setItem).toHaveBeenCalledTimes(1);
    sync.dispose();
  });

  it("persists committed strokes", () => {
    const studio = new Studio();
    const storage = new DraftStorage(memoryStorage());
    const sync = new DraftSync({ studio, storage, onSaveFailed: vi.fn() });

    studio.beginStroke({ x: 10, y: 10 }, 0);
    studio.extendStroke({ x: 200, y: 100 }, 20);
    studio.finishStroke();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    expect(storage.load()?.strokes).toHaveLength(1);
    sync.dispose();
  });

  it("writes the emptied state after a clear (FR-011.6)", () => {
    const studio = new Studio();
    const storage = new DraftStorage(memoryStorage());
    const sync = new DraftSync({ studio, storage, onSaveFailed: vi.fn() });

    studio.beginStroke({ x: 10, y: 10 }, 0);
    studio.extendStroke({ x: 200, y: 100 }, 20);
    studio.finishStroke();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    studio.clear();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(storage.load()?.strokes).toEqual([]);
    sync.dispose();
  });

  it("reports a save failure exactly once (FR-011.5, E-08)", () => {
    const studio = new Studio();
    const onSaveFailed = vi.fn();
    const storage = new DraftStorage(null);
    const sync = new DraftSync({ studio, storage, onSaveFailed });

    studio.setCaption("a");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    studio.setCaption("ab");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    expect(onSaveFailed).toHaveBeenCalledTimes(1);
    sync.dispose();
  });

  it("flushes on demand without waiting for the debounce", () => {
    const studio = new Studio();
    const storage = new DraftStorage(memoryStorage());
    const sync = new DraftSync({ studio, storage, onSaveFailed: vi.fn() });

    studio.setCaption("Hotta");
    sync.flush();
    expect(storage.load()?.caption).toBe("Hotta");
    sync.dispose();
  });

  it("stops saving once disposed", () => {
    const studio = new Studio();
    const setItem = vi.fn();
    const storage = new DraftStorage(memoryStorage({ setItem }));
    const sync = new DraftSync({ studio, storage, onSaveFailed: vi.fn() });

    studio.setCaption("Hotta");
    sync.dispose();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
    studio.setCaption("more");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);

    expect(setItem).not.toHaveBeenCalled();
  });

  it("accepts a custom delay", () => {
    const studio = new Studio();
    const storage = new DraftStorage(memoryStorage());
    const sync = new DraftSync({ studio, storage, onSaveFailed: vi.fn(), delayMs: 50 });

    studio.setCaption("Hotta");
    vi.advanceTimersByTime(50);
    expect(storage.load()?.caption).toBe("Hotta");
    sync.dispose();
  });
});
