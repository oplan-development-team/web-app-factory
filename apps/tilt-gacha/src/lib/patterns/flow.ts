import { CANVAS } from "../constants.ts";
import { randInt, randRange } from "../rng.ts";
import type { Rng } from "../types.ts";
import { fieldOffset, makePoles, type Pole } from "./field.ts";
import { dottedDash, path, polylinePath, type Point } from "./svg.ts";

/**
 * FLOW / ながれ — 波打つ縦線の束。
 *
 * 相性の傾きは「たて」。端末をまっすぐ立てて構えたときの、
 * 上から下へ流れ落ちる感じを骨格にしている。
 *
 * 単なる正弦波の並びだと質感が単調なので、
 * 極による場（field.ts）で線同士が引き合う・押し合うような歪みを与え、
 * 上位レア度では点描の層を混ぜて質感を変える。
 */

const SAMPLES = 56;

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
  poles: Pole[];
  /** 場の効き具合。0 で従来どおりの素直な波 */
  fieldWeight: number;
}

function readParams(rng: Rng, density: number): FlowParams {
  return {
    // レア度が上がるほどわずかに密になるが、骨格が読めなくなるほどは動かさない（FR-110.1）
    lineCount: randInt(rng, 18 + density * 2, 24 + density * 2),
    amplitude: randRange(rng, 6, 13),
    frequency: randRange(rng, 1.5, 3),
    phaseStep: randRange(rng, 0.15, 0.45),
    strokeWidth: randRange(rng, 0.7, 1.1),
    // 極は 2〜3 個。多いと歪みが打ち消し合って、ただのゆらぎになる
    poles: makePoles(rng, randInt(rng, 2, 3), { min: 0, max: CANVAS.SIZE }),
    fieldWeight: randRange(rng, 0.5, 1),
  };
}

/** 1 本の縦線。`phase` と `direction` で層ごとに位相をずらす。 */
function wave(x: number, params: FlowParams, phase: number, direction: 1 | -1): string {
  const points: Point[] = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    const t = i / (SAMPLES - 1);
    const baseY = TOP + t * (BOTTOM - TOP);
    // 端を細らせて、線束の上下が切り落とされたように見えないようにする
    const taper = Math.sin(Math.PI * t) ** 0.35;
    const swing =
      direction * params.amplitude * taper * Math.sin(2 * Math.PI * params.frequency * t + phase);

    // 場による歪み。線同士が近づく／離れる不均一さがここで生まれる
    const baseX = x + swing;
    const offset = fieldOffset(params.poles, baseX, baseY);
    points.push({
      x: baseX + offset.dx * params.fieldWeight * taper,
      y: baseY + offset.dy * params.fieldWeight * taper * 0.35,
    });
  }
  return polylinePath(points);
}

interface BandOptions {
  direction: 1 | -1;
  phaseBias: number;
  /** 点を連ねた質感で描く */
  dotted?: boolean;
}

function band(rng: Rng, params: FlowParams, options: BandOptions): string[] {
  const elements: string[] = [];
  const step = (RIGHT - LEFT) / (params.lineCount - 1);
  const dash = options.dotted === true ? dottedDash(randRange(rng, 3.2, 5.2)) : undefined;
  // 点描は面積が小さいので、実線よりわずかに太くしないと沈む（上限 1.4 を超えない）
  const width = options.dotted === true ? Math.min(1.4, params.strokeWidth + 0.25) : params.strokeWidth;

  for (let i = 0; i < params.lineCount; i += 1) {
    const x = LEFT + i * step;
    const phase = i * params.phaseStep + options.phaseBias;
    elements.push(
      path(wave(x, params, phase, options.direction), {
        width,
        ...(dash === undefined ? {} : { dash }),
      }),
    );
  }
  return elements;
}

/** 第 3 層。流れを断ち切る水平の休符帯。場に沿ってわずかに撓む。 */
function caesura(rng: Rng, params: FlowParams): string[] {
  const count = randInt(rng, 3, 5);
  const elements: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const y = TOP + ((i + 1) / (count + 1)) * (BOTTOM - TOP) + randRange(rng, -6, 6);
    const inset = randRange(rng, 0, 24);
    const points: Point[] = [];
    const steps = 24;
    const from = LEFT + inset;
    const to = RIGHT - inset;
    for (let s = 0; s <= steps; s += 1) {
      const x = from + (s / steps) * (to - from);
      const offset = fieldOffset(params.poles, x, y);
      points.push({ x, y: y + offset.dy * 0.45 });
    }
    elements.push(path(polylinePath(points), { width: params.strokeWidth }));
  }
  return elements;
}

export function buildFlowLayers(rng: Rng, layerCount: number): string[][] {
  const params = readParams(rng, layerCount - 1);
  const layers: string[][] = [band(rng, params, { direction: 1, phaseBias: 0 })];

  if (layerCount >= 2) {
    // 逆位相の束を点描で重ねる。同じ骨格のまま質感の違う層が干渉する（FR-102.1）
    layers.push(band(rng, params, { direction: -1, phaseBias: Math.PI / 2, dotted: true }));
  }
  if (layerCount >= 3) {
    layers.push(caesura(rng, params));
  }
  return layers;
}
