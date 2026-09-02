import { CANVAS } from "../constants.ts";
import { randInt, randRange } from "../rng.ts";
import type { Rng } from "../types.ts";
import { path, polylinePath, type Point } from "./svg.ts";

/**
 * FLOW / ながれ — 波打つ縦線の束。
 *
 * 相性の傾きは「たて」。端末をまっすぐ立てて構えたときの、
 * 上から下へ流れ落ちる感じを骨格にしている。
 */

const SAMPLES = 48;

const TOP = CANVAS.MARGIN;
const BOTTOM = CANVAS.SIZE - CANVAS.MARGIN;
const LEFT = CANVAS.MARGIN;
const RIGHT = CANVAS.SIZE - CANVAS.MARGIN;

interface FlowParams {
  lineCount: number;
  amplitude: number;
  frequency: number;
  phaseStep: number;
  strokeWidth: number;
}

function readParams(rng: Rng, density: number): FlowParams {
  return {
    // レア度が上がるほどわずかに密になるが、骨格が読めなくなるほどは動かさない（FR-110.1）
    lineCount: randInt(rng, 18 + density * 2, 24 + density * 2),
    amplitude: randRange(rng, 6, 14),
    frequency: randRange(rng, 1.5, 3),
    phaseStep: randRange(rng, 0.15, 0.45),
    strokeWidth: randRange(rng, 0.7, 1.1),
  };
}

/** 1 本の縦線。`phase` と `direction` で層ごとに位相をずらす。 */
function wave(x: number, params: FlowParams, phase: number, direction: 1 | -1): string {
  const points: Point[] = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    const t = i / (SAMPLES - 1);
    const y = TOP + t * (BOTTOM - TOP);
    // 端を細らせて、線束の上下が切り落とされたように見えないようにする
    const taper = Math.sin(Math.PI * t) ** 0.35;
    const offset =
      direction * params.amplitude * taper * Math.sin(2 * Math.PI * params.frequency * t + phase);
    points.push({ x: x + offset, y });
  }
  return polylinePath(points);
}

function band(params: FlowParams, direction: 1 | -1, phaseBias: number): string[] {
  const elements: string[] = [];
  const step = (RIGHT - LEFT) / (params.lineCount - 1);
  for (let i = 0; i < params.lineCount; i += 1) {
    const x = LEFT + i * step;
    const phase = i * params.phaseStep + phaseBias;
    elements.push(path(wave(x, params, phase, direction), { width: params.strokeWidth }));
  }
  return elements;
}

/** 第 3 層。流れを断ち切る水平の休符帯。 */
function caesura(rng: Rng, params: FlowParams): string[] {
  const count = randInt(rng, 3, 5);
  const elements: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const y = TOP + ((i + 1) / (count + 1)) * (BOTTOM - TOP) + randRange(rng, -6, 6);
    const inset = randRange(rng, 0, 24);
    elements.push(
      path(`M${LEFT + inset} ${y} L${RIGHT - inset} ${y}`, { width: params.strokeWidth }),
    );
  }
  return elements;
}

export function buildFlowLayers(rng: Rng, layerCount: number): string[][] {
  const params = readParams(rng, layerCount - 1);
  const layers: string[][] = [band(params, 1, 0)];

  if (layerCount >= 2) {
    // 逆位相の束。同じ骨格のまま、干渉縞のような重なりをつくる（FR-102.1）
    layers.push(band(params, -1, Math.PI / 2));
  }
  if (layerCount >= 3) {
    layers.push(caesura(rng, params));
  }
  return layers;
}
