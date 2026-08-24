/**
 * シード文字列から、色に依存しない紋の構造を決定的に組み立てる。
 *
 * 抽選は「制約の強い順」に行う（PLAN 3.1）。外郭を先に決めると紋様域の半径が
 * 確定し、以降のすべての寸法がそこから逆算されるため、無効な組み合わせが生じない。
 *
 *   外郭 → モチーフ → 構成 → 充填率 → 形状のゆらぎ → 座
 */

import {
  FILL_RATIO_MAX,
  FILL_RATIO_MIN,
  MIN_STROKE,
} from "./constants";
import {
  CROSSED_TILT_MAX,
  CROSSED_TILT_MIN,
  type CompositionPlan,
  type Placement,
  planComposition,
} from "./composition";
import { type Enclosure, enclosureById, ENCLOSURES } from "./enclosure";
import { flattenSegments } from "./geometry";
import { type Rng, mulberry32, pick, randFloat, seedForVariant, weightedPick } from "./hash";
import { MOTIFS, buildMotifGeometry } from "./motifs";
import type { CompositionKind, Motif, UnitGeometry } from "./motifs/types";
import { CATEGORY_LABEL } from "./motifs/types";
import { buildKamonName, symmetryLabelOf } from "./naming";

export type SeatKind = "none" | "dot" | "ring" | "hanabishi";

export interface Seat {
  kind: SeatKind;
  radius: number;
  width: number;
}

export interface KamonStructure {
  seedText: string;
  variantIndex: number;
  enclosureId: Enclosure["id"];
  motifId: string;
  motifLabel: string;
  categoryLabel: string;
  composition: CompositionPlan;
  fillRatio: number;
  unit: UnitGeometry;
  seat: Seat;
  name: string;
  symmetryLabel: string;
  /** 描画プリミティブ数（外郭の輪 + 単位 + 座）。FR-102.1 の検証対象 */
  primitiveCount: number;
}

/**
 * 構成ごとの抽選重み。
 * 放射は中心で単位が噛み合って塊をつくるため、家紋らしさが最も安定して出る。
 * 単独は 1 単位だけを大きく置くので、多用すると紋の表情が単調になる。
 */
const COMPOSITION_WEIGHT: Record<CompositionKind, number> = {
  radial: 6,
  crossed: 3,
  ring: 3,
  single: 2,
};

/** モチーフが対応する構成の中から 1 つ選び、単位数を確定する */
function chooseComposition(rng: Rng, motif: Motif): { kind: CompositionKind; count: number } {
  const spec = weightedPick(
    rng,
    motif.supports.map((s) => ({ value: s, weight: COMPOSITION_WEIGHT[s.kind] })),
  );
  switch (spec.kind) {
    case "single":
      return { kind: "single", count: 1 };
    case "crossed":
      return { kind: "crossed", count: 2 };
    case "radial":
    case "ring":
      return { kind: spec.kind, count: pick(rng, spec.counts) };
  }
}

/**
 * 座を置くのは、構成そのものが中心を空けている場合に限る（FR-140.1）。
 * 放射構成は単位が中心で接して塊をつくるため（FR-103.2）、そこへ座を重ねても
 * 墨の上に墨を置くだけで意味がない。
 */
function centerIsOpen(kind: CompositionKind, baseOffset: number): boolean {
  if (kind === "ring") return true;
  if (kind === "radial") return baseOffset > 8;
  return false;
}

function chooseSeat(
  rng: Rng,
  kind: CompositionKind,
  baseOffset: number,
  innerRadius: number,
): Seat {
  if (!centerIsOpen(kind, baseOffset)) {
    return { kind: "none", radius: 0, width: 0 };
  }

  const chosen = weightedPick<SeatKind>(rng, [
    { value: "none", weight: 30 },
    { value: "dot", weight: 32 },
    { value: "ring", weight: 18 },
    { value: "hanabishi", weight: 20 },
  ]);

  switch (chosen) {
    case "none":
      return { kind: "none", radius: 0, width: 0 };
    case "dot":
      return { kind: "dot", radius: randFloat(rng, 14, 20), width: 0 };
    case "ring":
      return {
        kind: "ring",
        radius: randFloat(rng, 20, 28),
        width: Math.max(MIN_STROKE, innerRadius * 0.07),
      };
    case "hanabishi":
      return { kind: "hanabishi", radius: randFloat(rng, 26, 34), width: 0 };
  }
}

