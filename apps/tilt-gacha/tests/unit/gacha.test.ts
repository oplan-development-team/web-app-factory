import { describe, expect, it } from "vitest";
import { drawSpecimen, familyWeights, pickFamily, pickRarity } from "../../src/lib/gacha.ts";
import { mulberry32 } from "../../src/lib/rng.ts";
import {
  AFFINITY_WEIGHT,
  BUCKETS,
  BUCKET_AFFINITY,
  FAMILIES,
  RARITIES,
  RARITY_WEIGHT,
} from "../../src/lib/constants.ts";
import type { Family, Rarity, TiltBucket } from "../../src/lib/types.ts";

/** 指定した値を順に返す乱数源。境界値テスト用。 */
function scripted(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)] ?? 0;
}

describe("familyWeights", () => {
  it("重みの合計が 1 になる", () => {
    for (const bucket of BUCKETS) {
      const total = FAMILIES.reduce((sum, f) => sum + (familyWeights(bucket)[f] ?? 0), 0);
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it("相性系統の重みが AFFINITY_WEIGHT、他が均等になる", () => {
    const weights = familyWeights("UPRIGHT");
    expect(weights.FLOW).toBeCloseTo(AFFINITY_WEIGHT, 10);
    const rest = (1 - AFFINITY_WEIGHT) / 3;
    expect(weights.GRID).toBeCloseTo(rest, 10);
    expect(weights.RADIAL).toBeCloseTo(rest, 10);
    expect(weights.NOISE).toBeCloseTo(rest, 10);
  });

  it("bucket が null なら 4 系統均等になる（FR-030.3）", () => {
    const weights = familyWeights(null);
    for (const f of FAMILIES) {
      expect(weights[f]).toBeCloseTo(0.25, 10);
    }
  });
});

describe("pickFamily — 境界値（AC-03）", () => {
  // UPRIGHT の相性は FLOW。累積は概ね FLOW 0.55 / GRID 0.70 / RADIAL 0.85 / NOISE 1.00。
  // ただし境界は重みの浮動小数加算で 1ULP ずれうるので、
  // 期待値をリテラルで固定せず familyWeights から累積を組み立てて検証する。
  const weights = familyWeights("UPRIGHT");
  const cumulative: number[] = [];
  FAMILIES.reduce((sum, f) => {
    const next = sum + weights[f];
    cumulative.push(next);
    return next;
  }, 0);
  const EPS = 1e-9;

  it.each<[number, Family]>([
    [0, "FLOW"],
    [0.549, "FLOW"],
    [0.56, "GRID"],
    [0.69, "GRID"],
    [0.71, "RADIAL"],
    [0.84, "RADIAL"],
    [0.86, "NOISE"],
    [0.999, "NOISE"],
  ])("rng=%s → %s", (value, expected) => {
    expect(pickFamily("UPRIGHT", () => value)).toBe(expected);
  });

  it.each(FAMILIES.map((f, i) => [f, i] as const))(
    "%s の累積境界の直前・直後で系統が切り替わる",
    (family, index) => {
      const edge = cumulative[index] ?? 1;
      // 境界の直前は自分自身
      expect(pickFamily("UPRIGHT", () => edge - EPS)).toBe(family);
      // 境界の直後は次の系統（末尾は次が無いので検証対象外）
      const next = FAMILIES[index + 1];
      if (next !== undefined) {
        expect(pickFamily("UPRIGHT", () => edge + EPS)).toBe(next);
      }
    },
  );

  it("rng=0 は常に比較順の先頭を返す（FR-030.2 の固定順）", () => {
    // 相性系統ではなく FAMILIES の並び順が支配する。相性は重みの大きさとして効く。
    for (const bucket of [...BUCKETS, null]) {
      expect(pickFamily(bucket, () => 0)).toBe(FAMILIES[0]);
    }
  });

  it("各区分の相性系統は必ず抽選されうる（重みが 0 でない）", () => {
    for (const bucket of BUCKETS) {
      expect(familyWeights(bucket)[BUCKET_AFFINITY[bucket]]).toBeGreaterThan(0);
    }
  });

  it("rng が 1 に限りなく近くても有効な系統を返す（AC-07）", () => {
    for (const bucket of [...BUCKETS, null]) {
      const result = pickFamily(bucket, () => 0.9999999999);
      expect(FAMILIES).toContain(result);
    }
  });
});

describe("pickFamily — 分布（AC-04）", () => {
  const TRIALS = 10_000;

  it.each(BUCKETS)("%s では相性系統が 0.55 ± 0.03 で出る", (bucket) => {
    const rng = mulberry32(20260902);
    const counts = new Map<Family, number>(FAMILIES.map((f) => [f, 0]));
    for (let i = 0; i < TRIALS; i += 1) {
      const f = pickFamily(bucket, rng);
      counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    const affinity = BUCKET_AFFINITY[bucket];
    const affinityRate = (counts.get(affinity) ?? 0) / TRIALS;
    expect(affinityRate).toBeGreaterThan(AFFINITY_WEIGHT - 0.03);
    expect(affinityRate).toBeLessThan(AFFINITY_WEIGHT + 0.03);

    // 相性以外の 3 系統もそれぞれ現れる（0 になっていない）
    for (const f of FAMILIES) {
      if (f === affinity) continue;
      const rate = (counts.get(f) ?? 0) / TRIALS;
      expect(rate).toBeGreaterThan(0.15 - 0.03);
      expect(rate).toBeLessThan(0.15 + 0.03);
    }
  });
});

describe("pickRarity — 境界値（AC-05）", () => {
  it.each<[number, Rarity]>([
    [0, "COMMON"],
    [0.699, "COMMON"],
    [0.7, "RARE"],
    [0.949, "RARE"],
    [0.95, "EPIC"],
    [0.999, "EPIC"],
  ])("rng=%s → %s", (value, expected) => {
    expect(pickRarity(() => value)).toBe(expected);
  });

  it("rng が 1 に限りなく近くても有効なレア度を返す（AC-07）", () => {
    expect(RARITIES).toContain(pickRarity(() => 0.9999999999));
  });
});

describe("pickRarity — 分布（AC-06）", () => {
  it("70 / 25 / 5 % に収束する", () => {
    const TRIALS = 10_000;
    const rng = mulberry32(31415);
    const counts = new Map<Rarity, number>(RARITIES.map((r) => [r, 0]));
    for (let i = 0; i < TRIALS; i += 1) {
      const r = pickRarity(rng);
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    for (const rarity of RARITIES) {
      const rate = (counts.get(rarity) ?? 0) / TRIALS;
      expect(rate).toBeGreaterThan(RARITY_WEIGHT[rarity] - 0.03);
      expect(rate).toBeLessThan(RARITY_WEIGHT[rarity] + 0.03);
    }
  });
});

describe("drawSpecimen", () => {
  it("同じ乱数列からは同じ標本が得られる", () => {
    const a = drawSpecimen("UPRIGHT", mulberry32(5), true);
    const b = drawSpecimen("UPRIGHT", mulberry32(5), true);
    expect(a).toEqual(b);
  });

  it("bucket と fromSensor をそのまま持ち回す", () => {
    const s = drawSpecimen("LANDSCAPE", mulberry32(1), true);
    expect(s.bucket).toBe("LANDSCAPE");
    expect(s.fromSensor).toBe(true);
  });

  it("シードは 32bit 符号なし整数の範囲に入る（FR-032）", () => {
    const rng = mulberry32(777);
    for (let i = 0; i < 500; i += 1) {
      const s = drawSpecimen("DIAGONAL", rng, false);
      expect(Number.isInteger(s.seed)).toBe(true);
      expect(s.seed).toBeGreaterThanOrEqual(0);
      expect(s.seed).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("bucket が null でも成立する（センサー無しの経路）", () => {
    const s = drawSpecimen(null, mulberry32(9), false);
    expect(s.bucket).toBeNull();
    expect(FAMILIES).toContain(s.family);
    expect(RARITIES).toContain(s.rarity);
  });

  it("rng が常に 0 でも常に 1 直前でも有効な標本を返す（AC-07）", () => {
    for (const value of [0, 0.9999999999]) {
      const s = drawSpecimen("INVERTED", () => value, true);
      expect(FAMILIES).toContain(s.family);
      expect(RARITIES).toContain(s.rarity);
      expect(Number.isInteger(s.seed)).toBe(true);
    }
  });

  it("消費する乱数の順序が固定されている（系統 → レア度 → シード）", () => {
    // UPRIGHT: 0 → FLOW / 0.99 → EPIC / 0.5 → seed 2^31
    const s = drawSpecimen("UPRIGHT", scripted(0, 0.99, 0.5), true);
    expect(s.family).toBe("FLOW");
    expect(s.rarity).toBe("EPIC");
    expect(s.seed).toBe(2 ** 31);
  });

  it("すべての傾き区分で例外なく引ける", () => {
    const buckets: ReadonlyArray<TiltBucket | null> = [...BUCKETS, null];
    for (const bucket of buckets) {
      expect(() => drawSpecimen(bucket, mulberry32(3), false)).not.toThrow();
    }
  });
});
