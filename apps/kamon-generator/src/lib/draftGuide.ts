/**
 * 割り出し線（SPEC 3.6 の empty / drafting 状態）。
 *
 * 家紋は同心円と放射線のガイド上で作図される。生成中の表示にこの作図線を使うと、
 * 汎用のスピナーやスケルトン矩形と違って「いま紋を割り出している」という
 * 意味がそのまま画面に出る。
 */

import { CX, CY, R_FIELD, VIEWBOX } from "./constants";
import { fmt, polar } from "./geometry";

const GUIDE_RADII = [176, 130, 84, 38] as const;
const GUIDE_SPOKES = 8;

export interface DraftGuideOptions {
  /** ガイド線の色 */
  stroke: string;
  /** 中央に添える文言（省略時は描かない） */
  label?: string;
}

/**
 * 同心円 + 放射線だけの作図面を返す。
 * 生成中と空状態で同じ図を使い、状態の差は不透明度と動きだけで表す。
 */
export function draftGuideSVG(options: DraftGuideOptions): string {
  const { stroke } = options;

  const circles = GUIDE_RADII.map(
    (r) =>
      `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="${stroke}"` +
      ` stroke-width="1.2" stroke-dasharray="3 9" stroke-linecap="round"/>`,
  ).join("");

  const spokes = Array.from({ length: GUIDE_SPOKES }, (_, i) => {
    const angle = (180 / GUIDE_SPOKES) * i;
    const a = polar(angle, R_FIELD, { x: CX, y: CY });
    const b = polar(angle + 180, R_FIELD, { x: CX, y: CY });
    return (
      `<line x1="${fmt(a.x)}" y1="${fmt(a.y)}" x2="${fmt(b.x)}" y2="${fmt(b.y)}"` +
      ` stroke="${stroke}" stroke-width="1" stroke-dasharray="2 12" stroke-linecap="round"/>`
    );
  }).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}"`,
    ` width="${VIEWBOX}" height="${VIEWBOX}" role="presentation" aria-hidden="true">`,
    circles,
    spokes,
    `<circle cx="${CX}" cy="${CY}" r="3.5" fill="${stroke}"/>`,
    `</svg>`,
  ].join("");
}
