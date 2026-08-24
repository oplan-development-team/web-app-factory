import { describe, expect, it } from "vitest";
import {
  hashString,
  mulberry32,
  normalizeSeed,
  pick,
  randFloat,
  randInt,
  seedForVariant,
  weightedPick,
} from "../../src/lib/hash";

describe("normalizeSeed", () => {
  it("前後の空白を除去し、中間の空白は保持する", () => {
    expect(normalizeSeed("  水野 蒼  ")).toBe("水野 蒼");
  });

  it("合成済み濁点と結合濁点を同一の文字列に揃える (FR-002.2)", () => {
    const composed = "ガ"; // ガ
    const decomposed = "ガ"; // カ + ゛
    expect(composed).not.toBe(decomposed);
    expect(normalizeSeed(composed)).toBe(normalizeSeed(decomposed));
  });

  it("空文字列を空文字列として返す", () => {
    expect(normalizeSeed("")).toBe("");
    expect(normalizeSeed("   ")).toBe("");
  });
});

describe("hashString", () => {
  it("同じ入力からは常に同じ値を返す", () => {
    expect(hashString("水野 蒼")).toBe(hashString("水野 蒼"));
  });

  it("符号なし32bit整数を返す", () => {
    for (const s of ["", "a", "水野 蒼", "🐉🍣", "x".repeat(200)]) {
      const h = hashString(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("1文字違うと値が変わる", () => {
    expect(hashString("水野 蒼")).not.toBe(hashString("水野 蒼一"));
  });

  it("サロゲートペアを含む文字列でも例外を投げない (AC-08)", () => {
    expect(() => hashString("👨‍👩‍👧‍👦𠮷野家")).not.toThrow();
  });

  it("NFC 正規化により合成済み・結合の別が吸収される (AC-09)", () => {
    expect(hashString(normalizeSeed("ガ"))).toBe(hashString(normalizeSeed("ガ")));
  });
});

describe("mulberry32", () => {
  it("同じシードからは同じ数列を返す", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("0以上1未満を返す", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("異なるシードからは異なる数列を返す", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("randFloat / randInt / pick", () => {
  it("randFloat は [min, max) に収まる", () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 300; i++) {
      const v = randFloat(rng, 5, 9);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(9);
    }
  });

  it("randInt は [min, max] の整数を返し、両端を取りうる", () => {
    const rng = mulberry32(4);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = randInt(rng, 2, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([2, 3, 4, 5]));
  });

  it("pick は必ず配列の要素を返す", () => {
    const rng = mulberry32(31);
    const items = ["a", "b", "c"] as const;
    for (let i = 0; i < 200; i++) {
      expect(items).toContain(pick(rng, items));
    }
  });

  it("pick は空配列で例外を投げる", () => {
    expect(() => pick(mulberry32(1), [])).toThrow();
  });
});

describe("weightedPick", () => {
  it("重みに比例して選ばれる", () => {
    const rng = mulberry32(2024);
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) {
      counts[weightedPick(rng, [
        { value: "a", weight: 3 },
        { value: "b", weight: 1 },
      ])]! += 1;
    }
    const ratio = counts["a"]! / counts["b"]!;
    expect(ratio).toBeGreaterThan(2.4);
    expect(ratio).toBeLessThan(3.6);
  });

  it("重み 0 の候補は選ばれない", () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 200; i++) {
      expect(
        weightedPick(rng, [
          { value: "keep", weight: 1 },
          { value: "skip", weight: 0 },
        ]),
      ).toBe("keep");
    }
  });

  it("候補が空なら例外を投げる", () => {
    expect(() => weightedPick(mulberry32(1), [])).toThrow();
  });
});

describe("seedForVariant", () => {
  it("シードとバリアントの組で決定的", () => {
    expect(seedForVariant("蒼", 0)).toBe(seedForVariant("蒼", 0));
    expect(seedForVariant("蒼", 0)).not.toBe(seedForVariant("蒼", 1));
  });

  it("正規化前後で同じ値になる", () => {
    expect(seedForVariant("  ガ  ", 3)).toBe(seedForVariant("ガ", 3));
  });
});
