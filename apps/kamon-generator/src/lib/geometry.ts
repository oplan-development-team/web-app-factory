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
