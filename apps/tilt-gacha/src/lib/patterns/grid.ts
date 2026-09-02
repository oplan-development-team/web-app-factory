import { CANVAS } from "../constants.ts";
import { randInt, randRange } from "../rng.ts";
import type { Rng } from "../types.ts";
import { dot, line } from "./svg.ts";

/**
 * GRID / こうし — ドットの格子。
 *
 * 相性の傾きは「よこ」。端末を横に倒したときの、
 * 整列した升目を骨格にしている。
 */

const LEFT = CANVAS.MARGIN;
const TOP = CANVAS.MARGIN;
const SPAN = CANVAS.SIZE - CANVAS.MARGIN * 2;

interface GridParams {
  cols: number;
  baseRadius: number;
  /** 中心からの距離で半径を変える強さ。0 なら均一な格子。 */
  modulation: number;
  /** 半径変調の中心。ずらすと格子に非対称なレンズ感が出る。 */
  focusX: number;
  focusY: number;
}

function readParams(rng: Rng, density: number): GridParams {
  return {
    cols: randInt(rng, 8 + density, 12 + density),
    baseRadius: randRange(rng, 1.2, 2.6),
    modulation: randRange(rng, 0.3, 1),
    focusX: randRange(rng, 0.35, 0.65),
    focusY: randRange(rng, 0.35, 0.65),
  };
}

/**
 * 焦点からの距離で半径を変える。
 * 均一な点の海になると「格子」の意図が読み取れないので、
 * 疎密のグラデーションで視線の落ち着き先をつくる。
 */
function radiusAt(params: GridParams, u: number, v: number): number {
  const dx = u - params.focusX;
  const dy = v - params.focusY;
  const distance = Math.min(1, Math.hypot(dx, dy) / Math.SQRT1_2);
  const scale = 1 - params.modulation * distance;
  return Math.max(0.3, params.baseRadius * scale);
}

function lattice(params: GridParams, offset: number, count: number): string[] {
  const elements: string[] = [];
  if (count < 2) return elements;
  const step = SPAN / (count - 1);
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      const u = (col + offset) / (count - 1);
      const v = (row + offset) / (count - 1);
      const x = LEFT + (col + offset) * step;
      const y = TOP + (row + offset) * step;
      if (x > LEFT + SPAN || y > TOP + SPAN) continue;
      elements.push(dot(x, y, radiusAt(params, u, v)));
    }
  }
  return elements;
}

/** 第 3 層。格子を結ぶヘアライン。升目の骨組みを薄く見せる。 */
function hairlines(params: GridParams): string[] {
  const elements: string[] = [];
  const step = SPAN / (params.cols - 1);
  for (let i = 0; i < params.cols; i += 1) {
    const p = LEFT + i * step;
    elements.push(line(p, TOP, p, TOP + SPAN, { width: 0.6 }));
    elements.push(line(LEFT, TOP + i * step, LEFT + SPAN, TOP + i * step, { width: 0.6 }));
  }
  return elements;
}

export function buildGridLayers(rng: Rng, layerCount: number): string[][] {
  const params = readParams(rng, layerCount - 1);
  const layers: string[][] = [lattice(params, 0, params.cols)];

  if (layerCount >= 2) {
    // 半セルずらした副格子。同じ升目の骨格のまま密度だけを倍にする（FR-102.1）
    layers.push(lattice(params, 0.5, params.cols - 1));
  }
  if (layerCount >= 3) {
    layers.push(hairlines(params));
  }
  return layers;
}
