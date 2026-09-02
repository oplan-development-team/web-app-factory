import { describe, expect, it } from "vitest";
import { buildPattern, patternSvg, VIEW_BOX } from "../../src/lib/patterns/index.ts";
import {
  FAMILIES,
  MAX_ELEMENTS,
  RARITIES,
  RARITY_LAYERS,
  STROKE_WIDTH,
} from "../../src/lib/constants.ts";
import type { Family, Rarity } from "../../src/lib/types.ts";

/** 12 の型 × 50 シード = 600 標本。AC-09 の全数検証に使う。 */
const SEEDS = Array.from({ length: 50 }, (_, i) => i * 7919 + 13);

const ALL_TYPES: ReadonlyArray<[Family, Rarity]> = FAMILIES.flatMap((f) =>
  RARITIES.map((r) => [f, r] as [Family, Rarity]),
);

function attributeValues(markup: string, attribute: string): number[] {
  const matches = markup.matchAll(new RegExp(`${attribute}="([^"]+)"`, "g"));
  return [...matches].map((m) => Number(m[1]));
}

describe("buildPattern — 決定性（AC-08）", () => {
  it.each(ALL_TYPES)("%s / %s は同一シードから同一の出力を返す", (family, rarity) => {
    for (const seed of [0, 42, 4294967295]) {
      expect(buildPattern(family, rarity, seed)).toEqual(buildPattern(family, rarity, seed));
    }
  });

  it("生成を挟んでも他の型の結果に影響しない（共有状態がない）", () => {
    const before = buildPattern("FLOW", "EPIC", 999);
    buildPattern("NOISE", "COMMON", 1);
    buildPattern("GRID", "RARE", 2);
    expect(buildPattern("FLOW", "EPIC", 999)).toEqual(before);
  });
});

describe("buildPattern — 層の数（AC-10）", () => {
  it.each(RARITIES)("%s は規定の層数になる", (rarity) => {
    for (const family of FAMILIES) {
      const pattern = buildPattern(family, rarity, 2026);
      expect(pattern.layerCount).toBe(RARITY_LAYERS[rarity]);
    }
  });

  it("COMMON / RARE / EPIC は 1 / 2 / 3 層", () => {
    expect(RARITY_LAYERS).toEqual({ COMMON: 1, RARE: 2, EPIC: 3 });
  });

  it("markup 内の <g> の数が層数と一致する", () => {
    for (const [family, rarity] of ALL_TYPES) {
      const { markup, layerCount } = buildPattern(family, rarity, 55);
      expect([...markup.matchAll(/<g[\s>]/g)]).toHaveLength(layerCount);
    }
  });
});

describe("buildPattern — jitter（AC-11）", () => {
  it.each(ALL_TYPES)("%s / %s は異なるシードで異なる出力になる", (family, rarity) => {
    const outputs = new Set(SEEDS.slice(0, 10).map((s) => buildPattern(family, rarity, s).markup));
    expect(outputs.size).toBe(10);
  });
});

