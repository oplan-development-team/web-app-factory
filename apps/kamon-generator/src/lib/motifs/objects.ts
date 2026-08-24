/**
 * 器物紋。
 * 扇は放射に据えると「三つ扇」の骨格になり、源氏車は単独で紋様域を占める。
 * 源氏車の輻（スポーク）は「線そのものが意匠」であるため、例外的に stroke で描く（FR-101.2）。
 */

import { MIN_STROKE } from "../constants";
import { type Point, type Segment, circleSegments, polar, polygonSegments } from "../geometry";
import { type Rng, randFloat, randInt } from "../hash";
import { finishCentered, finishUnit, vein, withCuts } from "./shared";
import type { Motif, StrokeShape, UnitGeometry } from "./types";

/** 扇の弧を折れ線で近似する（半径 1 に対する矢高が 0.005 未満で、目視では円弧と区別できない） */
const ARC_STEPS = 8;

function buildOugi(rng: Rng, L: number): UnitGeometry {
  const halfAngle = randFloat(rng, 39, 46);
  const pivot: Point = { x: 0, y: -0.06 * L };
  const outer = 0.94 * L;

  const rim: Point[] = Array.from({ length: ARC_STEPS + 1 }, (_, i) =>
    polar(-halfAngle + (2 * halfAngle * i) / ARC_STEPS, outer, pivot),
  );
  const body = polygonSegments([pivot, ...rim]);

  // 骨: 要から縁へ向かう白抜き
  const ribAngles = [-halfAngle * 0.5, 0, halfAngle * 0.5];
  const ribs = ribAngles.map((angle) =>
    vein(
      polar(angle, outer * 0.2, pivot),
      polar(angle, outer * 0.9, pivot),
      L * 0.03,
      L * 0.03,
    ),
  );

  // 要（かなめ）: 扇の軸を留める小さな塊
  const kaname = circleSegments(pivot, 0.1 * L);

  return finishUnit([withCuts(body, ...ribs), kaname]);
}

function buildKuruma(rng: Rng, R: number): UnitGeometry {
  const spokeCount = randInt(rng, 6, 8);
  const rimInner = randFloat(rng, 0.76, 0.82);
  const hubOuter = randFloat(rng, 0.24, 0.29);

  const rim = withCuts(circleSegments({ x: 0, y: 0 }, R), circleSegments({ x: 0, y: 0 }, R * rimInner));
  const hub = withCuts(
    circleSegments({ x: 0, y: 0 }, R * hubOuter),
    circleSegments({ x: 0, y: 0 }, R * hubOuter * 0.42),
  );

  const spokeWidth = Math.max(MIN_STROKE, R * 0.1);
  const spokes: StrokeShape[] = Array.from({ length: spokeCount }, (_, i) => {
    const angle = (360 / spokeCount) * i;
    const segments: Segment[] = [
      { t: "M", p: polar(angle, R * hubOuter * 0.7) },
      { t: "L", p: polar(angle, R * (rimInner + 0.04)) },
    ];
    return { segments, width: spokeWidth };
  });

  return finishCentered([rim, hub], spokes, R);
}

export const OBJECT_MOTIFS: readonly Motif[] = [
  {
    id: "ougi",
    label: "扇",
    category: "object",
    supports: [{ kind: "radial", counts: [3] }, { kind: "single" }],
    buildUnit: buildOugi,
  },
  {
    id: "kuruma",
    label: "源氏車",
    category: "object",
    supports: [{ kind: "single" }],
    buildCentered: buildKuruma,
  },
] as const;
