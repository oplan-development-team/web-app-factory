import { describe, expect, it } from "vitest";
import { fieldOffset, makePoles, type Pole } from "../../src/lib/patterns/field.ts";
import { mulberry32 } from "../../src/lib/rng.ts";
import { dottedDash } from "../../src/lib/patterns/svg.ts";

const BOUNDS = { min: 0, max: 240 };

describe("makePoles", () => {
  it("指定した数の極をつくる", () => {
    expect(makePoles(mulberry32(1), 3, BOUNDS)).toHaveLength(3);
    expect(makePoles(mulberry32(1), 0, BOUNDS)).toEqual([]);
  });

  it("同一シードから同一の極を返す（決定性）", () => {
    expect(makePoles(mulberry32(42), 4, BOUNDS)).toEqual(makePoles(mulberry32(42), 4, BOUNDS));
  });

  it("極は描画領域の内側に置かれる", () => {
    const poles = makePoles(mulberry32(9), 20, BOUNDS);
    for (const pole of poles) {
      expect(pole.x).toBeGreaterThanOrEqual(BOUNDS.min);
      expect(pole.x).toBeLessThanOrEqual(BOUNDS.max);
      expect(pole.y).toBeGreaterThanOrEqual(BOUNDS.min);
      expect(pole.y).toBeLessThanOrEqual(BOUNDS.max);
      expect(pole.radius).toBeGreaterThan(0);
    }
  });
});

describe("fieldOffset", () => {
  it("極が無ければ変位しない", () => {
    expect(fieldOffset([], 10, 20)).toEqual({ dx: 0, dy: 0 });
  });

  it("押し出しの極は外向きに動かす", () => {
    const pole: Pole = { x: 0, y: 0, push: 10, swirl: 0, radius: 100 };
    const { dx, dy } = fieldOffset([pole], 10, 0);
    expect(dx).toBeGreaterThan(0);
    expect(dy).toBeCloseTo(0, 10);
  });

  it("引き寄せの極は内向きに動かす", () => {
    const pole: Pole = { x: 0, y: 0, push: -10, swirl: 0, radius: 100 };
    expect(fieldOffset([pole], 10, 0).dx).toBeLessThan(0);
  });

  it("渦は接線方向へ動かす（放射方向には動かさない）", () => {
    const pole: Pole = { x: 0, y: 0, push: 0, swirl: 10, radius: 100 };
    const { dx, dy } = fieldOffset([pole], 10, 0);
    // (10,0) の接線は +y 方向
    expect(dx).toBeCloseTo(0, 10);
    expect(dy).toBeGreaterThan(0);
  });

  it("遠いほど効きが弱くなる", () => {
    const pole: Pole = { x: 0, y: 0, push: 20, swirl: 0, radius: 50 };
    const near = Math.hypot(...Object.values(fieldOffset([pole], 10, 0)));
    const far = Math.hypot(...Object.values(fieldOffset([pole], 200, 0)));
    expect(near).toBeGreaterThan(far);
  });

  it("極の中心でも NaN / Infinity を返さない（AC-09 の前提）", () => {
    const pole: Pole = { x: 50, y: 50, push: 30, swirl: 30, radius: 40 };
    const { dx, dy } = fieldOffset([pole], 50, 50);
    expect(Number.isFinite(dx)).toBe(true);
    expect(Number.isFinite(dy)).toBe(true);
  });

  it("極が重なっても変位が上限を超えない", () => {
    // 同じ位置に強い極を並べて、加算が発散しないことを確かめる
    const poles: Pole[] = Array.from({ length: 12 }, () => ({
      x: 0,
      y: 0,
      push: 100,
      swirl: 100,
      radius: 200,
    }));
    const { dx, dy } = fieldOffset(poles, 5, 5);
    expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(26 + 1e-9);
  });

  it("領域全体を走査しても常に有限で上限内に収まる", () => {
    const poles = makePoles(mulberry32(2026), 4, BOUNDS);
    for (let x = 0; x <= 240; x += 12) {
      for (let y = 0; y <= 240; y += 12) {
        const { dx, dy } = fieldOffset(poles, x, y);
        expect(Number.isFinite(dx)).toBe(true);
        expect(Number.isFinite(dy)).toBe(true);
        expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(26 + 1e-9);
      }
    }
  });

  it("同じ入力からは同じ変位を返す", () => {
    const poles = makePoles(mulberry32(7), 3, BOUNDS);
    expect(fieldOffset(poles, 33, 77)).toEqual(fieldOffset(poles, 33, 77));
  });
});

describe("dottedDash", () => {
  it("ほぼ長さ 0 の破片と間隔を返す（丸キャップで点になる）", () => {
    expect(dottedDash(4)).toBe("0.01 4");
  });

  it("間隔は丸めて出す", () => {
    expect(dottedDash(3.456)).toBe("0.01 3.46");
  });
});
