import { CANVAS, LAYER_OPACITY, RARITY_LAYERS } from "../constants.ts";
import { mulberry32 } from "../rng.ts";
import type { Family, Pattern, Rarity, Rng } from "../types.ts";
import { buildFlowLayers } from "./flow.ts";
import { buildGridLayers } from "./grid.ts";
import { buildNoiseLayers } from "./noise.ts";
import { buildRadialLayers } from "./radial.ts";
import { layer } from "./svg.ts";

type LayerBuilder = (rng: Rng, layerCount: number) => string[][];

const BUILDERS: Readonly<Record<Family, LayerBuilder>> = {
  FLOW: buildFlowLayers,
  GRID: buildGridLayers,
  RADIAL: buildRadialLayers,
  NOISE: buildNoiseLayers,
};

/** `<svg>` タグに与える viewBox。呼び出し側が使う。 */
export const VIEW_BOX = `0 0 ${CANVAS.SIZE} ${CANVAS.SIZE}`;

/**
 * 模様を生成する（FR-100）。
 *
 * 同一の `(family, rarity, seed)` からは常に同一の出力が得られる。
 * 図鑑はシード整数しか保存しないので、この決定性が
 * 「マスの見た目が初回取得時から変わらない」ことの根拠になっている（FR-200.2）。
 */
export function buildPattern(family: Family, rarity: Rarity, seed: number): Pattern {
  const rng = mulberry32(seed);
  const layerCount = RARITY_LAYERS[rarity];
  const layers = BUILDERS[family](rng, layerCount);

  const markup = layers
    .map((elements, index) => layer(elements, LAYER_OPACITY[index] ?? 1))
    .join("");
  const elementCount = layers.reduce((sum, elements) => sum + elements.length, 0);

  return { markup, elementCount, layerCount: layers.length };
}

/** 単体で成立する SVG 文字列。図鑑・出現演出の双方がこれを埋め込む。 */
export function patternSvg(
  family: Family,
  rarity: Rarity,
  seed: number,
  options: { title?: string } = {},
): string {
  const { markup } = buildPattern(family, rarity, seed);
  const title = options.title === undefined ? "" : `<title>${options.title}</title>`;
  const role = options.title === undefined ? ' aria-hidden="true"' : ' role="img"';
  return (
    `<svg viewBox="${VIEW_BOX}" xmlns="http://www.w3.org/2000/svg" ` +
    `preserveAspectRatio="xMidYMid meet"${role}>${title}${markup}</svg>`
  );
}
