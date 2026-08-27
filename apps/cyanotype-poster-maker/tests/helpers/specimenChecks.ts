/**
 * 所蔵標本の共通不変条件（PLAN 4）。
 *
 * 「植物に見えるか」は最終的には目で見るしかないが、意匠として成立するための
 * 最低条件は数値へ落とせる。ここでは決定性・階調範囲・被覆・収まり・個体差を
 * 全種に対して同じ基準で当てる。
 */

import { setCanvasFactory } from '../../src/core/ctx2d';
import { mulberry32 } from '../../src/core/random';
import type { Specimen } from '../../src/specimens/types';
import { FakeCtx, fakeCanvasFactory, grayValueOf } from '../fakes/fakeCtx';

export interface RenderResult {
  ctx: FakeCtx;
  width: number;
  height: number;
}

export function renderSpecimen(specimen: Specimen, seed: number, width = 600, height = 800): RenderResult {
  setCanvasFactory(fakeCanvasFactory());
  const ctx = new FakeCtx(width, height);
  specimen.draw(ctx, width, height, mulberry32(seed));
  return { ctx, width, height };
}

/** 植物体（地より明るい塗り）の外接範囲。 */
export function organBounds(result: RenderResult): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const bounds = result.ctx.paintedBounds;
  if (bounds.length === 0) return null;
  return {
    minX: Math.min(...bounds.map((b) => b.minX)),
    minY: Math.min(...bounds.map((b) => b.minY)),
    maxX: Math.max(...bounds.map((b) => b.maxX)),
    maxY: Math.max(...bounds.map((b) => b.maxY)),
  };
}

/** 図が描画領域に占める面積比（外接矩形ベースの粗い見積り）。 */
export function coverageRatio(result: RenderResult): number {
  const b = organBounds(result);
  if (!b) return 0;
  const w = Math.min(result.width, b.maxX) - Math.max(0, b.minX);
  const h = Math.min(result.height, b.maxY) - Math.max(0, b.minY);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / (result.width * result.height);
}

/** 実際に使われたグレー階調の一覧。 */
export function usedTones(result: RenderResult): number[] {
  return result.ctx
    .usedColors()
    .map(grayValueOf)
    .filter((v): v is number => v !== null);
}
