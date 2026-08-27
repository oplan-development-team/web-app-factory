/** 所蔵標本の登録簿（SPEC 3.1.2 / FR-120）。 */

import type { Ctx2D } from '../core/ctx2d';
import { mulberry32 } from '../core/random';
import { ALGAE } from './algae';
import { FERN } from './fern';
import { GINKGO } from './ginkgo';
import { GRASS } from './grass';
import { UMBEL } from './umbel';
import { VENATION } from './venation';
import type { Specimen } from './types';

export type { Specimen } from './types';

export const SPECIMENS: readonly Specimen[] = [FERN, ALGAE, VENATION, GINKGO, GRASS, UMBEL] as const;

export function specimenById(id: string): Specimen | undefined {
  return SPECIMENS.find((s) => s.id === id);
}

/**
 * 図案を描く唯一の入口（FR-121, FR-123）。
 *
 * 乱数はここで `(id, seed)` からのみ組み立てる。呼び出し側が Rng を渡す形に
 * すると、同じシードでも呼び出し順によって図案が変わりうる。プレビュー・
 * サムネイル・書き出しで同じ絵が出ることが要件なので、入口を 1 つに絞る。
 *
 * `width`/`height` は出力先の実寸をそのまま渡すこと。低解像度で描いてから
 * 拡大すると、3× 書き出しで輪郭がぼける（FR-123）。
 */
export function drawSpecimen(ctx: Ctx2D, specimenId: string, seed: number, width: number, height: number): boolean {
  const specimen = specimenById(specimenId);
  if (!specimen) return false;
  specimen.draw(ctx, width, height, mulberry32(seed));
  return true;
}
