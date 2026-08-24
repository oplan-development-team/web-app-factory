/**
 * 構成（SPEC 3.2.4）。
 *
 * 単位をどう複製して 1 つの紋にするかを決める。
 * 対称性は座標計算ではなく SVG の変換で担保するため、ここでは「変換の一覧」だけを返す。
 */

import type { CompositionKind } from "./motifs/types";

export interface Placement {
  /**
   * 回転の支点を中心より下へずらす量（違い構成のみ 0 以外）。
   * 交差する 2 枚は支点から上へ扇状に開くため、支点を下げないと図が上半分に偏る。
   */
  pivotDrop: number;
  /** 中心まわりの回転角（度） */
  rotate: number;
  /** 回転後、単位を中心から離す距離（連環構成のみ 0 以外） */
  offset: number;
  /** 縦軸に対する鏡像（違い構成の 2 枚目） */
  mirrored: boolean;
}

export interface CompositionPlan {
  kind: CompositionKind;
  count: number;
  /** モチーフの組み立てに渡す寸法（放射・違いでは長さ、単独・連環では半径） */
  unitSize: number;
  placements: Placement[];
  /** 連環構成での配置半径 */
  ringRadius: number;
  /** 違い構成での傾き（度） */
  tilt: number;
}

export const CROSSED_TILT_MIN = 34;
export const CROSSED_TILT_MAX = 44;

/** 違い構成で支点を下げる量（単位長に対する比） */
export const CROSSED_PIVOT_DROP_RATIO = 0.3;

/**
 * 紋様域の外接半径 `motifRadius` を使い切るように配置を解く。
 *
 * 連環構成では、隣接する単位が接するときの幾何
 * （中心間距離 = 2·Rr·sin(180/n)、単位半径 u = Rr·sin(180/n)）から
 * `Rr + u = motifRadius` を満たす Rr を逆算する。
 */
export function planComposition(
  kind: CompositionKind,
  count: number,
  motifRadius: number,
  tilt = 0,
): CompositionPlan {
  switch (kind) {
    case "single":
      return {
        kind,
        count: 1,
        unitSize: motifRadius,
        placements: [{ pivotDrop: 0, rotate: 0, offset: 0, mirrored: false }],
        ringRadius: 0,
        tilt: 0,
      };

    case "crossed": {
      const pivotDrop = motifRadius * CROSSED_PIVOT_DROP_RATIO;
      return {
        kind,
        count: 2,
        unitSize: motifRadius,
        placements: [
          { pivotDrop, rotate: tilt, offset: 0, mirrored: false },
          { pivotDrop, rotate: tilt, offset: 0, mirrored: true },
        ],
        ringRadius: 0,
        tilt,
      };
    }

    case "radial":
      return {
        kind,
        count,
        unitSize: motifRadius,
        placements: Array.from({ length: count }, (_, i) => ({
          pivotDrop: 0,
          rotate: (360 / count) * i,
          offset: 0,
          mirrored: false,
        })),
        ringRadius: 0,
        tilt: 0,
      };

    case "ring": {
      const sin = Math.sin(Math.PI / count);
      const ringRadius = motifRadius / (1 + sin);
      const unitSize = ringRadius * sin;
      return {
        kind,
        count,
        unitSize,
        placements: Array.from({ length: count }, (_, i) => ({
          pivotDrop: 0,
          rotate: (360 / count) * i,
          offset: ringRadius,
          mirrored: false,
        })),
        ringRadius,
        tilt: 0,
      };
    }
  }
}
