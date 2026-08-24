/**
 * SVG パス組み立てのための最小限の幾何ユーティリティ。
 *
 * 角度は度数法で、0 度 = 真上（-y 方向）、時計回りを正とする。
 * 家紋の作図が「同心円と放射線（割り出し線）」の上で行われるため、
 * 極座標を第一級の入力として扱う。
 */

import { COORD_PRECISION } from "./constants";

export interface Point {
  x: number;
  y: number;
}

/** 座標を固定桁で整形する。-0 と余分な 0 を落として SVG 文字列を安定させる。 */
export function fmt(value: number): string {
  const rounded = Number(value.toFixed(COORD_PRECISION));
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return String(normalized);
}

export function pointStr(p: Point): string {
  return `${fmt(p.x)},${fmt(p.y)}`;
}

/** 0 度 = 真上、時計回り正の極座標から直交座標へ */
export function polar(angleDeg: number, radius: number, origin: Point = { x: 0, y: 0 }): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: origin.x + radius * Math.sin(rad),
    y: origin.y - radius * Math.cos(rad),
  };
}

export function moveTo(p: Point): string {
  return `M${pointStr(p)}`;
}

export function lineTo(p: Point): string {
  return `L${pointStr(p)}`;
}

export function quadTo(control: Point, end: Point): string {
  return `Q${pointStr(control)} ${pointStr(end)}`;
}

export function cubicTo(c1: Point, c2: Point, end: Point): string {
  return `C${pointStr(c1)} ${pointStr(c2)} ${pointStr(end)}`;
}

export function arcTo(
  radius: Point,
  end: Point,
  opts: { largeArc?: boolean; sweep?: boolean } = {},
): string {
  const largeArc = opts.largeArc ? 1 : 0;
  const sweep = opts.sweep === false ? 0 : 1;
  return `A${fmt(radius.x)},${fmt(radius.y)} 0 ${largeArc} ${sweep} ${pointStr(end)}`;
}

export const CLOSE = "Z";

/** セグメントを連結して 1 本のパス文字列にする */
export function path(...segments: readonly string[]): string {
  return segments.filter((s) => s.length > 0).join(" ");
}

/** 折れ線を閉じた副パスにする */
export function polygonSubpath(points: readonly Point[]): string {
  if (points.length < 3) throw new Error("polygonSubpath: 3 点以上が必要です");
  const [first, ...rest] = points as [Point, ...Point[]];
  return path(moveTo(first), ...rest.map(lineTo), CLOSE);
}

/**
 * 真円を閉じた副パスにする。
 * sweep を反転させると巻き方向が変わるが、本アプリは fill-rule="evenodd" を
 * 使うため巻き方向に依存せず穴として機能する。
 */
export function circleSubpath(center: Point, radius: number, sweep = true): string {
  const top: Point = { x: center.x, y: center.y - radius };
  const bottom: Point = { x: center.x, y: center.y + radius };
  const r: Point = { x: radius, y: radius };
  return path(
    moveTo(top),
    arcTo(r, bottom, { sweep }),
    arcTo(r, top, { sweep }),
    CLOSE,
  );
}

/** 正 n 角形の頂点。rotationDeg = 0 のとき 1 頂点が真上を向く。 */
export function regularPolygon(
  sides: number,
  radius: number,
  rotationDeg = 0,
  origin: Point = { x: 0, y: 0 },
): Point[] {
  if (sides < 3) throw new Error("regularPolygon: 3 辺以上が必要です");
  return Array.from({ length: sides }, (_, i) =>
    polar(rotationDeg + (360 / sides) * i, radius, origin),
  );
}

/**
 * 円環扇形（annular sector）を閉じた副パスにする。扇・車輪の意匠に使う。
 * innerRadius = 0 のときは中心を頂点とする扇形になる。
 */
export function annularSectorSubpath(
  innerRadius: number,
  outerRadius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  origin: Point = { x: 0, y: 0 },
): string {
  const largeArc = Math.abs(endAngleDeg - startAngleDeg) > 180;
  const outerStart = polar(startAngleDeg, outerRadius, origin);
  const outerEnd = polar(endAngleDeg, outerRadius, origin);
  const ro: Point = { x: outerRadius, y: outerRadius };

  if (innerRadius <= 0) {
    return path(
      moveTo(origin),
      lineTo(outerStart),
      arcTo(ro, outerEnd, { largeArc, sweep: true }),
      CLOSE,
    );
  }

  const innerEnd = polar(endAngleDeg, innerRadius, origin);
  const innerStart = polar(startAngleDeg, innerRadius, origin);
  const ri: Point = { x: innerRadius, y: innerRadius };
  return path(
    moveTo(outerStart),
    arcTo(ro, outerEnd, { largeArc, sweep: true }),
    lineTo(innerEnd),
    arcTo(ri, innerStart, { largeArc, sweep: false }),
    CLOSE,
  );
}

