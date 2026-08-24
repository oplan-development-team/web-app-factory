/**
 * 構造 + 配色 → SVG 文字列（SPEC 3.3）。
 *
 * 対称性は座標計算ではなく `transform` による複製で担保する（FR-104.2）。
 * 単位のマークアップは 1 度だけ組み立て、変換違いで並べる。
 */

import { CX, CY, R_FIELD, VIEWBOX } from "./constants";
import { enclosureOf, type KamonStructure } from "./kamon";
import {
  type Segment,
  circleSegments,
  fmt,
  regularPolygon,
  polygonSegments,
  segmentsToPath,
} from "./geometry";
import type { Placement } from "./composition";
import type { Palette } from "./palette";
import type { StrokeShape } from "./motifs/types";

/** SVG のテキストノード・属性値へ入れる文字列を無害化する（NFR-007） */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fillPath(segments: readonly Segment[], ink: string): string {
  return `<path d="${segmentsToPath(segments)}" fill="${ink}" fill-rule="evenodd"/>`;
}

function strokePath(shape: StrokeShape, ink: string): string {
  return (
    `<path d="${segmentsToPath(shape.segments)}" fill="none" stroke="${ink}"` +
    ` stroke-width="${fmt(shape.width)}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

function unitMarkup(structure: KamonStructure, ink: string): string {
  const { unit } = structure;
  return [
    ...unit.fills.map((f) => fillPath(f, ink)),
    ...unit.strokes.map((s) => strokePath(s, ink)),
  ].join("");
}

function placementTransform(placement: Placement): string {
  const parts = [`translate(${CX} ${CY})`];
  if (placement.mirrored) parts.push("scale(-1 1)");
  if (placement.pivotDrop !== 0) parts.push(`translate(0 ${fmt(placement.pivotDrop)})`);
  if (placement.rotate !== 0) parts.push(`rotate(${fmt(placement.rotate)})`);
  if (placement.offset !== 0) parts.push(`translate(0 ${fmt(-placement.offset)})`);
  return parts.join(" ");
}

function seatMarkup(structure: KamonStructure, ink: string): string {
  const { seat } = structure;
  const origin = { x: CX, y: CY };

  switch (seat.kind) {
    case "none":
      return "";
    case "dot":
      return fillPath(circleSegments(origin, seat.radius), ink);
    case "ring":
      return (
        `<circle cx="${CX}" cy="${CY}" r="${fmt(seat.radius)}" fill="none"` +
        ` stroke="${ink}" stroke-width="${fmt(seat.width)}"/>`
      );
    case "hanabishi": {
      const outer = polygonSegments(regularPolygon(4, seat.radius, 0, origin));
      const inner = polygonSegments(regularPolygon(4, seat.radius * 0.42, 0, origin));
      return fillPath([...outer, ...inner], ink);
    }
  }
}

export interface RenderOptions {
  /** 下地の円を描くか。図版帖のサムネイルなど、下地を CSS 側で持つ場合は false */
  backdrop?: boolean;
  /** aria-label に使う名称。既定は構造の紋名 */
  label?: string;
}

export function renderKamonSVG(
  structure: KamonStructure,
  palette: Palette,
  options: RenderOptions = {},
): string {
  const { ink, paper } = palette;
  const enclosure = enclosureOf(structure);
  const unit = unitMarkup(structure, ink);

  const groups = structure.composition.placements
    .map(
      (placement) => `<g transform="${placementTransform(placement)}">${unit}</g>`,
    )
    .join("");

  const rings = enclosure.rings
    .map((ring) =>
      strokePath(
        { segments: ring.segments.map(shiftToCenter), width: ring.width },
        ink,
      ),
    )
    .join("");

  const backdrop =
    options.backdrop === false
      ? ""
      : `<circle cx="${CX}" cy="${CY}" r="${R_FIELD + 2}" fill="${paper}"/>`;

  const label = escapeXml(options.label ?? structure.name);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}"`,
    ` width="${VIEWBOX}" height="${VIEWBOX}" role="img" aria-label="${label}">`,
    backdrop,
    rings,
    groups,
    seatMarkup(structure, ink),
    `</svg>`,
  ].join("");
}

/** 外郭は原点中心で定義されているため、描画時に紋の中心へ寄せる */
function shiftToCenter(seg: Segment): Segment {
  const move = (p: { x: number; y: number }) => ({ x: p.x + CX, y: p.y + CY });
  switch (seg.t) {
    case "M":
      return { t: "M", p: move(seg.p) };
    case "L":
      return { t: "L", p: move(seg.p) };
    case "Q":
      return { t: "Q", c: move(seg.c), p: move(seg.p) };
    case "C":
      return { t: "C", c1: move(seg.c1), c2: move(seg.c2), p: move(seg.p) };
    case "Z":
      return seg;
  }
}

/** 書き出し用に XML 宣言を付けた自己完結ファイルにする（FR-400.1） */
export function toStandaloneSVG(markup: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
}
