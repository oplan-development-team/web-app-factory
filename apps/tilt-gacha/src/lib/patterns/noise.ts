import { CANVAS } from "../constants.ts";
import { randInt, randRange } from "../rng.ts";
import type { Rng } from "../types.ts";
import { fieldOffset, makePoles, type Pole } from "./field.ts";
import { circle, dot, dottedDash, path, polylinePath, type Point } from "./svg.ts";

/**
 * NOISE / ゆらぎ — 散らばった点。
 *
 * 相性の傾きは「さかさま」。ひっくり返して撒いたときの、
 * 秩序が崩れた散らばりを骨格にしている。
 */

const LEFT = CANVAS.MARGIN;
const TOP = CANVAS.MARGIN;
const SPAN = CANVAS.SIZE - CANVAS.MARGIN * 2;

interface Cluster {
  x: number;
  y: number;
  radius: number;
}

interface NoiseParams {
  pointCount: number;
  pointRadius: number;
  clusters: Cluster[];
  poles: Pole[];
  /** 撒いた点をどれだけ場に流されるようにするか */
  drift: number;
}

function readParams(rng: Rng, density: number): NoiseParams {
  const pointCount = randInt(rng, 220, 320 + density * 40);
  const pointRadius = randRange(rng, 0.5, 1.1);
  const clusterCount = randInt(rng, 2, 4);
  const clusters: Cluster[] = [];
  for (let i = 0; i < clusterCount; i += 1) {
    clusters.push({
      x: LEFT + randRange(rng, 0.15, 0.85) * SPAN,
      y: TOP + randRange(rng, 0.15, 0.85) * SPAN,
      radius: randRange(rng, 20, 46),
    });
  }
  return {
    pointCount,
    pointRadius,
    clusters,
    poles: makePoles(rng, randInt(rng, 2, 3), { min: 0, max: CANVAS.SIZE }),
    drift: randRange(rng, 0.6, 1.1),
  };
}

/**
 * 撒いた点を場で流す基層。
 *
 * 一様乱数のままだと「砂嵐」で、どの標本も同じに見える。
 * 場に流すことで、粒が筋状に集まったり空白ができたりする濃淡が生まれる。
 */
function scatter(rng: Rng, params: NoiseParams): string[] {
  const elements: string[] = [];
  for (let i = 0; i < params.pointCount; i += 1) {
    const baseX = LEFT + rng() * SPAN;
    const baseY = TOP + rng() * SPAN;
    const drift = fieldOffset(params.poles, baseX, baseY);
    const x = baseX + drift.dx * params.drift;
    const y = baseY + drift.dy * params.drift;
    // 粒の大きさにも揺らぎを与える。均一だと機械的な網点に見えてしまう
    const r = params.pointRadius * randRange(rng, 0.6, 1.4);
    elements.push(dot(x, y, r));
  }
  return elements;
}

/**
 * 第 2 層。クラスタ周りに点を寄せて密度の偏りをつくる。
 * 一様乱数のままでは「ただのノイズ」で、見るべき場所ができない。
 */
function clustered(rng: Rng, params: NoiseParams): string[] {
  const perCluster = randInt(rng, 20, 32);
  const elements: string[] = [];
  for (const cluster of params.clusters) {
    for (let i = 0; i < perCluster; i += 1) {
      const angle = rng() * Math.PI * 2;
      // sqrt を取ると円内で面積的に一様になる（中心に寄りすぎない）
      const distance = Math.sqrt(rng()) * cluster.radius;
      const x = cluster.x + Math.cos(angle) * distance;
      const y = cluster.y + Math.sin(angle) * distance;
      if (x < LEFT || x > LEFT + SPAN || y < TOP || y > TOP + SPAN) continue;
      elements.push(dot(x, y, params.pointRadius * randRange(rng, 0.7, 1.3)));
    }
  }
  return elements;
}

/** 第 3 層。クラスタを囲う破線の輪と、場の流れをなぞる点描の筋。 */
function clusterRings(rng: Rng, params: NoiseParams): string[] {
  const elements: string[] = params.clusters.map((cluster) =>
    circle(cluster.x, cluster.y, cluster.radius, { width: 0.7, dash: "3 5" }),
  );

  // 場に沿って粒子を追跡した軌跡。散らばりの裏にある流れを可視化する
  const streakCount = randInt(rng, 3, 6);
  for (let i = 0; i < streakCount; i += 1) {
    const points: Point[] = [];
    let x = LEFT + rng() * SPAN;
    let y = TOP + rng() * SPAN;
    for (let step = 0; step < 34; step += 1) {
      points.push({ x, y });
      const flow = fieldOffset(params.poles, x, y);
      // 変位ベクトルを速度とみなして少しずつ進める
      x += flow.dx * 0.16;
      y += flow.dy * 0.16;
      if (x < LEFT || x > LEFT + SPAN || y < TOP || y > TOP + SPAN) break;
    }
    if (points.length < 4) continue;
    elements.push(path(polylinePath(points), { width: 1, dash: dottedDash(3.4) }));
  }
  return elements;
}

export function buildNoiseLayers(rng: Rng, layerCount: number): string[][] {
  const params = readParams(rng, layerCount - 1);
  const layers: string[][] = [scatter(rng, params)];

  if (layerCount >= 2) {
    layers.push(clustered(rng, params));
  }
  if (layerCount >= 3) {
    layers.push(clusterRings(rng, params));
  }
  return layers;
}
