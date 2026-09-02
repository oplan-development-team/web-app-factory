import { describe, expect, it } from "vitest";
import { classifyTilt, normalizeAngle } from "../../src/lib/tilt.ts";
import { BUCKETS } from "../../src/lib/constants.ts";
import type { TiltBucket } from "../../src/lib/types.ts";

describe("normalizeAngle", () => {
  it.each([
    [0, 0],
    [90, 90],
    [179, 179],
    [180, -180],
    [181, -179],
    [270, -90],
    [360, 0],
    [-181, 179],
    [-360, 0],
    [720 + 45, 45],
  ])("normalizeAngle(%s) === %s", (input, expected) => {
    expect(normalizeAngle(input)).toBe(expected);
  });
});

describe("classifyTilt — 代表点（AC-01）", () => {
  const cases: ReadonlyArray<[string, number, number, TiltBucket]> = [
    // 縦持ち: 画面をまっすぐ立てて構えた状態
    ["まっすぐ縦持ち", 90, 0, "UPRIGHT"],
    ["やや手前に傾いた縦持ち", 70, 10, "UPRIGHT"],
    ["縦持ちの下限ちょうど", 55, 0, "UPRIGHT"],
    // 横向き: 左右に倒した状態
    ["右に倒す", 45, 60, "LANDSCAPE"],
    ["左に倒す", 45, -60, "LANDSCAPE"],
    ["横向きの境界ちょうど", 30, 45, "LANDSCAPE"],
    ["縦持ちの角度でも大きく左右に振れていれば横向き", 90, 50, "LANDSCAPE"],
    // さかさま: 水平を越えて奥へ倒れる / 完全反転
    ["奥へ倒す", 45 - 90, 0, "INVERTED"],
    ["さかさまの境界ちょうど", -25, 0, "INVERTED"],
    ["完全に伏せる", 170, 0, "INVERTED"],
    ["反転の境界ちょうど", 120, 0, "INVERTED"],
    ["反転はgammaより優先される", -80, 80, "INVERTED"],
    // ななめ: 上のどれでもない中間姿勢
    ["中間の傾き", 40, 20, "DIAGONAL"],
    ["卓上に平置き（FR-012.2）", 0, 0, "DIAGONAL"],
    ["縦持ち手前だが左右に振れている", 60, 30, "DIAGONAL"],
    ["縦持ちの下限をわずかに下回る", 54, 0, "DIAGONAL"],
  ];

  it.each(cases)("%s (beta=%s, gamma=%s) → %s", (_name, beta, gamma, expected) => {
    expect(classifyTilt(beta, gamma)).toBe(expected);
  });

  it("代表点が 4 区分すべてを網羅している", () => {
    const covered = new Set(cases.map(([, , , bucket]) => bucket));
    expect(covered).toEqual(new Set(BUCKETS));
  });
});

describe("classifyTilt — 判定順序", () => {
  it("反転条件は横向き条件より優先される", () => {
    // |gamma| >= 45 かつ beta <= -25 の両方を満たす。反転が先に成立する。
    expect(classifyTilt(-40, 70)).toBe("INVERTED");
  });

  it("横向き条件は縦持ち条件より優先される", () => {
    // beta >= 55 だが |gamma| >= 45。横向きが先に成立する。
    expect(classifyTilt(80, 45)).toBe("LANDSCAPE");
  });
});

describe("classifyTilt — 異常値（AC-02）", () => {
  it.each([
    ["betaがnull", null, 0],
    ["gammaがnull", 0, null],
    ["両方null", null, null],
    ["betaがNaN", Number.NaN, 0],
    ["gammaがNaN", 0, Number.NaN],
    ["betaがInfinity", Number.POSITIVE_INFINITY, 0],
    ["gammaが-Infinity", 0, Number.NEGATIVE_INFINITY],
  ])("%s なら null を返す", (_name, beta, gamma) => {
    expect(classifyTilt(beta, gamma)).toBeNull();
  });

  it("範囲外の角度でも例外を投げず有効な区分を返す", () => {
    for (const beta of [270, -270, 540, -540, 999]) {
      for (const gamma of [-180, -90, 0, 90, 180]) {
        const result = classifyTilt(beta, gamma);
        expect(result).not.toBeNull();
        expect(BUCKETS).toContain(result);
      }
    }
  });

  it("全域を走査しても常に 4 区分のいずれかを返す（FR-012.1）", () => {
    for (let beta = -180; beta <= 180; beta += 7) {
      for (let gamma = -90; gamma <= 90; gamma += 7) {
        expect(BUCKETS).toContain(classifyTilt(beta, gamma));
      }
    }
  });

  it("gamma は ±90 にクランプされ、範囲外でも横向き判定が壊れない", () => {
    expect(classifyTilt(30, 120)).toBe("LANDSCAPE");
    expect(classifyTilt(30, -120)).toBe("LANDSCAPE");
  });
});
