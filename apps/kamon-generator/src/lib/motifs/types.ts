/**
 * モチーフの契約（SPEC 3.2.3 / PLAN 3.2）。
 *
 * すべてのモチーフは「塗り（面）」を基調とする。輪郭を補強するための stroke は
 * 持たず、線そのものが意匠である場合（源氏車の輻など）だけ strokes を宣言する。
 * 白抜きは同一 `d` 内の副パス + fill-rule="evenodd" で表現する。
 */

import type { Rng } from "../hash";
import type { Segment } from "../geometry";

export type MotifCategory = "plant" | "creature" | "object" | "geometric";

export const CATEGORY_LABEL: Record<MotifCategory, string> = {
  plant: "植物紋",
  creature: "動物紋",
  object: "器物紋",
  geometric: "幾何紋",
};

export type CompositionKind = "radial" | "single" | "crossed" | "ring";

export type CompositionSpec =
  | { kind: "radial"; counts: readonly number[] }
  | { kind: "ring"; counts: readonly number[] }
  | { kind: "crossed" }
  | { kind: "single" };

export interface StrokeShape {
  segments: Segment[];
  width: number;
}

/**
 * モチーフ 1 単位の幾何。
 * `fills` の各要素は 1 本の `d` として出力され、内部の副パスが白抜きになる。
 */
export interface UnitGeometry {
  fills: Segment[][];
  strokes: StrokeShape[];
  /** 単位の基部が配置基準点から離れている距離（放射・違い構成で FR-103.2 の検証に使う） */
  baseOffset: number;
  /** 単位の最大半幅角（度）。放射構成で FR-103.3 の検証に使う */
  halfWidthAngle: number;
  /** 配置基準点からの外接半径 */
  extent: number;
}

export interface Motif {
  id: string;
  /** 紋名に使う呼称（例「柏」） */
  label: string;
  category: MotifCategory;
  supports: readonly CompositionSpec[];
  /** 基部を原点、-y 方向へ長さ `length` で伸びる単位を組み立てる */
  buildUnit?: (rng: Rng, length: number) => UnitGeometry;
  /** 原点を中心とし、外接半径 `radius` に収まる図形を組み立てる */
  buildCentered?: (rng: Rng, radius: number) => UnitGeometry;
}

export function supportsKind(motif: Motif, kind: CompositionKind): boolean {
  return motif.supports.some((spec) => spec.kind === kind);
}

export function countsFor(motif: Motif, kind: "radial" | "ring"): readonly number[] {
  const spec = motif.supports.find((s) => s.kind === kind);
  return spec && "counts" in spec ? spec.counts : [];
}
