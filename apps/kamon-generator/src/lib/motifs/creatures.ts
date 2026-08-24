/**
 * 動物紋。
 * 鷹の羽は「違い（2 枚を交差させる）」構成の代表で、蝶は単独で紋様域を占める。
 */

import { type Segment, circleSegments, mirrorSegments } from "../geometry";
import { type Rng, randFloat } from "../hash";
import { finishCentered, finishUnit, vein, withCuts } from "./shared";
import type { Motif, UnitGeometry } from "./types";

function buildTakanoha(rng: Rng, L: number): UnitGeometry {
  const W = L * randFloat(rng, 0.24, 0.29);
  const body = [
    { t: "M", p: { x: 0, y: 0 } },
    { t: "L", p: { x: 0.34 * W, y: -0.05 * L } },
    { t: "Q", c: { x: 0.98 * W, y: -0.26 * L }, p: { x: 1.0 * W, y: -0.58 * L } },
    { t: "Q", c: { x: 0.94 * W, y: -0.9 * L }, p: { x: 0, y: -L } },
    { t: "Q", c: { x: -0.94 * W, y: -0.9 * L }, p: { x: -1.0 * W, y: -0.58 * L } },
    { t: "Q", c: { x: -0.98 * W, y: -0.26 * L }, p: { x: -0.34 * W, y: -0.05 * L } },
    { t: "Z" },
  ] satisfies Segment[];

  // 羽軸
  const shaft = vein({ x: 0, y: -0.06 * L }, { x: 0, y: -0.92 * L }, L * 0.045, L * 0.018);

  // 羽枝: 軸から斜め上へ伸びる白抜き。輪郭の内側に収まるよう到達幅を段階的に変える。
  const reaches = [0.58, 0.78, 0.84] as const;
  const barbs: Segment[][] = [];
  reaches.forEach((reach, i) => {
    const y = -(0.3 + 0.19 * i) * L;
    const right = vein(
      { x: 0.05 * W, y },
      { x: reach * W, y: y - 0.09 * L },
      L * 0.032,
      L * 0.032,
    );
    barbs.push(right, mirrorSegments(right));
  });

  return finishUnit([withCuts(body, shaft, ...barbs)]);
}

function buildChou(rng: Rng, R: number): UnitGeometry {
  const spread = randFloat(rng, 0.94, 1.06);

  const upperWing = [
    { t: "M", p: { x: 0.06 * R, y: -0.06 * R } },
    {
      t: "C",
      c1: { x: 0.22 * R, y: -0.72 * R * spread },
      c2: { x: 0.7 * R, y: -1.0 * R * spread },
      p: { x: 0.9 * R, y: -0.58 * R },
    },
    {
      t: "C",
      c1: { x: 1.02 * R, y: -0.34 * R },
      c2: { x: 0.9 * R, y: -0.14 * R },
      p: { x: 0.58 * R, y: -0.05 * R },
    },
    {
      t: "C",
      c1: { x: 0.4 * R, y: -0.01 * R },
      c2: { x: 0.2 * R, y: 0 },
      p: { x: 0.06 * R, y: -0.06 * R },
    },
    { t: "Z" },
  ] satisfies Segment[];

  const lowerWing = [
    { t: "M", p: { x: 0.06 * R, y: 0.02 * R } },
    {
      t: "C",
      c1: { x: 0.34 * R, y: 0.06 * R },
      c2: { x: 0.66 * R, y: 0.3 * R },
      p: { x: 0.56 * R, y: 0.6 * R },
    },
    {
      t: "C",
      c1: { x: 0.48 * R, y: 0.84 * R },
      c2: { x: 0.18 * R, y: 0.8 * R },
      p: { x: 0.1 * R, y: 0.48 * R },
    },
    {
      t: "C",
      c1: { x: 0.06 * R, y: 0.28 * R },
      c2: { x: 0.04 * R, y: 0.12 * R },
      p: { x: 0.06 * R, y: 0.02 * R },
    },
    { t: "Z" },
  ] satisfies Segment[];

  const upperSpot = circleSegments({ x: 0.58 * R, y: -0.52 * R }, 0.1 * R);
  const lowerSpot = circleSegments({ x: 0.32 * R, y: 0.44 * R }, 0.075 * R);

  const body = [
    { t: "M", p: { x: 0, y: -0.86 * R } },
    { t: "Q", c: { x: 0.13 * R, y: -0.3 * R }, p: { x: 0.1 * R, y: 0.2 * R } },
    { t: "Q", c: { x: 0.07 * R, y: 0.52 * R }, p: { x: 0, y: 0.72 * R } },
    { t: "Q", c: { x: -0.07 * R, y: 0.52 * R }, p: { x: -0.1 * R, y: 0.2 * R } },
    { t: "Q", c: { x: -0.13 * R, y: -0.3 * R }, p: { x: 0, y: -0.86 * R } },
    { t: "Z" },
  ] satisfies Segment[];

  const fills = [
    withCuts(upperWing, upperSpot),
    withCuts(mirrorSegments(upperWing), mirrorSegments(upperSpot)),
    withCuts(lowerWing, lowerSpot),
    withCuts(mirrorSegments(lowerWing), mirrorSegments(lowerSpot)),
    body,
  ];

  return finishCentered(fills, [], R);
}

export const CREATURE_MOTIFS: readonly Motif[] = [
  {
    id: "takanoha",
    label: "鷹の羽",
    category: "creature",
    supports: [{ kind: "crossed" }, { kind: "single" }],
    buildUnit: buildTakanoha,
  },
  {
    id: "chou",
    label: "蝶",
    category: "creature",
    supports: [{ kind: "single" }],
    buildCentered: buildChou,
  },
] as const;
