/**
 * 紋名の組み立て（SPEC 3.2.6）。
 *
 * 「丸に三つ柏」「二重丸に違い鷹の羽」のように、外郭・数詞・モチーフ名を
 * 決定的に連ねる。実在の家紋の呼称の作り方に倣う。
 */

import type { CompositionKind } from "./motifs/types";

const NUMERAL: Record<number, string> = {
  1: "",
  2: "二つ",
  3: "三つ",
  4: "四つ",
  5: "五つ",
  6: "六つ",
};

export interface NameParts {
  enclosurePrefix: string;
  motifLabel: string;
  kind: CompositionKind;
  count: number;
}

export function buildKamonName({
  enclosurePrefix,
  motifLabel,
  kind,
  count,
}: NameParts): string {
  const numeral =
    kind === "single" ? "" : kind === "crossed" ? "違い" : (NUMERAL[count] ?? `${count}つ`);
  return `${enclosurePrefix}${numeral}${motifLabel}`;
}

/** 図版帖・キャプション用の短い添え書き */
export function buildKamonSubtitle(categoryLabel: string, symmetryLabel: string): string {
  return `${categoryLabel}・${symmetryLabel}`;
}

export function symmetryLabelOf(kind: CompositionKind, count: number): string {
  switch (kind) {
    case "single":
      return "左右対称";
    case "crossed":
      return "左右対称・違い";
    case "radial":
    case "ring":
      return `${count}回回転対称`;
  }
}
