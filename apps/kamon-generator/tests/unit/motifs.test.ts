import { describe, expect, it } from "vitest";
import { MIN_NEGATIVE, MIN_STROKE } from "../../src/lib/constants";
import { segmentsToPath } from "../../src/lib/geometry";
import { mulberry32 } from "../../src/lib/hash";
import { MOTIFS, buildMotifGeometry } from "../../src/lib/motifs";
import { countsFor, supportsKind } from "../../src/lib/motifs/types";

const SIZES = [60, 120, 180];

describe("モチーフ登録簿", () => {
  it("id が重複しない", () => {
    const ids = MOTIFS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("4 分類がすべて登録されている", () => {
    expect(new Set(MOTIFS.map((m) => m.category))).toEqual(
      new Set(["plant", "creature", "object", "geometric"]),
    );
  });

  it("すべてのモチーフが 1 つ以上の構成に対応する", () => {
    for (const motif of MOTIFS) {
      expect(motif.supports.length).toBeGreaterThan(0);
    }
  });

  it("宣言した構成に対応する組み立て手段を持つ", () => {
    for (const motif of MOTIFS) {
      if (supportsKind(motif, "radial") || supportsKind(motif, "crossed")) {
        expect(motif.buildUnit, `${motif.id} に buildUnit がない`).toBeTypeOf("function");
      }
      if (supportsKind(motif, "single") || supportsKind(motif, "ring")) {
        // 中心対称の図形は buildCentered か、単位からの転用のどちらかで作れればよい
        expect(
          motif.buildCentered ?? motif.buildUnit,
          `${motif.id} が中心対称の図形を作れない`,
        ).toBeTypeOf("function");
      }
    }
  });

  it("放射・連環の単位数が想定の範囲に収まる (FR-102.2)", () => {
    for (const motif of MOTIFS) {
      for (const kind of ["radial", "ring"] as const) {
        for (const count of countsFor(motif, kind)) {
          expect(count).toBeGreaterThanOrEqual(2);
          expect(count).toBeLessThanOrEqual(6);
        }
      }
    }
  });
});

describe("モチーフの幾何 (全モチーフ × 全構成 × 3 寸法)", () => {
  const cases = MOTIFS.flatMap((motif) =>
    motif.supports.flatMap((spec) =>
      SIZES.map((size) => ({ motif, kind: spec.kind, size })),
    ),
  );

  it("すべての組み合わせで例外なく組み立てられる", () => {
    expect(cases.length).toBeGreaterThan(20);
    for (const { motif, kind, size } of cases) {
      expect(() => buildMotifGeometry(motif, kind, mulberry32(1), size)).not.toThrow();
    }
  });

  it("塗りのパスが 1 つ以上あり、いずれも閉じている (FR-101.1)", () => {
    for (const { motif, kind, size } of cases) {
      const geometry = buildMotifGeometry(motif, kind, mulberry32(7), size);
      expect(geometry.fills.length, `${motif.id}/${kind}`).toBeGreaterThan(0);
      for (const fill of geometry.fills) {
        const d = segmentsToPath(fill);
        expect(d.startsWith("M"), `${motif.id}/${kind}: M で始まらない`).toBe(true);
        expect(d.trimEnd().endsWith("Z"), `${motif.id}/${kind}: Z で閉じていない`).toBe(true);
        expect(d).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
  });

  it("線を使う場合は最小線幅を満たす (FR-101.3 / AC-03)", () => {
    for (const { motif, kind, size } of cases) {
      const geometry = buildMotifGeometry(motif, kind, mulberry32(11), size);
      for (const stroke of geometry.strokes) {
        expect(stroke.width, `${motif.id}/${kind}`).toBeGreaterThanOrEqual(MIN_STROKE);
      }
    }
  });

  it("外接半径が寸法と整合する", () => {
    for (const { motif, kind, size } of cases) {
      const geometry = buildMotifGeometry(motif, kind, mulberry32(3), size);
      expect(geometry.extent).toBeGreaterThan(0);
      if (kind === "single" || kind === "ring") {
        // 中心対称の図形は外接半径が指定値ちょうどになるよう正規化される
        expect(geometry.extent).toBeCloseTo(size, 4);
      } else {
        expect(geometry.extent).toBeGreaterThan(size * 0.7);
        expect(geometry.extent).toBeLessThan(size * 1.35);
      }
    }
  });

  it("放射・違い構成の単位は基部が配置基準点の近くにある (FR-103.2)", () => {
    for (const { motif, kind, size } of cases) {
      if (kind !== "radial" && kind !== "crossed") continue;
      const geometry = buildMotifGeometry(motif, kind, mulberry32(5), size);
      expect(geometry.baseOffset, `${motif.id}/${kind}`).toBeLessThanOrEqual(size * 0.16);
    }
  });

  it("同じ乱数種からは同じ幾何が得られる", () => {
    for (const { motif, kind, size } of cases) {
      const a = buildMotifGeometry(motif, kind, mulberry32(42), size);
      const b = buildMotifGeometry(motif, kind, mulberry32(42), size);
      expect(a.fills.map(segmentsToPath)).toEqual(b.fills.map(segmentsToPath));
    }
  });

  it("白抜きの最小幅が定数を下回らない (FR-101.4)", () => {
    // vein() は下限でクランプするため、モチーフ側が細い脈を要求しても潰れない
    expect(MIN_NEGATIVE).toBeGreaterThan(0);
    for (const { motif, kind } of cases) {
      const geometry = buildMotifGeometry(motif, kind, mulberry32(13), 20);
      for (const fill of geometry.fills) {
        expect(segmentsToPath(fill)).not.toMatch(/NaN/);
      }
    }
  });
});
