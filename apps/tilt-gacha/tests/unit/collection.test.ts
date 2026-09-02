import { describe, expect, it } from "vitest";
import {
  collectedCount,
  collectedInFamily,
  isValidTypeId,
  parseCollection,
  progress,
  recordSpecimen,
  serializeCollection,
  typeIdOf,
} from "../../src/lib/collection.ts";
import { SCHEMA_VERSION, TOTAL_TYPES } from "../../src/lib/constants.ts";
import type { Collection, Specimen } from "../../src/lib/types.ts";

const NOW = new Date("2026-09-02T04:00:00.000Z");
const LATER = new Date("2026-09-03T09:30:00.000Z");

function specimen(overrides: Partial<Specimen> = {}): Specimen {
  return {
    family: "FLOW",
    rarity: "RARE",
    seed: 123456,
    bucket: "UPRIGHT",
    fromSensor: true,
    ...overrides,
  };
}

describe("typeIdOf / isValidTypeId", () => {
  it("系統とレア度から ID を組み立てる", () => {
    expect(typeIdOf("RADIAL", "EPIC")).toBe("RADIAL:EPIC");
  });

  it("12 種すべてが有効と判定される", () => {
    const ids = (["FLOW", "GRID", "RADIAL", "NOISE"] as const).flatMap((f) =>
      (["COMMON", "RARE", "EPIC"] as const).map((r) => typeIdOf(f, r)),
    );
    expect(ids).toHaveLength(TOTAL_TYPES);
    expect(ids.every(isValidTypeId)).toBe(true);
  });

  it("存在しない ID を弾く", () => {
    for (const bad of ["FLOW", "FLOW:LEGENDARY", "SPIRAL:COMMON", "", "flow:common"]) {
      expect(isValidTypeId(bad)).toBe(false);
    }
  });
});

describe("recordSpecimen（AC-12 / AC-13）", () => {
  it("未取得の型を記録すると count=1 で「はじめて発見」になる", () => {
    const result = recordSpecimen({}, specimen({ seed: 999 }), NOW);
    expect(result.isFirstDiscovery).toBe(true);
    expect(result.entry).toEqual({
      count: 1,
      firstSeed: 999,
      firstAt: NOW.toISOString(),
    });
    expect(collectedCount(result.collection)).toBe(1);
  });

  it("同じ型を再記録すると count が増え firstSeed / firstAt は変わらない", () => {
    const first = recordSpecimen({}, specimen({ seed: 111 }), NOW);
    const second = recordSpecimen(first.collection, specimen({ seed: 222 }), LATER);

    expect(second.isFirstDiscovery).toBe(false);
    expect(second.entry.count).toBe(2);
    expect(second.entry.firstSeed).toBe(111);
    expect(second.entry.firstAt).toBe(NOW.toISOString());
    // 型は増えていない
    expect(collectedCount(second.collection)).toBe(1);
  });

  it("元の Collection を書き換えない（イミュータブル）", () => {
    const original: Collection = {};
    const result = recordSpecimen(original, specimen(), NOW);
    expect(original).toEqual({});
    expect(result.collection).not.toBe(original);
  });

  it("異なる型はそれぞれ独立して記録される", () => {
    let collection: Collection = {};
    collection = recordSpecimen(collection, specimen({ family: "FLOW", rarity: "COMMON" }), NOW)
      .collection;
    collection = recordSpecimen(collection, specimen({ family: "FLOW", rarity: "EPIC" }), NOW)
      .collection;
    collection = recordSpecimen(collection, specimen({ family: "NOISE", rarity: "COMMON" }), NOW)
      .collection;

    expect(collectedCount(collection)).toBe(3);
    expect(collectedInFamily(collection, "FLOW")).toBe(2);
    expect(collectedInFamily(collection, "NOISE")).toBe(1);
    expect(collectedInFamily(collection, "GRID")).toBe(0);
  });
});

describe("progress", () => {
  it("空なら 0 / 12", () => {
    expect(progress({})).toEqual({ collected: 0, total: TOTAL_TYPES });
  });

  it("通算取得数ではなく型の数を数える（FR-202）", () => {
    let collection: Collection = {};
    for (let i = 0; i < 5; i += 1) {
      collection = recordSpecimen(collection, specimen(), NOW).collection;
    }
    expect(progress(collection)).toEqual({ collected: 1, total: TOTAL_TYPES });
  });
});

