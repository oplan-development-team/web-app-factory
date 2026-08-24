/**
 * シード文字列から決定的に「家紋風」の幾何学紋様を組み立てる。
 *
 * 方針:
 *  1. seedForVariant() でシード+バリアント番号を32bitハッシュ化し、mulberry32 に渡す
 *  2. 対称モード（線対称 or 点対称2/4/6分割）を確定的に選ぶ
 *  3. 「複製の基本単位」（線対称なら右半分、点対称ならn分割の1ウェッジ）の中に
 *     中心モチーフ・外周リングモチーフの図形を配置する
 *  4. 単位図形をSVG側のtransform（鏡像 or 回転）で複製することで、
 *     手計算せずに厳密な対称性を担保する
 */

import { type Rng, mulberry32, pick, randFloat, randInt, seedForVariant } from "./hash";
import { type ShapeKind, type ShapeSpec, SHAPE_LABEL, polarToXY, renderShape } from "./shapes";

export type Symmetry = { type: "mirror" } | { type: "point"; n: 2 | 4 | 6 };

export interface Palette {
  id: "sumi" | "shu" | "kon";
  label: string;
  ink: string;
  paper: string;
}

export const PALETTES: Palette[] = [
  { id: "sumi", label: "墨 × 白", ink: "#201d1a", paper: "#ffffff" },
  { id: "shu", label: "朱 × 白", ink: "#c33a2e", paper: "#ffffff" },
  { id: "kon", label: "白 × 紺", ink: "#f4efe2", paper: "#1b2a4a" },
];

const CX = 200;
const CY = 200;
const SHAPE_KINDS: ShapeKind[] = ["petal", "diamond", "circle", "cross"];

export interface KamonStructure {
  seedText: string;
  variantIndex: number;
  symmetry: Symmetry;
  symmetryLabel: string;
  centerShape: ShapeKind;
  ringShape: ShapeKind;
  unitElements: ShapeSpec[];
  centerCoreRadius: number;
  frameRadii: number[];
}

function symmetryLabelOf(sym: Symmetry): string {
  if (sym.type === "mirror") return "線対称・左右";
  return `点対称・${sym.n}分割`;
}

/** シード文字列とバリアント番号から、色に依存しない紋様の構造を組み立てる */
export function buildKamonStructure(seedText: string, variantIndex: number): KamonStructure {
  const rng: Rng = mulberry32(seedForVariant(seedText, variantIndex));

  const symmetryOptions: Symmetry[] = [
    { type: "mirror" },
    { type: "point", n: 2 },
    { type: "point", n: 4 },
    { type: "point", n: 6 },
  ];
  const symmetry = pick(rng, symmetryOptions);
  const unitSpan = symmetry.type === "mirror" ? 180 : 360 / symmetry.n;
  const unitStart = symmetry.type === "mirror" ? 0 : -unitSpan / 2;

  const centerShape = pick(rng, SHAPE_KINDS);
  const ringShape = pick(rng, SHAPE_KINDS);
  const centerFilled = rng() < 0.6;
  const ringFilled = rng() < 0.4;

  const unitElements: ShapeSpec[] = [];

  // 中心モチーフ: 単位の中央（真上方向）に1つだけ置き、複製で花状・放射状に見せる
  {
    const angle = unitStart + unitSpan / 2;
    const radius = randFloat(rng, 26, 54);
    const { x, y } = polarToXY(CX, CY, angle, radius);
    unitElements.push({
      kind: centerShape,
      x,
      y,
      rot: angle,
      size: randFloat(rng, 20, 34),
      aspect: randFloat(rng, 0.5, 0.95),
      filled: centerFilled,
    });
  }

  // 外周リングモチーフ: 1〜2層、各層に複数個を単位内で分散配置
  const ringLayerCount = randInt(rng, 1, 2);
  for (let layer = 0; layer < ringLayerCount; layer++) {
    const baseRadius = 96 + layer * 42 + randFloat(rng, -6, 6);
    const countPerUnit = randInt(rng, 1, 3);
    const localRotOffset = pick(rng, [0, 0, 45, 90]); // 大半は放射方向、たまに向きを変える
    const size = randFloat(rng, 12, 22) - layer * 1.5;
    const aspect = randFloat(rng, 0.45, 0.9);

    for (let i = 0; i < countPerUnit; i++) {
      const slice = unitSpan / countPerUnit;
      const jitter = slice * 0.12;
      const angle = unitStart + slice * (i + 0.5) + randFloat(rng, -jitter, jitter);
      const radius = baseRadius + randFloat(rng, -4, 4);
      const { x, y } = polarToXY(CX, CY, angle, radius);
      unitElements.push({
        kind: ringShape,
        x,
        y,
        rot: angle + localRotOffset,
        size: Math.max(6, size),
        aspect,
        filled: ringFilled,
      });
    }
  }

  const centerCoreRadius = randFloat(rng, 3, 8);

  const frameRadii: number[] = [];
  if (rng() < 0.75) frameRadii.push(188);
  if (rng() < 0.5) frameRadii.push(170);

  return {
    seedText,
    variantIndex,
    symmetry,
    symmetryLabel: symmetryLabelOf(symmetry),
    centerShape,
    ringShape,
    unitElements,
    centerCoreRadius,
    frameRadii,
  };
}

