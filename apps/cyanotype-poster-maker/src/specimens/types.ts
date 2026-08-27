import type { Ctx2D } from '../core/ctx2d';
import type { Rng } from '../core/random';

/**
 * 所蔵標本（手続き生成の図案）の契約（SPEC 3.1.2 / PLAN 3.2）。
 *
 * `draw` は与えられた寸法に対する相対座標で図を組む。サムネイル(112×140)でも
 * プレート(3000px 級)でも同じ手続きが走るため、図案帳のサムネイルは
 * 製品そのものの縮小になり、別途アイコンを用意する必要がない（FR-124）。
 */
export interface Specimen {
  id: string;
  /** 図版番号（図案帳の表示に使う） */
  plateNo: string;
  /** 和名（図案帳の見出し） */
  label: string;
  /** 学名。ラベルの既定値になる */
  scientificName: string;
  /** 和名・通称。ラベルの既定値になる */
  commonName: string;
  /** 採集地。ラベルの既定値になる */
  locality: string;
  /** ひとことの解題（図案帳の副文） */
  note: string;
  /**
   * 陰画（フォトグラム）方式で図案を描く。
   * 植物体を明部、地を暗部として描くこと（FR-122）。
   */
  draw: (ctx: Ctx2D, width: number, height: number, rng: Rng) => void;
}
