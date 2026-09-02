import { CANVAS, STROKE_WIDTH } from "../constants.ts";
import { randInt, randRange } from "../rng.ts";
import type { Rng } from "../types.ts";
import { fieldOffset, makePoles, type Pole } from "./field.ts";
import { dottedDash, path, polylinePath, type Point } from "./svg.ts";

/**
 * RADIAL / ほうしゃ — 同心円。
 *
 * 相性の傾きは「ななめ」。斜めに構えたときの、
 * 一点へ収束していく遠近感を骨格にしている。
 *
 * 完全な真円の入れ子だと機械的なので、副次的な渦中心（極）を置いて
 * 輪をわずかに歪ませる。輪は円弧ではなくポリラインで描く
 * ——歪ませるには各角度で半径を動かす必要があるため。
 */

const MAX_RADIUS = CANVAS.SIZE / 2 - CANVAS.MARGIN;
/** 1 本の輪を何点で描くか。少ないと多角形に見える。 */
const RING_SAMPLES = 88;

interface RadialParams {
  ringCount: number;
  cx: number;
  cy: number;
  /** 間隔の非線形さ。1 で等間隔、小さいほど外側が詰まる。 */
  spacingExponent: number;
  strokeWidth: number;
  poles: Pole[];
  fieldWeight: number;
}

function readParams(rng: Rng, density: number): RadialParams {
  return {
    ringCount: randInt(rng, 10 + density * 2, 16 + density * 2),
    cx: CANVAS.CENTER + randRange(rng, -10, 10),
    cy: CANVAS.CENTER + randRange(rng, -10, 10),
    spacingExponent: randRange(rng, 0.75, 1.25),
    strokeWidth: randRange(rng, 0.7, 1.2),
    // 主中心のほかに 2〜3 の渦。ここが「複数の渦が絡み合う」印象をつくる
    poles: makePoles(rng, randInt(rng, 2, 3), { min: 0, max: CANVAS.SIZE }),
    // 輪は閉じた線なので、歪ませすぎると自己交差する。他の系統より控えめに効かせる
    fieldWeight: randRange(rng, 0.4, 0.75),
  };
}

/** i 番目の輪の半径。指数で間隔に粗密をつける。 */
function radiusOf(params: RadialParams, i: number): number {
  return MAX_RADIUS * ((i + 1) / params.ringCount) ** params.spacingExponent;
}

/** 場で歪んだ 1 本の輪。閉じるために最後に始点へ戻る。 */
function ring(params: RadialParams, radius: number): string {
  const points: Point[] = [];
  for (let i = 0; i <= RING_SAMPLES; i += 1) {
    const angle = (i / RING_SAMPLES) * Math.PI * 2;
    const x = params.cx + Math.cos(angle) * radius;
    const y = params.cy + Math.sin(angle) * radius;
    const offset = fieldOffset(params.poles, x, y);
    // 内側の輪ほど歪みを抑える。中心が崩れると「放射」に読めなくなる
    const falloff = Math.min(1, radius / MAX_RADIUS + 0.25);
    points.push({
      x: x + offset.dx * params.fieldWeight * falloff,
      y: y + offset.dy * params.fieldWeight * falloff,
    });
  }
  return polylinePath(points);
}

function rings(params: RadialParams): string[] {
  const elements: string[] = [];
  for (let i = 0; i < params.ringCount; i += 1) {
    elements.push(path(ring(params, radiusOf(params, i)), { width: params.strokeWidth }));
  }
  return elements;
}

/** 第 2 層。中心から外へ向かう放射スポーク。場に沿って湾曲する。 */
function spokes(rng: Rng, params: RadialParams): string[] {
  const count = randInt(rng, 8, 16);
  const rotation = randRange(rng, 0, Math.PI * 2);
  const inner = MAX_RADIUS * randRange(rng, 0.08, 0.25);
  const elements: string[] = [];
  const steps = 22;

  for (let i = 0; i < count; i += 1) {
    const angle = rotation + (i / count) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const points: Point[] = [];
    for (let s = 0; s <= steps; s += 1) {
      const r = inner + (s / steps) * (MAX_RADIUS - inner);
      const x = params.cx + cos * r;
      const y = params.cy + sin * r;
      const offset = fieldOffset(params.poles, x, y);
      const falloff = r / MAX_RADIUS;
      points.push({
        x: x + offset.dx * params.fieldWeight * falloff,
        y: y + offset.dy * params.fieldWeight * falloff,
      });
    }
    elements.push(path(polylinePath(points), { width: params.strokeWidth }));
  }
  return elements;
}

/**
 * 第 3 層。点を連ねた輪。
 * 実線の輪と質感が違うので、同じ骨格のまま層が見分けられる。
 */
function dottedRings(rng: Rng, params: RadialParams): string[] {
  const count = randInt(rng, 3, 5);
  const elements: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const radius = MAX_RADIUS * randRange(rng, 0.3, 1.02);
    elements.push(
      path(ring(params, radius), {
        // 太めにして点を目立たせるが、上限は必ず守る（FR-101.2）
        width: Math.min(STROKE_WIDTH.MAX, params.strokeWidth * 1.2),
        dash: dottedDash(randRange(rng, 3, 5.5)),
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
    layers.push(dottedRings(rng, params));
  }
  return layers;
}
