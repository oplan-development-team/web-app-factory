/** モチーフ実装が共通で使う組み立てヘルパ。 */

import { MIN_NEGATIVE, MIN_STROKE } from "../constants";
import {
  type Point,
  type Segment,
  centerAndFit,
  flattenSegments,
  maxRadius,
  taperedSlit,
} from "../geometry";
import type { StrokeShape, UnitGeometry } from "./types";

/** 半幅角を測る際、基部付近の点を無視する半径のしきい値（外接半径に対する比） */
const HALF_WIDTH_SAMPLE_FROM = 0.45;

function allPoints(fills: readonly Segment[][], strokes: readonly StrokeShape[]): Point[] {
  return [
    ...fills.flatMap((f) => flattenSegments(f)),
    ...strokes.flatMap((s) => flattenSegments(s.segments)),
  ];
}

/**
 * 単位の胴の張り出し角（度）。
 * 基部付近は角度が発散して意味を持たないため、外接半径の一定割合より外側だけを測る。
 */
function halfWidthAngleOf(points: readonly Point[], extent: number): number {
  if (extent <= 0) return 0;
  const threshold = extent * HALF_WIDTH_SAMPLE_FROM;
  let maxAngle = 0;
  for (const p of points) {
    if (Math.hypot(p.x, p.y) < threshold) continue;
    // -y を基準軸とした角度
    const angle = Math.abs((Math.atan2(p.x, -p.y) * 180) / Math.PI);
    if (angle < 90 && angle > maxAngle) maxAngle = angle;
  }
  return maxAngle;
}

/** 配置基準点に最も近い点までの距離。放射構成での中心接触の検証に使う（FR-103.2）。 */
function minRadius(points: readonly Point[]): number {
  if (points.length === 0) return 0;
  return points.reduce((min, p) => Math.min(min, Math.hypot(p.x, p.y)), Infinity);
}

/** 基部から伸びる単位を仕上げる（外接半径・基部距離・半幅角を算出する） */
export function finishUnit(
  fills: readonly Segment[][],
  strokes: readonly StrokeShape[] = [],
): UnitGeometry {
  const points = allPoints(fills, strokes);
  const extent = maxRadius(points);
  return {
    fills: fills.map((f) => [...f]),
    strokes: strokes.map((s) => ({ ...s, segments: [...s.segments] })),
    baseOffset: minRadius(points),
    halfWidthAngle: halfWidthAngleOf(points, extent),
    extent,
  };
}

/** 中心対称に据える図形を仕上げる（重心へ寄せ、外接半径を radius に合わせる） */
export function finishCentered(
  fills: readonly Segment[][],
  strokes: readonly StrokeShape[],
  radius: number,
): UnitGeometry {
  const fillCount = fills.length;
  const fitted = centerAndFit([...fills, ...strokes.map((s) => s.segments)], radius);
  const scaledFills = fitted.groups.slice(0, fillCount);
  const scaledStrokes = fitted.groups.slice(fillCount).map((segments, i) => ({
    segments,
    // 拡縮で線幅が最小線幅を割らないようにする（FR-101.3）
    width: Math.max(MIN_STROKE, (strokes[i] as StrokeShape).width * fitted.scale),
  }));
  const points = allPoints(scaledFills, scaledStrokes);
  return {
    fills: scaledFills,
    strokes: scaledStrokes,
    baseOffset: 0,
    halfWidthAngle: 90,
    extent: maxRadius(points),
  };
}

/**
 * 「基部から伸びる単位」を、そのまま中心対称の図形へ転用する。
 * 単独・連環構成で、専用の buildCentered を持たないモチーフに使う。
 */
export function centeredFromUnit(
  build: (length: number) => UnitGeometry,
  radius: number,
): UnitGeometry {
  const unit = build(radius * 1.9);
  return finishCentered(unit.fills, unit.strokes, radius);
}

/** 白抜きの葉脈。幅は MIN_NEGATIVE を下回らない（FR-101.4）。 */
export function vein(from: Point, to: Point, widthAtFrom: number, widthAtTo: number): Segment[] {
  return taperedSlit(
    from,
    to,
    Math.max(MIN_NEGATIVE, widthAtFrom),
    Math.max(MIN_NEGATIVE, widthAtTo),
  );
}

/** 塗り面と白抜きを 1 本の d にまとめる（fill-rule="evenodd" 前提） */
export function withCuts(body: Segment[], ...cuts: readonly Segment[][]): Segment[] {
  return [...body, ...cuts.flat()];
}
