/**
 * 幾何紋。
 * 家紋の分類のうち最も抽象度が高く、少ない要素で最大の面を取れる。
 */

import { MIN_NEGATIVE } from "../constants";
import {
  type Point,
  type Segment,
  polygonSegments,
  regularPolygon,
  translateSegments,
} from "../geometry";
import { type Rng, randFloat } from "../hash";
import { finishUnit, withCuts } from "./shared";
import type { Motif, UnitGeometry } from "./types";

/**
 * 内側の切り抜きの縮小率を、面の残り幅が白抜きの下限を確実に上回るように決める。
 * `edgeDistance` は中心から辺までの距離。
 */
function safeInnerScale(edgeDistance: number, desired: number): number {
  if (edgeDistance <= 0) return desired;
  const maxScale = 1 - (MIN_NEGATIVE * 1.6) / edgeDistance;
  return Math.max(0.3, Math.min(desired, maxScale));
}

function buildHishi(rng: Rng, L: number): UnitGeometry {
  const W = L * randFloat(rng, 0.34, 0.4);
  const outline = (scale: number): Point[] => [
    { x: 0, y: -0.5 * L - 0.5 * L * scale },
    { x: W * scale, y: -0.5 * L },
    { x: 0, y: -0.5 * L + 0.5 * L * scale },
    { x: -W * scale, y: -0.5 * L },
  ];

  const body = polygonSegments(outline(1));
  const hollow = rng() < 0.55;
  if (!hollow) return finishUnit([body]);

  const edgeDistance = (W * (L / 2)) / Math.hypot(W, L / 2);
  const scale = safeInnerScale(edgeDistance, randFloat(rng, 0.48, 0.6));
  return finishUnit([withCuts(body, polygonSegments(outline(scale)))]);
}

/**
 * 巴。頭は大きな塊で、尾が中心へ巻き込む。
 * 三つ巴・四つ巴のように、複数を回すと頭同士が噛み合って中心に厚みができる。
 */
function buildTomoe(rng: Rng, L: number): UnitGeometry {
  const fat = randFloat(rng, 0.96, 1.08);
  const body = [
    { t: "M", p: { x: 0, y: 0 } },
    {
      t: "C",
      c1: { x: -0.1 * L, y: -0.18 * L },
      c2: { x: -0.34 * L, y: -0.24 * L },
      p: { x: -0.4 * L * fat, y: -0.44 * L },
    },
    {
      t: "C",
      c1: { x: -0.5 * L * fat, y: -0.78 * L },
      c2: { x: -0.1 * L, y: -1.0 * L },
      p: { x: 0.14 * L, y: -0.92 * L },
    },
    {
      t: "C",
      c1: { x: 0.42 * L * fat, y: -0.82 * L },
      c2: { x: 0.46 * L * fat, y: -0.44 * L },
      p: { x: 0.2 * L, y: -0.28 * L },
    },
    {
      t: "C",
      c1: { x: 0.1 * L, y: -0.2 * L },
      c2: { x: 0.04 * L, y: -0.1 * L },
      p: { x: 0, y: 0 },
    },
    { t: "Z" },
  ] satisfies Segment[];

  return finishUnit([body]);
}

function buildMeyui(rng: Rng, L: number): UnitGeometry {
  const center: Point = { x: 0, y: -0.55 * L };
  const halfDiagonal = 0.45 * L;
  const tilt = randFloat(rng, -4, 4);

  const outer = translateSegments(
    polygonSegments(regularPolygon(4, halfDiagonal, tilt)),
    center.x,
    center.y,
  );
  const edgeDistance = halfDiagonal / Math.SQRT2;
  const scale = safeInnerScale(edgeDistance, randFloat(rng, 0.38, 0.48));
  const inner = translateSegments(
    polygonSegments(regularPolygon(4, halfDiagonal * scale, tilt)),
    center.x,
    center.y,
  );

  return finishUnit([withCuts(outer, inner)]);
}

export const GEOMETRIC_MOTIFS: readonly Motif[] = [
  {
    id: "hishi",
    label: "菱",
    category: "geometric",
    // 違い構成は外さない：菱 2 枚を傾けて重ねると内側の抜きが互いに埋まり、
    // 輪郭のない塊になって「菱」と読めなくなるため
    // 6 枚を放射させると隣り合う菱が完全に重なって塊になり「菱」と読めなくなるため、
    // 放射は 4 枚まで。違い構成も同じ理由で持たない
    supports: [
      { kind: "radial", counts: [4] },
      { kind: "ring", counts: [4] },
    ],
    buildUnit: buildHishi,
  },
  {
    id: "tomoe",
    label: "巴",
    category: "geometric",
    supports: [{ kind: "radial", counts: [3, 4] }],
    buildUnit: buildTomoe,
  },
  {
    id: "meyui",
    label: "目結",
    category: "geometric",
    supports: [
      { kind: "ring", counts: [4, 5] },
      { kind: "radial", counts: [4] },
    ],
    buildUnit: buildMeyui,
  },
] as const;