describe("buildPattern — 不変条件（AC-09 / 600 標本の全数検証）", () => {
  it("すべての標本が要素数・線幅・座標の不変条件を満たす", () => {
    let checked = 0;

    for (const [family, rarity] of ALL_TYPES) {
      for (const seed of SEEDS) {
        const { markup, elementCount } = buildPattern(family, rarity, seed);
        const where = `${family}/${rarity}/seed=${seed}`;

        // FR-110.2 要素数の上限
        expect(elementCount, `${where}: 要素数`).toBeLessThanOrEqual(MAX_ELEMENTS);
        expect(elementCount, `${where}: 要素数が 0`).toBeGreaterThan(0);

        // FR-101.2 線幅の範囲
        for (const width of attributeValues(markup, "stroke-width")) {
          expect(width, `${where}: stroke-width`).toBeGreaterThanOrEqual(STROKE_WIDTH.MIN);
          expect(width, `${where}: stroke-width`).toBeLessThanOrEqual(STROKE_WIDTH.MAX);
        }

        // 座標・半径に NaN / Infinity が混じらない
        for (const attribute of ["cx", "cy", "r", "x1", "y1", "x2", "y2"]) {
          for (const value of attributeValues(markup, attribute)) {
            expect(Number.isFinite(value), `${where}: ${attribute}=${value}`).toBe(true);
          }
        }
        expect(markup, `${where}: NaN が混入`).not.toContain("NaN");
        expect(markup, `${where}: Infinity が混入`).not.toContain("Infinity");

        // FR-101.3 色は currentColor に委ねる（生の色指定を持たない）
        expect(markup, `${where}: 色の直指定`).not.toMatch(/(?:stroke|fill)="#/);

        // FR-101.1 stroke を持つ要素は fill="none"
        const strokedWithoutNoFill = [...markup.matchAll(/<(?:path|circle|line)\b[^>]*>/g)]
          .map((m) => m[0])
          .filter((el) => el.includes('stroke="currentColor"') && !el.includes('fill="none"'));
        expect(strokedWithoutNoFill, `${where}: fill 未指定の線要素`).toEqual([]);

        checked += 1;
      }
    }

    expect(checked).toBe(600);
  });

  it("塗りを使うのは点描（半径の小さい circle）だけである", () => {
    for (const [family, rarity] of ALL_TYPES) {
      const { markup } = buildPattern(family, rarity, 31);
      const filled = [...markup.matchAll(/<circle\b[^>]*fill="currentColor"[^>]*>/g)].map(
        (m) => m[0],
      );
      for (const element of filled) {
        const r = Number(/ r="([^"]+)"/.exec(element)?.[1] ?? "0");
        expect(r, `${family}/${rarity}: 塗り円の半径`).toBeLessThanOrEqual(4);
      }
    }
  });

  it("描画は viewBox の内側に概ね収まる（極端なはみ出しが無い）", () => {
    for (const [family, rarity] of ALL_TYPES) {
      for (const seed of SEEDS.slice(0, 12)) {
        const { markup } = buildPattern(family, rarity, seed);
        for (const attribute of ["cx", "cy", "x1", "y1", "x2", "y2"]) {
          for (const value of attributeValues(markup, attribute)) {
            expect(value).toBeGreaterThanOrEqual(-40);
            expect(value).toBeLessThanOrEqual(280);
          }
        }
      }
    }
  });
});

describe("patternSvg", () => {
  it("viewBox を持つ単体の SVG を返す", () => {
    const svg = patternSvg("RADIAL", "EPIC", 7);
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain(`viewBox="${VIEW_BOX}"`);
  });

  it("title が無ければ装飾として aria-hidden にする", () => {
    const svg = patternSvg("FLOW", "COMMON", 1);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toContain("<title>");
  });

  it("title があれば role=img と <title> を持つ（NFR-007）", () => {
    const svg = patternSvg("FLOW", "COMMON", 1, { title: "ながれ コモン" });
    expect(svg).toContain('role="img"');
    expect(svg).toContain("<title>ながれ コモン</title>");
    expect(svg).not.toContain("aria-hidden");
  });

  it("外部参照やスクリプトを含まない", () => {
    for (const [family, rarity] of ALL_TYPES) {
      const svg = patternSvg(family, rarity, 3);
      expect(svg).not.toContain("<script");
      expect(svg).not.toContain("<image");
      expect(svg).not.toContain("<foreignObject");
      expect(svg).not.toContain("xlink:href");
      expect(svg).not.toMatch(/url\(\s*['"]?https?:/);
      // xmlns の名前空間 URI は取得先ではないので、それを除いた上で外部 URL が無いことを見る
      const withoutNamespace = svg.replace('xmlns="http://www.w3.org/2000/svg"', "");
      expect(withoutNamespace).not.toMatch(/https?:\/\//);
    }
  });
});