describe("serializeCollection / parseCollection（AC-14）", () => {
  it("保存と読み込みで完全に往復する", () => {
    let collection: Collection = {};
    collection = recordSpecimen(collection, specimen({ family: "GRID", seed: 7 }), NOW).collection;
    collection = recordSpecimen(
      collection,
      specimen({ family: "NOISE", rarity: "EPIC", seed: 4294967295 }),
      LATER,
    ).collection;

    expect(parseCollection(serializeCollection(collection))).toEqual(collection);
  });

  it("空の Collection も往復する", () => {
    expect(parseCollection(serializeCollection({}))).toEqual({});
  });
});

describe("parseCollection — 破損データ（AC-15）", () => {
  it.each([
    ["null", null],
    ["空文字", ""],
    ["壊れた JSON", "{not json"],
    ["配列", "[]"],
    ["数値", "42"],
    ["文字列リテラル", '"hello"'],
    ["null リテラル", "null"],
    ["version 欠落", JSON.stringify({ entries: {} })],
    ["version 不一致", JSON.stringify({ version: 99, entries: {} })],
    ["entries 欠落", JSON.stringify({ version: SCHEMA_VERSION })],
    ["entries が配列", JSON.stringify({ version: SCHEMA_VERSION, entries: [] })],
  ])("%s は空の Collection になる", (_name, raw) => {
    expect(parseCollection(raw)).toEqual({});
  });

  it("未知の typeId は捨てられ、健全なエントリだけ残る", () => {
    const raw = JSON.stringify({
      version: SCHEMA_VERSION,
      entries: {
        "FLOW:RARE": { count: 2, firstSeed: 10, firstAt: NOW.toISOString() },
        "SPIRAL:MYTHIC": { count: 1, firstSeed: 20, firstAt: NOW.toISOString() },
        garbage: { count: 1, firstSeed: 30, firstAt: NOW.toISOString() },
      },
    });
    const parsed = parseCollection(raw);
    expect(Object.keys(parsed)).toEqual(["FLOW:RARE"]);
  });

  it.each([
    ["count が 0", { count: 0, firstSeed: 1, firstAt: NOW.toISOString() }],
    ["count が負", { count: -3, firstSeed: 1, firstAt: NOW.toISOString() }],
    ["count が小数", { count: 1.5, firstSeed: 1, firstAt: NOW.toISOString() }],
    ["count が文字列", { count: "2", firstSeed: 1, firstAt: NOW.toISOString() }],
    ["count 欠落", { firstSeed: 1, firstAt: NOW.toISOString() }],
    ["firstSeed が負", { count: 1, firstSeed: -1, firstAt: NOW.toISOString() }],
    ["firstSeed が 32bit 超", { count: 1, firstSeed: 2 ** 32, firstAt: NOW.toISOString() }],
    ["firstSeed が小数", { count: 1, firstSeed: 1.5, firstAt: NOW.toISOString() }],
    ["firstAt が不正な日付", { count: 1, firstSeed: 1, firstAt: "いつか" }],
    ["firstAt が空文字", { count: 1, firstSeed: 1, firstAt: "" }],
    ["firstAt が数値", { count: 1, firstSeed: 1, firstAt: 1234 }],
    ["エントリが null", null],
    ["エントリが配列", []],
    ["エントリが数値", 5],
  ])("不正なエントリ（%s）は捨てられる", (_name, entry) => {
    const raw = JSON.stringify({
      version: SCHEMA_VERSION,
      entries: { "FLOW:RARE": entry },
    });
    expect(parseCollection(raw)).toEqual({});
  });

  it("不正なエントリが混ざっても健全なものは残る", () => {
    const raw = JSON.stringify({
      version: SCHEMA_VERSION,
      entries: {
        "FLOW:RARE": { count: 2, firstSeed: 10, firstAt: NOW.toISOString() },
        "GRID:EPIC": { count: -1, firstSeed: 10, firstAt: NOW.toISOString() },
        "NOISE:COMMON": { count: 3, firstSeed: 40, firstAt: LATER.toISOString() },
      },
    });
    const parsed = parseCollection(raw);
    expect(Object.keys(parsed).sort()).toEqual(["FLOW:RARE", "NOISE:COMMON"]);
    expect(collectedCount(parsed)).toBe(2);
  });

  it("境界値のシード（0 と 2^32-1）は受け入れる", () => {
    const raw = JSON.stringify({
      version: SCHEMA_VERSION,
      entries: {
        "FLOW:COMMON": { count: 1, firstSeed: 0, firstAt: NOW.toISOString() },
        "FLOW:EPIC": { count: 1, firstSeed: 4294967295, firstAt: NOW.toISOString() },
      },
    });
    expect(Object.keys(parseCollection(raw)).sort()).toEqual(["FLOW:COMMON", "FLOW:EPIC"]);
  });
});