export function buildKamonStructure(seedText: string, variantIndex: number): KamonStructure {
  const seed = seedForVariant(seedText, variantIndex);
  const rng = mulberry32(seed);

  const enclosure = weightedPick(
    rng,
    ENCLOSURES.map((e) => ({ value: e, weight: e.weight })),
  );

  const motif = pick(rng, MOTIFS);
  const { kind, count } = chooseComposition(rng, motif);
  const fillRatio = randFloat(rng, FILL_RATIO_MIN, FILL_RATIO_MAX);
  const motifRadius = enclosure.innerRadius * fillRatio;
  const tilt =
    kind === "crossed" ? randFloat(rng, CROSSED_TILT_MIN, CROSSED_TILT_MAX) : 0;

  /*
   * 単位の寸法と、複製後の紋全体の外接半径は一致しない。
   * 違い構成のように支点をずらして傾ける配置では両者が大きくずれる。
   * そこで一度組み立てて実測し、同じ乱数列のまま寸法だけを直して組み直す。
   * 配置も単位も寸法に対して線形なので、この 1 回の補正で
   * 充填率（FR-103.1）が構成によらず正確に成立する。
   */
  const motifSeed = (seed ^ 0x9e3779b9) >>> 0;
  const buildWith = (size: number): UnitGeometry =>
    buildMotifGeometry(motif, kind, mulberry32(motifSeed), size);

  let composition = planComposition(kind, count, motifRadius, tilt);
  let unit = buildWith(composition.unitSize);
  const measured = assemblyExtent(unit, composition.placements);
  if (measured > 0) {
    composition = planComposition(kind, count, (motifRadius * motifRadius) / measured, tilt);
    unit = buildWith(composition.unitSize);
  }

  const seat = chooseSeat(rng, kind, unit.baseOffset, enclosure.innerRadius);

  const primitiveCount =
    enclosure.rings.length + composition.count + (seat.kind === "none" ? 0 : 1);

  return {
    seedText,
    variantIndex,
    enclosureId: enclosure.id,
    motifId: motif.id,
    motifLabel: motif.label,
    categoryLabel: CATEGORY_LABEL[motif.category],
    composition,
    fillRatio,
    unit,
    seat,
    name: buildKamonName({
      enclosurePrefix: enclosure.prefix,
      motifLabel: motif.label,
      kind,
      count: composition.count,
    }),
    symmetryLabel: symmetryLabelOf(kind, composition.count),
    primitiveCount,
  };
}

/** 構造から外郭の定義を引き直す（描画側が使う） */
export function enclosureOf(structure: KamonStructure): Enclosure {
  return enclosureById(structure.enclosureId);
}

/**
 * 単位を配置どおりに並べたときの、紋全体の外接半径を実測する。
 * 配置は `translate(0, pivotDrop) rotate(θ) translate(0, -offset)` の順に効く。
 */
export function assemblyExtent(
  unit: UnitGeometry,
  placements: readonly Placement[],
): number {
  const points = [
    ...unit.fills.flatMap((f) => flattenSegments(f)),
    ...unit.strokes.flatMap((s) => flattenSegments(s.segments)),
  ];
  let max = 0;
  for (const placement of placements) {
    const rad = (placement.rotate * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    for (const p of points) {
      const ly = p.y - placement.offset;
      const x = p.x * cos - ly * sin;
      const y = p.x * sin + ly * cos + placement.pivotDrop;
      max = Math.max(max, Math.hypot(x, y));
    }
  }
  return max;
}

/** 紋全体の外接半径（構造から実測する） */
export function motifExtentOf(structure: KamonStructure): number {
  return assemblyExtent(structure.unit, structure.composition.placements);
}
