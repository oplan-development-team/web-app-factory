import { describe, expect, it } from "vitest";
import {
  annularSectorSubpath,
  circleSubpath,
  clamp,
  fmt,
  maxRadius,
  mirrorPointsX,
  path,
  polar,
  polygonSubpath,
  regularPolygon,
} from "../../src/lib/geometry";

describe("fmt", () => {
  it("小数第2位に丸める", () => {
    expect(fmt(1.23456)).toBe("1.23");
    expect(fmt(1.006)).toBe("1.01");
  });

  it("余分な 0 を落とす", () => {
    expect(fmt(3)).toBe("3");
    expect(fmt(3.1)).toBe("3.1");
    expect(fmt(3.1)).not.toBe("3.10");
  });

  it("-0 を 0 に正規化する", () => {
    expect(fmt(-0)).toBe("0");
    expect(fmt(-0.001)).toBe("0");
  });
});

describe("polar", () => {
  it("0 度は真上（-y）", () => {
    const p = polar(0, 10);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-10);
  });

  it("90 度は右（+x）＝ 時計回り", () => {
    const p = polar(90, 10);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(0);
  });

  it("180 度は真下（+y）", () => {
    const p = polar(180, 10);
    expect(p.y).toBeCloseTo(10);
  });

  it("原点を指定できる", () => {
    const p = polar(0, 10, { x: 200, y: 200 });
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(190);
  });
});

describe("path", () => {
  it("空セグメントを除いて連結する", () => {
    expect(path("M0,0", "", "L1,1")).toBe("M0,0 L1,1");
  });
});

describe("polygonSubpath", () => {
  it("閉じたパスを返す", () => {
    const d = polygonSubpath([
      { x: 0, y: -10 },
      { x: 10, y: 10 },
      { x: -10, y: 10 },
    ]);
    expect(d).toBe("M0,-10 L10,10 L-10,10 Z");
  });

  it("2 点以下では例外を投げる", () => {
    expect(() => polygonSubpath([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toThrow();
  });
});

describe("circleSubpath", () => {
  it("2 つの円弧で閉じた円を返す", () => {
    const d = circleSubpath({ x: 0, y: 0 }, 5);
    expect(d.startsWith("M0,-5")).toBe(true);
    expect((d.match(/A/g) ?? []).length).toBe(2);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("sweep を反転できる（穴の巻き方向）", () => {
    expect(circleSubpath({ x: 0, y: 0 }, 5, false)).toContain("0 0 0");
  });
});

describe("regularPolygon", () => {
  it("指定した辺数の頂点を返し、1 頂点が真上を向く", () => {
    const pts = regularPolygon(6, 10);
    expect(pts).toHaveLength(6);
    expect(pts[0]!.x).toBeCloseTo(0);
    expect(pts[0]!.y).toBeCloseTo(-10);
  });

  it("すべての頂点が指定半径上にある", () => {
    for (const p of regularPolygon(5, 42, 17)) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(42);
    }
  });

  it("3 辺未満では例外を投げる", () => {
    expect(() => regularPolygon(2, 10)).toThrow();
  });
});

describe("annularSectorSubpath", () => {
  it("内半径 0 のとき中心を頂点とする扇形になる", () => {
    const d = annularSectorSubpath(0, 50, -30, 30);
    expect(d.startsWith("M0,0")).toBe(true);
    expect((d.match(/A/g) ?? []).length).toBe(1);
  });

  it("内半径ありのとき 2 つの円弧を持つ", () => {
    const d = annularSectorSubpath(20, 50, -30, 30);
    expect((d.match(/A/g) ?? []).length).toBe(2);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("180 度超で large-arc フラグが立つ", () => {
    expect(annularSectorSubpath(0, 50, -100, 100)).toMatch(/A50,50 0 1 1/);
  });
});

describe("mirrorPointsX", () => {
  it("x を反転し順序を逆にする", () => {
    expect(mirrorPointsX([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ])).toEqual([
      { x: -3, y: 4 },
      { x: -1, y: 2 },
    ]);
  });
});

describe("maxRadius", () => {
  it("原点からの最大距離を返す", () => {
    expect(maxRadius([{ x: 3, y: 4 }, { x: 1, y: 1 }])).toBeCloseTo(5);
  });

  it("空配列では 0", () => {
    expect(maxRadius([])).toBe(0);
  });
});

describe("clamp", () => {
  it("範囲内に収める", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});
