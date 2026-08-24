/**
 * 紋の作図に関わる寸法の単一情報源（SPEC 3.2）。
 *
 * すべて viewBox "0 0 400 400" の座標単位。直径 = 400 を基準に、
 * 実在の家紋の作図実務（直径 1.5cm に対し主要線幅 0.25〜0.5mm =
 * 直径比 1.7〜3.3%、交点 8 点以下）から換算した値を用いる。
 */

/** SVG の一辺（= 紋の外接直径の基準） */
export const VIEWBOX = 400;

/** 紋の中心 */
export const CX = VIEWBOX / 2;
export const CY = VIEWBOX / 2;

/** 何を描いてもよい最大半径 */
export const R_FIELD = 190;

/**
 * 線そのものが意匠である場合に許される最小線幅（FR-101.3）。
 * 400 単位中 9 = 直径比 2.25%。実務目安 1.7〜3.3% の下限側に余裕を取った値。
 */
export const MIN_STROKE = 9;

/**
 * 白抜き（塗り面に開ける穴）の最小幅（FR-101.4）。
 * 400 単位中 6 = 直径比 1.5%。
 */
export const MIN_NEGATIVE = 6;

/** 1 つの紋に許される描画プリミティブ数の上限（FR-102.1） */
export const MAX_PRIMITIVES = 8;

/** 放射構成で、単位の基部が中心から離れてよい最大距離（FR-103.2） */
export const SEAT_MAX_OFFSET = 22;

/** 主モチーフの外接半径 / R_INNER の許容範囲（FR-103.1） */
export const FILL_RATIO_MIN = 0.85;
export const FILL_RATIO_MAX = 0.95;

/** 放射 n 分割時、単位の最大半幅角がスライス角に占めるべき下限比（FR-103.3） */
export const HALF_WIDTH_ANGLE_MIN_RATIO = 0.3;

/** 座標の出力桁数（SVG 文字列の安定性のため固定する） */
export const COORD_PRECISION = 2;