/** 縦軸（x=0）に対して鏡像化した点列を、順序を反転して返す */
export function mirrorPointsX(points: readonly Point[]): Point[] {
  return points.map((p) => ({ x: -p.x, y: p.y })).reverse();
}

/** 点列のうち原点からの最大距離。モチーフの外接半径の算出に使う。 */
export function maxRadius(points: readonly Point[], origin: Point = { x: 0, y: 0 }): number {
  return points.reduce((max, p) => Math.max(max, Math.hypot(p.x - origin.x, p.y - origin.y)), 0);
}

/** 値を [min, max] に収める */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/* ==========================================================================
   構造化パス
   モチーフは文字列ではなくセグメント列として組み立てる。
   鏡像・拡縮・平行移動と外接半径の算出を、文字列を再解析せずに行うため。
   ========================================================================== */

export type Segment =
  | { t: "M"; p: Point }
  | { t: "L"; p: Point }
  | { t: "Q"; c: Point; p: Point }
  | { t: "C"; c1: Point; c2: Point; p: Point }
  | { t: "Z" };

export function segmentsToPath(segments: readonly Segment[]): string {
  return segments
    .map((seg) => {
      switch (seg.t) {
        case "M":
          return moveTo(seg.p);
        case "L":
          return lineTo(seg.p);
        case "Q":
          return quadTo(seg.c, seg.p);
        case "C":
          return cubicTo(seg.c1, seg.c2, seg.p);
        case "Z":
          return CLOSE;
      }
    })
    .join(" ");
}

function mapSegment(seg: Segment, f: (p: Point) => Point): Segment {
  switch (seg.t) {
    case "M":
      return { t: "M", p: f(seg.p) };
    case "L":
      return { t: "L", p: f(seg.p) };
    case "Q":
      return { t: "Q", c: f(seg.c), p: f(seg.p) };
    case "C":
      return { t: "C", c1: f(seg.c1), c2: f(seg.c2), p: f(seg.p) };
    case "Z":
      return seg;
  }
}

export function mapSegments(
  segments: readonly Segment[],
  f: (p: Point) => Point,
): Segment[] {
  return segments.map((seg) => mapSegment(seg, f));
}

/** 縦軸（x=0）に対する鏡像。fill-rule="evenodd" を使うため巻き方向は問わない。 */
export function mirrorSegments(segments: readonly Segment[]): Segment[] {
  return mapSegments(segments, (p) => ({ x: -p.x, y: p.y }));
}

export function translateSegments(
  segments: readonly Segment[],
  dx: number,
  dy: number,
): Segment[] {
  return mapSegments(segments, (p) => ({ x: p.x + dx, y: p.y + dy }));
}

export function scaleSegments(segments: readonly Segment[], k: number): Segment[] {
  return mapSegments(segments, (p) => ({ x: p.x * k, y: p.y * k }));
}

/** ベジェ 1 本あたりの標本点数。外接半径の誤差が図の 0.2% 未満に収まる値。 */
const FLATTEN_STEPS = 16;

function quadAt(p0: Point, c: Point, p1: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  };
}

function cubicAt(p0: Point, c1: Point, c2: Point, p1: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
  };
}

/**
 * セグメント列を、実際に線が通る点の列へ展開する。
 *
 * 制御点は曲線の外側へ張り出すため、外接半径や重心をそのまま制御点から求めると
 * 図形を実際より大きく見積もってしまう（円を三次ベジェで近似した場合は約 14% 過大）。
 * 充填率の判定と中心合わせは、必ずこの展開後の点で行う。
 */
