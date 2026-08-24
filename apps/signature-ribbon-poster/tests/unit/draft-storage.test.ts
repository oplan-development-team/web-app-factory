import { beforeEach, describe, expect, it } from "vitest";
import { DRAFT_STORAGE_KEY, DraftStorage } from "../../src/core/draft-storage";
import type { DraftSnapshot } from "../../src/core/draft";

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

const snapshot: DraftSnapshot = {
  backgroundId: "noir",
  hueId: "gold",
  response: 50,
  resolutionId: "edition",
  caption: "",
  strokes: [{ colorId: "gold", points: [{ x: 1, y: 2, t: 0, speed: 0 }] }],
};

describe("DraftStorage", () => {
  let backing: Storage;

  beforeEach(() => {
    backing = memoryStorage();
  });

  it("saves and loads a draft", () => {
    const storage = new DraftStorage(backing);
    expect(storage.save(snapshot)).toBe(true);
    expect(storage.load()?.strokes).toHaveLength(1);
  });

  it("uses a namespaced key", () => {
    new DraftStorage(backing).save(snapshot);
    expect(backing.getItem(DRAFT_STORAGE_KEY)).not.toBeNull();
    expect(DRAFT_STORAGE_KEY).toContain("signature-ribbon");
  });

  it("returns null when nothing is stored", () => {
    expect(new DraftStorage(backing).load()).toBeNull();
  });

  it("deletes and reports null when the stored value is corrupt (E-09)", () => {
    backing.setItem(DRAFT_STORAGE_KEY, "{{{");
    const storage = new DraftStorage(backing);
    expect(storage.load()).toBeNull();
    expect(backing.getItem(DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("clears the stored draft", () => {
    const storage = new DraftStorage(backing);
    storage.save(snapshot);
    storage.clear();
    expect(storage.load()).toBeNull();
  });

  it("reports a failed save instead of throwing when the quota is exceeded (E-08)", () => {
    const throwing = memoryStorage({
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    });
    expect(new DraftStorage(throwing).save(snapshot)).toBe(false);
  });

  it("survives a backing store that throws on read", () => {
    const throwing = memoryStorage({
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(new DraftStorage(throwing).load()).toBeNull();
  });

  it("survives a backing store that throws on remove", () => {
    const throwing = memoryStorage({
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => new DraftStorage(throwing).clear()).not.toThrow();
  });

  it("is a no-op when no backing store is available at all (private mode)", () => {
    const storage = new DraftStorage(null);
    expect(storage.save(snapshot)).toBe(false);
    expect(storage.load()).toBeNull();
    expect(() => storage.clear()).not.toThrow();
  });

  it("resolves the ambient localStorage when constructed without an argument", () => {
    const storage = new DraftStorage();
    try {
      expect(storage.save(snapshot)).toBe(true);
      expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull();
      expect(storage.load()?.strokes).toHaveLength(1);
    } finally {
      storage.clear();
    }
  });
});
