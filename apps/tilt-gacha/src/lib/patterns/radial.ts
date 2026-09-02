import { CANVAS, STROKE_WIDTH } from "../constants.ts";
import { randInt, randRange } from "../rng.ts";
import type { Rng } from "../types.ts";
import { circle, line } from "./svg.ts";

/**
 * RADIAL / ほうしゃ — 同心円。
 *
 * 相性の傾きは「ななめ」。斜めに構えたときの、
 * 一点へ収束していく遠近感を骨格にしている。
 */

const MAX_RADIUS = CANVAS.SIZE / 2 - CANVAS.MARGIN;

interface RadialParams {
  ringCount: number;
  cx: number;
  cy: number;
  /** 間隔の非線形さ。1 で等間隔、小さいほど外側が詰まる。 */
  spacingExponent: number;
  strokeWidth: number;
}

function readParams(rng: Rng, density: number): RadialParams {
  return {
    ringCount: randInt(rng, 10 + density * 2, 16 + density * 2),
    cx: CANVAS.CENTER + randRange(rng, -10, 10),
    cy: CANVAS.CENTER + randRange(rng, -10, 10),
    spacingExponent: randRange(rng, 0.75, 1.25),
    strokeWidth: randRange(rng, 0.7, 1.2),
  };
}

/** i 番目の輪の半径。指数で間隔に粗密をつける。 */
function radiusOf(params: RadialParams, i: number): number {
  return MAX_RADIUS * ((i + 1) / params.ringCount) ** params.spacingExponent;
}

function rings(params: RadialParams): string[] {
  const elements: string[] = [];
  for (let i = 0; i < params.ringCount; i += 1) {
    elements.push(circle(params.cx, params.cy, radiusOf(params, i), { width: params.strokeWidth }));
  }
  return elements;
}

/** 第 2 層。中心から外へ向かう放射スポーク。 */
function spokes(rng: Rng, params: RadialParams): string[] {
  const count = randInt(rng, 6, 16);
  const rotation = randRange(rng, 0, Math.PI * 2);
  const inner = MAX_RADIUS * randRange(rng, 0.08, 0.25);
  const elements: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = rotation + (i / count) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    elements.push(
      line(
        params.cx + cos * inner,
        params.cy + sin * inner,
        params.cx + cos * MAX_RADIUS,
        params.cy + sin * MAX_RADIUS,
        { width: params.strokeWidth },
      ),
    );
  }
  return elements;
}

/**
 * 第 3 層。途切れた円弧のリング。
 * 破線の円で表す — 弧を個別のパスにすると要素数が跳ね上がるため（FR-110.2）。
 */
function brokenArcs(rng: Rng, params: RadialParams): string[] {
  const count = randInt(rng, 2, 4);
  const elements: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const radius = MAX_RADIUS * randRange(rng, 0.3, 0.95);
    const dashLength = randRange(rng, 6, 20);
    const gapLength = randRange(rng, 4, 14);
    elements.push(
      circle(params.cx, params.cy, radius, {
        // 太めにして弧を目立たせるが、上限は必ず守る（FR-101.2）
        width: Math.min(STROKE_WIDTH.MAX, params.strokeWidth * 1.2),
        dash: `${dashLength.toFixed(2)} ${gapLength.toFixed(2)}`,
      }),
    );
  }
  return elements;
}

export function buildRadialLayers(rng: Rng, layerCount: number): string[][] {
  const params = readParams(rng, layerCount - 1);
  const layers: string[][] = [rings(params)];

  if (layerCount >= 2) {
    layers.push(spokes(rng, params));
  }
  if (layerCount >= 3) {
    layers.push(brokenArcs(rng, params));
  }
  return layers;
}
