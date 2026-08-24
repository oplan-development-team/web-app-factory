/**
 * 外郭（SPEC 3.2.2）。
 *
 * 紋を囲む輪は「線そのものが意匠」であるため stroke で描く（FR-101.2）。
 * 線幅はいずれも MIN_STROKE を大きく上回る太さを取り、遠目でも輪として読めるようにする。
 */

import { MIN_STROKE, R_FIELD } from "./constants";
import { type Segment, circleSegments, polygonSegments, regularPolygon } from "./geometry";

export type EnclosureId = "maru" | "futae" | "kaku" | "kikkou" | "none";

export interface EnclosureRing {
  segments: Segment[];
  width: number;
}

export interface Enclosure {
  id: EnclosureId;
  /** 紋名の接頭辞（例「丸に」）。外郭なしは空文字 */
  prefix: string;
  /** モチーフが占めてよい正円領域の半径 */
  innerRadius: number;
  rings: EnclosureRing[];
  /** 抽選の重み（FR-110.1） */
  weight: number;
}

/** 隅切り角: 一辺の中心までの距離 a、隅の落とし幅 c */
function sumikiriKaku(a: number, c: number): Segment[] {
  return polygonSegments([
    { x: -a + c, y: -a },
    { x: a - c, y: -a },
    { x: a, y: -a + c },
    { x: a, y: a - c },
    { x: a - c, y: a },
    { x: -a + c, y: a },
    { x: -a, y: a - c },
    { x: -a, y: -a + c },
  ]);
}

const ENCLOSURE_LIST: readonly Enclosure[] = [
  {
    id: "maru",
    prefix: "丸に",
    innerRadius: 164,
    rings: [{ segments: circleSegments({ x: 0, y: 0 }, 176), width: 20 }],
    weight: 40,
  },
  {
    id: "none",
    prefix: "",
    innerRadius: 180,
    rings: [],
    weight: 22,
  },
  {
    id: "futae",
    prefix: "二重丸に",
    innerRadius: 144,
    rings: [
      { segments: circleSegments({ x: 0, y: 0 }, 180), width: 13 },
      { segments: circleSegments({ x: 0, y: 0 }, 152), width: 10 },
    ],
    weight: 14,
  },
  {
    id: "kaku",
    prefix: "隅切り角に",
    innerRadius: 130,
    rings: [{ segments: sumikiriKaku(140, 32), width: 18 }],
    weight: 12,
  },
  {
    id: "kikkou",
    prefix: "亀甲に",
    innerRadius: 144,
    rings: [{ segments: polygonSegments(regularPolygon(6, 180)), width: 18 }],
    weight: 12,
  },
] as const;

export const ENCLOSURES = ENCLOSURE_LIST;

export function enclosureById(id: string): Enclosure {
  return ENCLOSURES.find((e) => e.id === id) ?? (ENCLOSURES[0] as Enclosure);
}

/** 外郭が描画領域と最小線幅の制約を満たしているか（テストから参照する） */
export function enclosureFitsField(enclosure: Enclosure): boolean {
  return enclosure.rings.every((ring) => {
    if (ring.width < MIN_STROKE) return false;
    // 制御点は曲線の外側へ張り出すため、実際に線が通る通過点だけを見る
    const outer = ring.segments.reduce(
      (max, seg) => (seg.t === "Z" ? max : Math.max(max, Math.hypot(seg.p.x, seg.p.y))),
      0,
    );
    return outer + ring.width / 2 <= R_FIELD;
  });
}
