import { describe, expect, it } from "vitest";
import {
  defaultStorage,
  isWritable,
  loadCollection,
  saveCollection,
  type StorageLike,
} from "../../src/lib/storage.ts";
import { recordSpecimen } from "../../src/lib/collection.ts";
import { STORAGE_KEY } from "../../src/lib/constants.ts";
import type { Collection, Specimen } from "../../src/lib/types.ts";

const NOW = new Date("2026-09-02T04:00:00.000Z");

const SPECIMEN: Specimen = {
  family: "RADIAL",
  rarity: "EPIC",
  seed: 42,
  bucket: "DIAGONAL",
  fromSensor: true,
};

/** メモリ上の Storage。実 localStorage に依存せず往復を検証する。 */
function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/** すべての操作が例外を投げる Storage。 */
function throwingStorage(): StorageLike {
  return {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {
      throw new Error("SecurityError");
    },
  };
}

/** 読めるが書けない Storage。Safari のプライベートモード相当。 */
function readOnlyStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
}

describe("isWritable", () => {
  it("書ける Storage では true", () => {
    expect(isWritable(memoryStorage())).toBe(true);
  });

  it("null では false", () => {
    expect(isWritable(null)).toBe(false);
  });

  it("読めるが書けない Storage では false（Safari プライベート相当）", () => {
    expect(isWritable(readOnlyStorage())).toBe(false);
  });

  it("プローブ用のキーを残さない", () => {
    const map: Record<string, string> = {};
    const storage: StorageLike = {
      getItem: (k) => map[k] ?? null,
      setItem: (k, v) => {
        map[k] = v;
      },
      removeItem: (k) => {
        delete map[k];
      },
    };
    isWritable(storage);
    expect(Object.keys(map)).toEqual([]);
  });
});

describe("loadCollection", () => {
  it("空の Storage からは空の Collection を返し、永続化は可能と報告する", () => {
    expect(loadCollection(memoryStorage())).toEqual({ collection: {}, persistent: true });
  });

  it("storage が null なら非永続として空を返す", () => {
    expect(loadCollection(null)).toEqual({ collection: {}, persistent: false });
  });

  it("すべて例外を投げる Storage でも停止せず非永続として扱う（AC-16）", () => {
    expect(loadCollection(throwingStorage())).toEqual({ collection: {}, persistent: false });
  });

  it("読めても書けない Storage は persistent=false と報告する", () => {
    const { collection } = recordSpecimen({}, SPECIMEN, NOW);
    const raw = JSON.stringify({ version: 1, entries: collection });
    const result = loadCollection(readOnlyStorage({ [STORAGE_KEY]: raw }));

    // 読めた内容は活かしつつ、保存はできないと正しく報告する
    expect(result.collection).toEqual(collection);
    expect(result.persistent).toBe(false);
  });

  it("破損した内容でも例外を投げず空を返す", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "{壊れた" });
    expect(loadCollection(storage).collection).toEqual({});
    expect(loadCollection(storage).persistent).toBe(true);
  });
});

describe("saveCollection", () => {
  it("保存して読み戻すと一致する（AC-14）", () => {
    const storage = memoryStorage();
    const { collection } = recordSpecimen({}, SPECIMEN, NOW);

    expect(saveCollection(storage, collection)).toBe(true);
    expect(loadCollection(storage).collection).toEqual(collection);
  });

  it("storage が null なら false を返すだけで例外を投げない", () => {
    expect(saveCollection(null, {})).toBe(false);
  });

  it("setItem が例外を投げても false を返すだけで伝播させない（AC-16）", () => {
    expect(() => saveCollection(throwingStorage(), {})).not.toThrow();
    expect(saveCollection(throwingStorage(), {})).toBe(false);
  });

  it("書き込みに失敗してもアプリ側の Collection は使い続けられる", () => {
    const collection: Collection = recordSpecimen({}, SPECIMEN, NOW).collection;
    saveCollection(throwingStorage(), collection);
    expect(Object.keys(collection)).toEqual(["RADIAL:EPIC"]);
  });

  it("STORAGE_KEY の下に書き込む", () => {
    const map: Record<string, string> = {};
    const storage: StorageLike = {
      getItem: (k) => map[k] ?? null,
      setItem: (k, v) => {
        map[k] = v;
      },
      removeItem: (k) => {
        delete map[k];
      },
    };
    saveCollection(storage, {});
    expect(Object.keys(map)).toEqual([STORAGE_KEY]);
  });
});

describe("defaultStorage", () => {
  it("環境に依存せず例外を投げない", () => {
    // Node 25 は組み込みの localStorage を持つため「node だから null」とは限らない。
    // 実装が保証するのは「例外を投げないこと」だけ。
    expect(() => defaultStorage()).not.toThrow();
  });

  it("戻り値は null か、必要な操作を備えた Storage のいずれか", () => {
    const storage = defaultStorage();
    if (storage !== null) {
      expect(typeof storage.getItem).toBe("function");
      expect(typeof storage.setItem).toBe("function");
      expect(typeof storage.removeItem).toBe("function");
    } else {
      expect(storage).toBeNull();
    }
  });
});
