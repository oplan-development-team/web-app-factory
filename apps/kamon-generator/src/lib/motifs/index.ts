/** モチーフ登録簿（SPEC 3.2.3）。 */

import type { Rng } from "../hash";
import { CREATURE_MOTIFS } from "./creatures";
import { GEOMETRIC_MOTIFS } from "./geometric";
import { OBJECT_MOTIFS } from "./objects";
import { PLANT_MOTIFS } from "./plants";
import { centeredFromUnit } from "./shared";
import type { CompositionKind, Motif, UnitGeometry } from "./types";

export * from "./types";

export const MOTIFS: readonly Motif[] = [
  ...PLANT_MOTIFS,
  ...CREATURE_MOTIFS,
  ...OBJECT_MOTIFS,
  ...GEOMETRIC_MOTIFS,
] as const;

export function motifById(id: string): Motif | undefined {
  return MOTIFS.find((m) => m.id === id);
}

/**
 * 構成に応じて適切な組み立て方を選ぶ。
 * 中心対称の図形を持たないモチーフは、単位を重心へ寄せて転用する（PLAN 3.2）。
 */
export function buildMotifGeometry(
  motif: Motif,
  kind: CompositionKind,
  rng: Rng,
  size: number,
): UnitGeometry {
  const wantsCentered = kind === "single" || kind === "ring";

  if (wantsCentered) {
    if (motif.buildCentered) return motif.buildCentered(rng, size);
    const build = motif.buildUnit;
    if (!build) throw new Error(`モチーフ ${motif.id} は中心対称の図形を組み立てられません`);
    return centeredFromUnit((length) => build(rng, length), size);
  }

  if (!motif.buildUnit) {
    throw new Error(`モチーフ ${motif.id} は放射・違い構成の単位を組み立てられません`);
  }
  return motif.buildUnit(rng, size);
}