/** 単位図形を対称モードに応じて複製し、完全なSVGマークアップを組み立てる */
export function renderKamonSVG(structure: KamonStructure, palette: Palette): string {
  const { symmetry, unitElements, centerCoreRadius, frameRadii } = structure;
  const { ink, paper } = palette;

  const unitMarkup = unitElements.map((el) => renderShape(el, ink)).join("");

  let groupsMarkup: string;
  if (symmetry.type === "mirror") {
    groupsMarkup =
      `<g>${unitMarkup}</g>` + `<g transform="matrix(-1 0 0 1 ${CX * 2} 0)">${unitMarkup}</g>`;
  } else {
    const n = symmetry.n;
    const groups: string[] = [];
    for (let k = 0; k < n; k++) {
      const angle = (360 / n) * k;
      groups.push(`<g transform="rotate(${angle.toFixed(2)} ${CX} ${CY})">${unitMarkup}</g>`);
    }
    groupsMarkup = groups.join("");
  }

  const frameMarkup = frameRadii
    .map(
      (r, i) =>
        `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="${ink}" stroke-width="${i === 0 ? 2.4 : 1.2}" opacity="${i === 0 ? 1 : 0.55}"/>`,
    )
    .join("");

  const backdrop = `<circle cx="${CX}" cy="${CY}" r="192" fill="${paper}"/>`;
  const coreDot = `<circle cx="${CX}" cy="${CY}" r="${centerCoreRadius.toFixed(2)}" fill="${ink}"/>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="生成された家紋">`,
    backdrop,
    frameMarkup,
    groupsMarkup,
    coreDot,
    `</svg>`,
  ].join("");
}

/** 家紋の口上（キャプション）用の短い説明を組み立てる */
export function describeStructure(structure: KamonStructure): string {
  const centerLabel = SHAPE_LABEL[structure.centerShape];
  const ringLabel = SHAPE_LABEL[structure.ringShape];
  return `中心：${centerLabel}　外周：${ringLabel}　${structure.symmetryLabel}`;
}

/** シード未入力時に表示する、幽かな輪郭だけのプレースホルダー図案 */
export function placeholderSVG(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="紋はまだありません">`,
    `<circle cx="200" cy="200" r="188" fill="none" stroke="#b9ac8f" stroke-width="1.4" stroke-dasharray="2 10" stroke-linecap="round"/>`,
    `<circle cx="200" cy="200" r="4" fill="#c9bd9e"/>`,
    `</svg>`,
  ].join("");
}

/** ダウンロード用ファイル名をシード文字列から作る（安全な文字のみ残す） */
export function filenameFromSeed(seedText: string, variantIndex: number): string {
  const base = seedText.trim() || "無銘";
  const safe = base
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 24);
  return `kamon-${safe || "無銘"}-${variantIndex + 1}.svg`;
}
