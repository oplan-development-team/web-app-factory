/**
 * 「家紋らしさ」を数値制約へ翻訳した不変条件を、全数走査で検証する（PLAN 4）。
 *
 * ここが本実装の品質の要。モチーフを増やしても、この網に掛からない限り
 * プロトタイプのような「小図形の散布」へ退行することはない。
 */

import { describe, expect, it } from "vitest";
import {
  FILL_RATIO_MAX,
  FILL_RATIO_MIN,
  HALF_WIDTH_ANGLE_MIN_RATIO,
  MAX_PRIMITIVES,
  MIN_STROKE,
  SEAT_MAX_OFFSET,
} from "../../src/lib/constants";
import { enclosureById, ENCLOSURES, enclosureFitsField } from "../../src/lib/enclosure";
import { buildKamonStructure, motifExtentOf } from "../../src/lib/kamon";
import { MOTIFS } from "../../src/lib/motifs";

const SEEDS = Array.from({ length: 100 }, (_, i) => `検体${i} / ${1950 + i}-0${(i % 9) + 1}-2${i % 9}`);
const VARIANTS = [0, 1, 2];

const ALL = SEEDS.flatMap((seed) =>
  VARIANTS.map((variant) => ({ seed, variant, structure: buildKamonStructure(seed, variant) })),
);

describe("決定性 (FR-002 / AC-01)", () => {
  it("同一シード・同一バリアントから 100 回生成して構造が一致する", () => {
    const reference = JSON.stringify(buildKamonStructure("水野 蒼 / 1998-04-12", 0));
    for (let i = 0; i < 100; i++) {
      expect(JSON.stringify(buildKamonStructure("水野 蒼 / 1998-04-12", 0))).toBe(reference);
    }
  });

  it("バリアントが変わると構造が変わる", () => {
    const a = JSON.stringify(buildKamonStructure("蒼", 0));
    const b = JSON.stringify(buildKamonStructure("蒼", 1));
    expect(a).not.toBe(b);
  });

  it("NFC 正規化により結合文字の差が吸収される (AC-09)", () => {
    expect(JSON.stringify(buildKamonStructure("ガ", 0))).toBe(
      JSON.stringify(buildKamonStructure("ガ", 0)),
    );
  });

  it("空文字・空白・絵文字・長い文字列でも例外を投げない (AC-08)", () => {
    for (const seed of ["", "   ", "🐉", "👨‍👩‍👧‍👦𠮷", "あ".repeat(40), "<script>"]) {
      expect(() => buildKamonStructure(seed, 0)).not.toThrow();
    }
  });
});

describe("面優先・少数要素の原則 (FR-101 / FR-102)", () => {
  it("描画プリミティブが 8 個以下 (AC-02)", () => {
    for (const { seed, variant, structure } of ALL) {
      expect(structure.primitiveCount, `${seed}#${variant}`).toBeLessThanOrEqual(MAX_PRIMITIVES);
    }
  });

  it("塗りのパスを必ず持つ (FR-101.1)", () => {
    for (const { structure } of ALL) {
      expect(structure.unit.fills.length).toBeGreaterThan(0);
    }
  });

  it("線を使う場合は最小線幅を満たす (AC-03)", () => {
    for (const { seed, structure } of ALL) {
      for (const stroke of structure.unit.strokes) {
        expect(stroke.width, seed).toBeGreaterThanOrEqual(MIN_STROKE);
      }
      if (structure.seat.kind === "ring") {
        expect(structure.seat.width).toBeGreaterThanOrEqual(MIN_STROKE);
      }
      for (const ring of enclosureById(structure.enclosureId).rings) {
        expect(ring.width).toBeGreaterThanOrEqual(MIN_STROKE);
      }
    }
  });

  it("単位数が 1〜6 に収まる (FR-102.2)", () => {
    for (const { structure } of ALL) {
      expect(structure.composition.count).toBeGreaterThanOrEqual(1);
      expect(structure.composition.count).toBeLessThanOrEqual(6);
    }
  });

  it("1 つの紋に 1 種類のモチーフしか使わない (AC-06)", () => {
    // 構造がモチーフ id を 1 つしか保持しないことが、混在不可能であることの担保
    for (const { structure } of ALL) {
      expect(typeof structure.motifId).toBe("string");
      expect(MOTIFS.some((m) => m.id === structure.motifId)).toBe(true);
    }
  });
});

