/**
 * 模様を組み立てるための最小限の SVG ヘルパ。
 *
 * 色は要素側に持たせず `currentColor` に任せる（FR-101.3）。
 * 出現演出と図鑑のサムネイルで同じ生成物を色だけ変えて使い回すため、
 * 生成経路を二重化しない。
 */

/** 座標は小数第 2 位に丸める。環境差とスナップショット差を防ぐ（FR-100.2）。 */
export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 丸めたうえで文字列化する。`-0` を `0` に正規化する。 */
export function num(value: number): string {
  const rounded = round(value);
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export interface Point {
  x: number;
  y: number;
}

/** 点列を滑らかな折れ線パスにする（波形用）。 */
export function polylinePath(points: readonly Point[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${num(p.x)} ${num(p.y)}`)
    .join(" ");
}

export interface StrokeAttrs {
  /** 線幅。呼び出し側が STROKE_WIDTH の範囲に収める責任を持つ（FR-101.2）。 */
  width: number;
  /** 破線パターン。省略時は実線。 */
  dash?: string;
  opacity?: number;
}

function strokeAttrString(stroke: StrokeAttrs): string {
  const parts = [
    `fill="none"`,
    `stroke="currentColor"`,
    `stroke-width="${num(stroke.width)}"`,
    `stroke-linecap="round"`,
  ];
  if (stroke.dash !== undefined) parts.push(`stroke-dasharray="${stroke.dash}"`);
  if (stroke.opacity !== undefined && stroke.opacity < 1) {
    parts.push(`stroke-opacity="${num(stroke.opacity)}"`);
  }
  return parts.join(" ");
}

export function path(d: string, stroke: StrokeAttrs): string {
  return `<path d="${d}" ${strokeAttrString(stroke)}/>`;
}

export function circle(cx: number, cy: number, r: number, stroke: StrokeAttrs): string {
  return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" ${strokeAttrString(stroke)}/>`;
}

export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: StrokeAttrs,
): string {
  return (
    `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" ` +
    `${strokeAttrString(stroke)}/>`
  );
}

/**
 * 塗りの点。GRID / NOISE の点描だけがこれを使う（FR-101.1 の例外）。
 * 点は面積が小さく、線で描くと潰れて見えないため塗りで描く。
 */
export function dot(cx: number, cy: number, r: number, opacity?: number): string {
  const op =
    opacity !== undefined && opacity < 1 ? ` fill-opacity="${num(opacity)}"` : "";
  return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="currentColor"${op}/>`;
}

/** 層をまとめる。層ごとの不透明度はここで一括して与える（FR-102.2）。 */
export function layer(children: readonly string[], opacity: number): string {
  if (children.length === 0) return "";
  const op = opacity < 1 ? ` opacity="${num(opacity)}"` : "";
  return `<g${op}>${children.join("")}</g>`;
}
