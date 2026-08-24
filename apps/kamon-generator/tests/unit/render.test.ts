import { describe, expect, it } from "vitest";
import { draftGuideSVG } from "../../src/lib/draftGuide";
import { buildKamonStructure } from "../../src/lib/kamon";
import { PALETTES } from "../../src/lib/palette";
import { escapeXml, renderKamonSVG, toStandaloneSVG } from "../../src/lib/render";

const SEEDS = Array.from({ length: 40 }, (_, i) => `描画検体${i}`);
const structures = SEEDS.map((s) => buildKamonStructure(s, i(s)));

function i(seed: string): number {
  return seed.length % 3;
}

/** 属性値の中身だけを抜き出す（値の中にタグ記号が無いことを確かめるため） */
function attrValues(markup: string, name: string): string[] {
  return [...markup.matchAll(new RegExp(`${name}="([^"]*)"`, "g"))].map((m) => m[1] ?? "");
}

describe("renderKamonSVG", () => {
  it("整形式の SVG を返す", () => {
    for (const structure of structures) {
      const svg = renderKamonSVG(structure, PALETTES[0]!);
      expect(svg.startsWith("<svg ")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).toContain('viewBox="0 0 400 400"');
      expect(svg).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it("外部参照・テキスト要素・スクリプトを含まない (FR-400.1)", () => {
    for (const structure of structures) {
      const svg = renderKamonSVG(structure, PALETTES[0]!);
      expect(svg).not.toMatch(/<text|<image|<script|xlink:href|url\(/);
      expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    }
  });

  it("すべての塗りに fill-rule=evenodd が付く (FR-200.2 / AC-11)", () => {
    for (const structure of structures) {
      const svg = renderKamonSVG(structure, PALETTES[0]!);
      const fillPaths = [...svg.matchAll(/<path [^>]*fill="(?!none)[^"]*"[^>]*>/g)].map(
        (m) => m[0],
      );
      expect(fillPaths.length).toBeGreaterThan(0);
      for (const p of fillPaths) {
        expect(p).toContain('fill-rule="evenodd"');
      }
    }
  });

  it("配色を変えても幾何が変わらない (FR-200.1 / AC-13)", () => {
    for (const structure of structures) {
      const a = attrValues(renderKamonSVG(structure, PALETTES[0]!), "d");
      const b = attrValues(renderKamonSVG(structure, PALETTES[2]!), "d");
      expect(a).toEqual(b);
    }
  });

  it("配色を変えると色だけが変わる", () => {
    const structure = structures[0]!;
    const sumi = renderKamonSVG(structure, PALETTES[0]!);
    const kon = renderKamonSVG(structure, PALETTES[2]!);
    expect(sumi).not.toBe(kon);
    expect(sumi).toContain(PALETTES[0]!.ink);
    expect(kon).toContain(PALETTES[2]!.ink);
  });

  it("紋名を aria-label に持つ (FR-602)", () => {
    for (const structure of structures) {
      expect(renderKamonSVG(structure, PALETTES[0]!)).toContain(
        `aria-label="${structure.name}"`,
      );
    }
  });

  it("単位数と同じ数の複製グループを出力する (FR-104.2)", () => {
    for (const structure of structures) {
      const svg = renderKamonSVG(structure, PALETTES[0]!);
      const groups = svg.match(/<g transform="/g) ?? [];
      expect(groups.length).toBe(structure.composition.count);
    }
  });

  it("下地の円を省略できる", () => {
    const structure = structures[0]!;
    const withBackdrop = renderKamonSVG(structure, PALETTES[0]!);
    const without = renderKamonSVG(structure, PALETTES[0]!, { backdrop: false });
    expect(withBackdrop).toContain(`fill="${PALETTES[0]!.paper}"`);
    expect(without).not.toContain(`fill="${PALETTES[0]!.paper}"`);
  });

  it("同じ構造・同じ配色からは同じ文字列が得られる (AC-07)", () => {
    const structure = structures[3]!;
    expect(renderKamonSVG(structure, PALETTES[1]!)).toBe(
      renderKamonSVG(structure, PALETTES[1]!),
    );
  });
});

describe("escapeXml (NFR-007)", () => {
  it("タグ記号と引用符を実体参照へ変える", () => {
    expect(escapeXml('<img src="x" onerror=\'alert(1)\'>&')).toBe(
      "&lt;img src=&quot;x&quot; onerror=&apos;alert(1)&apos;&gt;&amp;",
    );
  });

  it("紋名にタグ記号が混じっても属性値を壊さない", () => {
    const structure = buildKamonStructure('<script>alert("x")</script>', 0);
    const svg = renderKamonSVG(structure, PALETTES[0]!, { label: '<script>alert("x")</script>' });
    expect(svg).not.toContain("<script");
    expect(svg).toContain("&lt;script&gt;");
  });
});

describe("toStandaloneSVG", () => {
  it("XML 宣言を前置する", () => {
    const svg = toStandaloneSVG(renderKamonSVG(structures[0]!, PALETTES[0]!));
    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg')).toBe(true);
  });
});

describe("draftGuideSVG", () => {
  it("同心円と放射線だけの面を返す", () => {
    const svg = draftGuideSVG({ stroke: "#c33a2e" });
    expect(svg).toContain("<circle");
    expect(svg).toContain("<line");
    expect(svg).not.toContain("<path");
    expect(svg).toContain('aria-hidden="true"');
  });

  it("支援技術から隠されている", () => {
    expect(draftGuideSVG({ stroke: "#000" })).toContain('role="presentation"');
  });
});
