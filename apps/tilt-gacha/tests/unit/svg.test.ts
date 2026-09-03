import { describe, expect, it } from "vitest";
import {
  circle,
  dot,
  layer,
  line,
  num,
  path,
  polylinePath,
  round,
} from "../../src/lib/patterns/svg.ts";

describe("round / num", () => {
  it.each([
    [1.234, 1.23],
    [1.235, 1.24],
    [1.2349, 1.23],
    [-1.234, -1.23],
    [10, 10],
    [0, 0],
  ])("round(%s) === %s", (input, expected) => {
    expect(round(input)).toBe(expected);
  });

  it("-0 を 0 に正規化する", () => {
    expect(num(-0.001)).toBe("0");
    expect(num(-0)).toBe("0");
  });

  it("整数は小数点を付けずに出す", () => {
    expect(num(12)).toBe("12");
  });
});

describe("polylinePath", () => {
  it("空の点列では空文字を返す", () => {
    expect(polylinePath([])).toBe("");
  });

  it("先頭が M、以降が L になる", () => {
    expect(
      polylinePath([
        { x: 0, y: 0 },
        { x: 10, y: 5.678 },
        { x: 20, y: 1 },
      ]),
    ).toBe("M0 0 L10 5.68 L20 1");
  });
});

describe("要素の生成", () => {
  it("path は fill=none / stroke=currentColor を持つ（FR-101.1, FR-101.3）", () => {
    const out = path("M0 0 L1 1", { width: 1 });
    expect(out).toContain('fill="none"');
    expect(out).toContain('stroke="currentColor"');
    expect(out).toContain('stroke-width="1"');
    expect(out).not.toContain("stroke-opacity");
  });

  it("opacity が 1 未満のときだけ stroke-opacity を出す", () => {
    expect(path("M0 0", { width: 1, opacity: 1 })).not.toContain("stroke-opacity");
    expect(path("M0 0", { width: 1, opacity: 0.5 })).toContain('stroke-opacity="0.5"');
  });

  it("dash を指定すると stroke-dasharray が付く", () => {
    expect(circle(1, 2, 3, { width: 1, dash: "2 4" })).toContain('stroke-dasharray="2 4"');
  });

  it("circle / line が座標を丸めて出す", () => {
    expect(circle(1.239, 2, 3, { width: 1 })).toContain('cx="1.24"');
    expect(line(0, 0, 9.876, 1, { width: 1 })).toContain('x2="9.88"');
  });

  it("dot は塗りで描かれる（点描の例外 FR-101.1）", () => {
    const out = dot(5, 6, 1.5);
    expect(out).toContain('fill="currentColor"');
    expect(out).not.toContain("stroke");
  });

  it("dot の fill-opacity は 1 未満のときだけ付く", () => {
    expect(dot(0, 0, 1, 1)).not.toContain("fill-opacity");
    expect(dot(0, 0, 1, 0.4)).toContain('fill-opacity="0.4"');
  });
});

describe("layer", () => {
  it("子が無ければ空文字を返す", () => {
    expect(layer([], 1)).toBe("");
  });

  it("不透明度 1 では opacity 属性を付けない", () => {
    expect(layer(["<a/>"], 1)).toBe("<g><a/></g>");
  });

  it("不透明度が 1 未満なら opacity を付ける", () => {
    expect(layer(["<a/>", "<b/>"], 0.55)).toBe('<g opacity="0.55"><a/><b/></g>');
  });
});