export function flattenSegments(
  segments: readonly Segment[],
  steps = FLATTEN_STEPS,
): Point[] {
  const points: Point[] = [];
  let current: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };

  for (const seg of segments) {
    switch (seg.t) {
      case "M":
        current = seg.p;
        start = seg.p;
        points.push(current);
        break;
      case "L":
        current = seg.p;
        points.push(current);
        break;
      case "Q": {
        for (let i = 1; i <= steps; i++) points.push(quadAt(current, seg.c, seg.p, i / steps));
        current = seg.p;
        break;
      }
      case "C": {
        for (let i = 1; i <= steps; i++)
          points.push(cubicAt(current, seg.c1, seg.c2, seg.p, i / steps));
        current = seg.p;
        break;
      }
      case "Z":
        current = start;
        break;
    }
  }

  return points;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function boundsOf(groups: readonly (readonly Segment[])[]): Bounds {
  const points = groups.flatMap((g) => flattenSegments(g));
  if (points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

/**
 * 複数のセグメント群をまとめて重心（バウンディングボックス中心）に寄せ、
 * 外接半径がちょうど `radius` になるよう等倍拡縮する。
 *
 * 「基部から伸びる単位」として定義したモチーフを、そのまま
 * 「中心対称に据える図形」へ転用するための変換（PLAN 3.2）。
 */
export function centerAndFit(
  groups: readonly (readonly Segment[])[],
  radius: number,
): { groups: Segment[][]; scale: number } {
  const b = boundsOf(groups);
  const dx = -(b.minX + b.maxX) / 2;
  const dy = -(b.minY + b.maxY) / 2;
  const centered = groups.map((g) => translateSegments(g, dx, dy));
  const current = maxRadius(centered.flatMap((g) => flattenSegments(g)));
  const scale = current > 0 ? radius / current : 1;
  return { groups: centered.map((g) => scaleSegments(g, scale)), scale };
}

/**
 * 2 点を結ぶ帯状の閉じた副パス。塗り面に開ける白抜き（葉脈・羽の筋）に使う。
 * 始端と終端で幅を変えられる。
 */
export function taperedSlit(
  from: Point,
  to: Point,
  widthAtFrom: number,
  widthAtTo: number,
): Segment[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) throw new Error("taperedSlit: 始点と終点が同一です");
  const nx = -dy / len;
  const ny = dx / len;
  const a = widthAtFrom / 2;
  const b = widthAtTo / 2;
  return [
    { t: "M", p: { x: from.x + nx * a, y: from.y + ny * a } },
    { t: "L", p: { x: to.x + nx * b, y: to.y + ny * b } },
    { t: "L", p: { x: to.x - nx * b, y: to.y - ny * b } },
    { t: "L", p: { x: from.x - nx * a, y: from.y - ny * a } },
    { t: "Z" },
  ];
}

/**
 * 基部 (0,0) から右側を上へ辿る手順を与えると、縦軸対称の閉じた輪郭を返す。
 * 家紋のモチーフはほぼ全てが縦軸対称であるため、片側だけを記述できるようにする。
 */
export interface OutlineStep {
  /** 省略時は直線 */
  control?: Point;
  to: Point;
}

export function symmetricOutline(steps: readonly OutlineStep[]): Segment[] {
  if (steps.length === 0) throw new Error("symmetricOutline: 手順が空です");
  const base: Point = { x: 0, y: 0 };
  const segments: Segment[] = [{ t: "M", p: base }];

  for (const step of steps) {
    segments.push(
      step.control ? { t: "Q", c: step.control, p: step.to } : { t: "L", p: step.to },
    );
  }

  // 先端から基部へ、左側を鏡像で辿って戻る
  const mirror = (p: Point): Point => ({ x: -p.x, y: p.y });
  for (let i = steps.length - 1; i >= 0; i--) {
    const current = steps[i] as OutlineStep;
    const previous = i > 0 ? (steps[i - 1] as OutlineStep).to : base;
    segments.push(
      current.control
        ? { t: "Q", c: mirror(current.control), p: mirror(previous) }
        : { t: "L", p: mirror(previous) },
    );
  }

  segments.push({ t: "Z" });
  return segments;
}

/** 真円の閉じたセグメント列（円弧を使わず 4 本の三次ベジェで近似する） */
const KAPPA = 0.5522847498307936;

export function circleSegments(center: Point, radius: number): Segment[] {
  const { x, y } = center;
  const k = radius * KAPPA;
  return [
    { t: "M", p: { x, y: y - radius } },
    { t: "C", c1: { x: x + k, y: y - radius }, c2: { x: x + radius, y: y - k }, p: { x: x + radius, y } },
    { t: "C", c1: { x: x + radius, y: y + k }, c2: { x: x + k, y: y + radius }, p: { x, y: y + radius } },
    { t: "C", c1: { x: x - k, y: y + radius }, c2: { x: x - radius, y: y + k }, p: { x: x - radius, y } },
    { t: "C", c1: { x: x - radius, y: y - k }, c2: { x: x - k, y: y - radius }, p: { x, y: y - radius } },
    { t: "Z" },
  ];
}

/** 多角形の閉じたセグメント列 */
export function polygonSegments(points: readonly Point[]): Segment[] {
  if (points.length < 3) throw new Error("polygonSegments: 3 点以上が必要です");
  const [first, ...rest] = points as [Point, ...Point[]];
  return [
    { t: "M", p: first },
    ...rest.map((p): Segment => ({ t: "L", p })),
    { t: "Z" },
  ];
}
