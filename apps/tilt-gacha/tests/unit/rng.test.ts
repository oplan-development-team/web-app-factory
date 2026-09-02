import { describe, expect, it } from "vitest";
import { mulberry32, randInt, randPick, randRange } from "../../src/lib/rng.ts";

describe("mulberry32", () => {
  it("同一シードから常に同一の列を返す", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("異なるシードでは異なる列を返す", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it("常に [0, 1) の値を返す", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 2000; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("シード 0 でも縮退せず値が変化する", () => {
    const rng = mulberry32(0);
    const values = new Set(Array.from({ length: 10 }, () => rng()));
    expect(values.size).toBeGreaterThan(1);
  });

  it("2^32 を超えるシードでも例外を投げない", () => {
    const rng = mulberry32(2 ** 34 + 5);
    expect(Number.isFinite(rng())).toBe(true);
  });
});

describe("randRange", () => {
  it("min と max の間に収まる", () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 500; i += 1) {
      const v = randRange(rng, 3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(9);
    }
  });

  it("rng が 0 を返せば min を返す", () => {
    expect(randRange(() => 0, 2, 8)).toBe(2);
  });

  it("min === max なら常にその値", () => {
    expect(randRange(() => 0.9, 5, 5)).toBe(5);
  });
});

describe("randInt", () => {
  it("min 以上 max 以下の整数を返す", () => {
    const rng = mulberry32(4);
    for (let i = 0; i < 500; i += 1) {
      const v = randInt(rng, 2, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it("両端を取りうる", () => {
    expect(randInt(() => 0, 2, 5)).toBe(2);
    // rng が 1 に限りなく近い値を返しても max を超えない
    expect(randInt(() => 0.999999, 2, 5)).toBe(5);
  });
});

describe("randPick", () => {
  it("配列の要素を返す", () => {
    const items = ["a", "b", "c"] as const;
    const rng = mulberry32(11);
    for (let i = 0; i < 100; i += 1) {
      expect(items).toContain(randPick(rng, items));
    }
  });

  it("rng が 0 を返せば先頭、1 に近ければ末尾", () => {
    const items = ["a", "b", "c"] as const;
    expect(randPick(() => 0, items)).toBe("a");
    expect(randPick(() => 0.999999, items)).toBe("c");
  });
});
