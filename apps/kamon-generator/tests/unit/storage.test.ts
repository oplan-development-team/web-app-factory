import { beforeEach, describe, expect, it } from "vitest";
import {
  type KeyValueStore,
  type PlateRecord,
  MAX_PLATES,
  STORAGE_KEY,
  appendPlate,
  clearPlates,
  findPlate,
  loadPlates,
  resolveStore,
  savePlates,
} from "../../src/lib/storage";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function plate(n: number): PlateRecord {
  return {
    plateNo: n,
    name: `名${n}`,
    birthday: "1998-04-12",
    seedText: `名${n} / 1998-04-12`,
    variantIndex: 0,
    savedAt: 1_700_000_000_000 + n,
  };
}

let store: ReturnType<typeof memoryStore>;

beforeEach(() => {
  store = memoryStore();
});

describe("loadPlates / savePlates", () => {
  it("保存した図版をそのまま読み戻せる (AC-16)", () => {
    const plates = [plate(1), plate(2), plate(3)];
    expect(savePlates(store, plates)).toBe(true);
    expect(loadPlates(store)).toEqual(plates);
  });

  it("保存が無い場合は空配列", () => {
    expect(loadPlates(store)).toEqual([]);
  });

  it("store が null なら空配列を返し、保存は false", () => {
    expect(loadPlates(null)).toEqual([]);
    expect(savePlates(null, [plate(1)])).toBe(false);
    expect(clearPlates(null)).toBe(false);
  });

  it("壊れた JSON を捨てて空から始める (FR-301.3)", () => {
    store.data.set(STORAGE_KEY, "{ これは JSON ではない");
    expect(loadPlates(store)).toEqual([]);
  });

  it("配列でない値を捨てる", () => {
    store.data.set(STORAGE_KEY, JSON.stringify({ plateNo: 1 }));
    expect(loadPlates(store)).toEqual([]);
  });

  it("スキーマ不一致の項目だけを捨てて残りを読む (FR-301.3)", () => {
    store.data.set(
      STORAGE_KEY,
      JSON.stringify([
        plate(1),
        { plateNo: "2", seedText: "x" },
        null,
        { ...plate(3), seedText: "" },
        { ...plate(4), variantIndex: -1 },
        plate(5),
      ]),
    );
    expect(loadPlates(store).map((p) => p.plateNo)).toEqual([1, 5]);
  });

  it("保存時に上限を超えた分は古い方から捨てる (FR-301.2 / AC-18)", () => {
    const many = Array.from({ length: MAX_PLATES + 12 }, (_, i) => plate(i + 1));
    savePlates(store, many);
    const loaded = loadPlates(store);
    expect(loaded).toHaveLength(MAX_PLATES);
    expect(loaded[0]!.plateNo).toBe(13);
    expect(loaded.at(-1)!.plateNo).toBe(MAX_PLATES + 12);
  });

  it("読み込み時にも上限を超えた分を切り詰める", () => {
    store.data.set(
      STORAGE_KEY,
      JSON.stringify(Array.from({ length: MAX_PLATES + 5 }, (_, i) => plate(i + 1))),
    );
    expect(loadPlates(store)).toHaveLength(MAX_PLATES);
  });

  it("書き込みが例外を投げても false を返して継続できる (FR-301.4)", () => {
    const failing: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("QuotaExceededError");
      },
      removeItem: () => undefined,
    };
    expect(savePlates(failing, [plate(1)])).toBe(false);
  });

  it("読み込みが例外を投げても空配列を返す", () => {
    const failing: KeyValueStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(loadPlates(failing)).toEqual([]);
  });
});

describe("clearPlates", () => {
  it("保存を消す (AC-19)", () => {
    savePlates(store, [plate(1)]);
    expect(clearPlates(store)).toBe(true);
    expect(loadPlates(store)).toEqual([]);
  });

  it("削除が例外を投げても false を返す", () => {
    const failing: KeyValueStore = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(clearPlates(failing)).toBe(false);
  });
});

describe("appendPlate", () => {
  it("元の配列を変更せずに追加する", () => {
    const original = [plate(1)];
    const next = appendPlate(original, plate(2));
    expect(original).toHaveLength(1);
    expect(next.map((p) => p.plateNo)).toEqual([1, 2]);
  });

  it("上限を超えたら先頭を落とす", () => {
    const full = Array.from({ length: MAX_PLATES }, (_, i) => plate(i + 1));
    const next = appendPlate(full, plate(999));
    expect(next).toHaveLength(MAX_PLATES);
    expect(next[0]!.plateNo).toBe(2);
    expect(next.at(-1)!.plateNo).toBe(999);
  });
});

describe("findPlate", () => {
  it("同一シード・同一バリアントを見つける (FR-300.2)", () => {
    const plates = [plate(1), { ...plate(2), variantIndex: 3 }];
    expect(findPlate(plates, plates[1]!.seedText, 3)?.plateNo).toBe(2);
    expect(findPlate(plates, plates[1]!.seedText, 0)).toBeUndefined();
    expect(findPlate(plates, "無い", 0)).toBeUndefined();
  });
});

describe("resolveStore", () => {
  it("読み書きできる store をそのまま返す", () => {
    expect(resolveStore(store)).toBe(store);
  });

  it("undefined なら null", () => {
    expect(resolveStore(undefined)).toBeNull();
  });

  it("書き込みが例外を投げる store は null を返す (FR-301.4 / AC-17)", () => {
    const blocked: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error("private mode");
      },
      removeItem: () => undefined,
    };
    expect(resolveStore(blocked)).toBeNull();
  });

  it("試し書きの痕跡を残さない", () => {
    resolveStore(store);
    expect(store.data.size).toBe(0);
  });
});