describe("充填の原則 (FR-103)", () => {
  it("紋の外接半径が紋様域の 85〜95% に収まる (AC-04)", () => {
    for (const { seed, variant, structure } of ALL) {
      const inner = enclosureById(structure.enclosureId).innerRadius;
      const ratio = motifExtentOf(structure) / inner;
      expect(ratio, `${seed}#${variant} ${structure.name}`).toBeGreaterThanOrEqual(
        FILL_RATIO_MIN - 0.01,
      );
      expect(ratio, `${seed}#${variant} ${structure.name}`).toBeLessThanOrEqual(
        FILL_RATIO_MAX + 0.01,
      );
    }
  });

  it("放射・違い構成では単位の基部が中心の近くにある (AC-05)", () => {
    for (const { seed, structure } of ALL) {
      const { kind } = structure.composition;
      if (kind !== "radial" && kind !== "crossed") continue;
      expect(structure.unit.baseOffset, `${seed} ${structure.name}`).toBeLessThanOrEqual(
        SEAT_MAX_OFFSET,
      );
    }
  });

  it("放射構成の単位が楔に対して十分な幅を持つ (FR-103.3)", () => {
    for (const { seed, structure } of ALL) {
      if (structure.composition.kind !== "radial") continue;
      const slice = 360 / structure.composition.count;
      expect(
        structure.unit.halfWidthAngle,
        `${seed} ${structure.name} (slice=${slice})`,
      ).toBeGreaterThanOrEqual(slice * HALF_WIDTH_ANGLE_MIN_RATIO);
    }
  });
});

describe("構成と座", () => {
  it("単独・違い構成では座を置かない (FR-140.1)", () => {
    for (const { structure } of ALL) {
      if (structure.composition.kind === "single" || structure.composition.kind === "crossed") {
        expect(structure.seat.kind).toBe("none");
      }
    }
  });

  it("配置の数が単位数と一致する", () => {
    for (const { structure } of ALL) {
      expect(structure.composition.placements).toHaveLength(structure.composition.count);
    }
  });

  it("違い構成は 2 枚で、片方だけが鏡像である", () => {
    for (const { structure } of ALL) {
      if (structure.composition.kind !== "crossed") continue;
      const mirrored = structure.composition.placements.filter((p) => p.mirrored);
      expect(structure.composition.placements).toHaveLength(2);
      expect(mirrored).toHaveLength(1);
    }
  });

  it("連環構成は配置半径を持ち、隣接単位が接する寸法になっている (FR-130.3)", () => {
    for (const { structure } of ALL) {
      const { kind, count, ringRadius, unitSize } = structure.composition;
      if (kind !== "ring") continue;
      expect(ringRadius).toBeGreaterThan(0);
      const gap = 2 * ringRadius * Math.sin(Math.PI / count) - 2 * unitSize;
      expect(Math.abs(gap)).toBeLessThan(0.5);
    }
  });

  it("モチーフが宣言していない構成は選ばれない (FR-120.3)", () => {
    for (const { structure } of ALL) {
      const motif = MOTIFS.find((m) => m.id === structure.motifId);
      expect(motif).toBeDefined();
      const spec = motif!.supports.find((s) => s.kind === structure.composition.kind);
      expect(spec, `${structure.motifId} が ${structure.composition.kind} を宣言していない`).toBeDefined();
      if (spec && "counts" in spec) {
        expect(spec.counts).toContain(structure.composition.count);
      }
    }
  });
});

describe("登録簿の網羅 (AC-10)", () => {
  it("300 件の生成で 14 モチーフすべてが少なくとも 1 回現れる", () => {
    const seen = new Set(ALL.map(({ structure }) => structure.motifId));
    const missing = MOTIFS.filter((m) => !seen.has(m.id)).map((m) => m.id);
    expect(missing).toEqual([]);
  });

  it("5 種の外郭すべてが現れる", () => {
    const seen = new Set(ALL.map(({ structure }) => structure.enclosureId));
    expect(seen.size).toBe(ENCLOSURES.length);
  });

  it("4 構成すべてが現れる", () => {
    const seen = new Set(ALL.map(({ structure }) => structure.composition.kind));
    expect(seen).toEqual(new Set(["radial", "single", "crossed", "ring"]));
  });
});

describe("外郭", () => {
  it("すべての外郭が描画領域と最小線幅の制約を満たす", () => {
    for (const enclosure of ENCLOSURES) {
      expect(enclosureFitsField(enclosure), enclosure.id).toBe(true);
    }
  });

  it("外郭なしの紋様域が最も広い", () => {
    const none = enclosureById("none").innerRadius;
    for (const enclosure of ENCLOSURES) {
      expect(enclosure.innerRadius).toBeLessThanOrEqual(none);
    }
  });
});

describe("紋名 (FR-150)", () => {
  it("すべての紋が空でない名前を持つ", () => {
    for (const { structure } of ALL) {
      expect(structure.name.length).toBeGreaterThan(0);
    }
  });

  it("外郭の接頭辞とモチーフ名を含む", () => {
    for (const { structure } of ALL) {
      const prefix = enclosureById(structure.enclosureId).prefix;
      expect(structure.name.startsWith(prefix)).toBe(true);
      expect(structure.name.endsWith(structure.motifLabel)).toBe(true);
    }
  });

  it("違い構成の名前に「違い」が入る", () => {
    const crossed = ALL.find(({ structure }) => structure.composition.kind === "crossed");
    expect(crossed?.structure.name).toContain("違い");
  });

  it("放射構成の名前に数詞が入る", () => {
    const radial = ALL.find(({ structure }) => structure.composition.kind === "radial");
    expect(radial?.structure.name).toMatch(/[二三四五六]つ/);
  });
});
