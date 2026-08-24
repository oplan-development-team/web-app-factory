import { drawRasterLayer, type PlateContent } from "./plateRenderer.ts";
import { computeScale, scaleMarkLabel } from "./scaleBar.ts";
import { PLATE_COLORS } from "./theme.ts";
import {
  PLATE_W,
  PLATE_H,
  OUTER_RULE,
  INNER_RULE,
  CAPTION_BASELINE_Y,
  CAPTION_FONT_SIZE,
  DIVIDER_Y,
  DIVIDER_X0,
  DIVIDER_X1,
  PLATE_NUMBER_X,
  PLATE_NUMBER_BASELINE_Y,
  PLATE_NUMBER_FONT_SIZE,
  SCALE_BAR_RIGHT_X,
  SCALE_BAR_WIDTH,
  SCALE_BAR_TOP_Y,
  SCALE_BAR_HEIGHT,
  SCALE_TICK_LABEL_BASELINE_Y,
} from "./layout.ts";

const SERIF = "EB Garamond, 'Times New Roman', serif";

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 罫線・文字・スケールバーは真のベクター要素として、線画(+紙テクスチャ)は
 * ラスター画像として <image> に埋め込んだ SVG 文字列を生成する。
 * ビットマップから真のベクターパスへのトレースは行わない（スコープ外）。
 */
export function buildPlateSVG(engravingCanvas: HTMLCanvasElement | null, textureIntensity: number, content: PlateContent): string {
  const rasterCanvas = document.createElement("canvas");
  rasterCanvas.width = PLATE_W;
  rasterCanvas.height = PLATE_H;
  const rasterCtx = rasterCanvas.getContext("2d");
  if (!rasterCtx) throw new Error("Canvas 2D コンテキストを取得できませんでした。");
  drawRasterLayer(rasterCtx, engravingCanvas, textureIntensity);
  const rasterDataUrl = rasterCanvas.toDataURL("image/png");

  const scale = computeScale(content.scaleValue, content.scaleUnit);
  const barX0 = SCALE_BAR_RIGHT_X - SCALE_BAR_WIDTH;

  const filledSegments: string[] = [];
  for (let i = 0; i < scale.segments; i++) {
    if (i % 2 === 0) continue;
    const x0 = barX0 + (i / scale.segments) * SCALE_BAR_WIDTH;
    const x1 = barX0 + ((i + 1) / scale.segments) * SCALE_BAR_WIDTH;
    filledSegments.push(
      `<rect x="${x0.toFixed(2)}" y="${SCALE_BAR_TOP_Y}" width="${(x1 - x0).toFixed(2)}" height="${SCALE_BAR_HEIGHT}" fill="${PLATE_COLORS.ink}" />`,
    );
  }

  const tickLines = scale.marks
    .map((mark) => {
      const x = barX0 + mark.frac * SCALE_BAR_WIDTH;
      return `<line x1="${x.toFixed(2)}" y1="${SCALE_BAR_TOP_Y - 4}" x2="${x.toFixed(2)}" y2="${SCALE_BAR_TOP_Y + SCALE_BAR_HEIGHT + 4}" stroke="${PLATE_COLORS.ink}" stroke-width="1" />`;
    })
    .join("\n    ");

  const zeroLabel = escapeXml(scaleMarkLabel(scale.marks[0], scale.unit));
  const lastLabel = escapeXml(scaleMarkLabel(scale.marks[scale.marks.length - 1], scale.unit));
  const captionText = escapeXml(content.caption.trim());
  const plateLabel = escapeXml(`PLATE Nº ${content.plateNumber.trim() || "—"}.`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${PLATE_W}" height="${PLATE_H}" viewBox="0 0 ${PLATE_W} ${PLATE_H}">
  <title>Specimen Plate</title>
  <image x="0" y="0" width="${PLATE_W}" height="${PLATE_H}" href="${rasterDataUrl}" />

  <rect x="${OUTER_RULE.x}" y="${OUTER_RULE.y}" width="${OUTER_RULE.w}" height="${OUTER_RULE.h}"
        fill="none" stroke="${PLATE_COLORS.ink}" stroke-width="${OUTER_RULE.lineWidth}" />
  <rect x="${INNER_RULE.x}" y="${INNER_RULE.y}" width="${INNER_RULE.w}" height="${INNER_RULE.h}"
        fill="none" stroke="${PLATE_COLORS.ink}" stroke-width="${INNER_RULE.lineWidth}" />

  ${captionText ? `<text x="${PLATE_W / 2}" y="${CAPTION_BASELINE_Y}" text-anchor="middle"
        font-family="${SERIF}" font-size="${CAPTION_FONT_SIZE}" font-style="italic"
        font-variant="small-caps" letter-spacing="1.2" fill="${PLATE_COLORS.ink}">${captionText}</text>` : ""}

  <line x1="${DIVIDER_X0}" y1="${DIVIDER_Y}" x2="${DIVIDER_X1}" y2="${DIVIDER_Y}" stroke="${PLATE_COLORS.rust}" stroke-width="1" />

  <text x="${PLATE_NUMBER_X}" y="${PLATE_NUMBER_BASELINE_Y}" font-family="${SERIF}" font-size="${PLATE_NUMBER_FONT_SIZE}"
        letter-spacing="2.2" fill="${PLATE_COLORS.ink}">${plateLabel}</text>

  <g>
    <rect x="${barX0}" y="${SCALE_BAR_TOP_Y}" width="${SCALE_BAR_WIDTH}" height="${SCALE_BAR_HEIGHT}"
          fill="none" stroke="${PLATE_COLORS.ink}" stroke-width="1.2" />
    ${filledSegments.join("\n    ")}
    ${tickLines}
    <text x="${barX0}" y="${SCALE_TICK_LABEL_BASELINE_Y}" font-family="${SERIF}" font-size="18"
          letter-spacing="0.4" fill="${PLATE_COLORS.ink}">${zeroLabel}</text>
    <text x="${barX0 + SCALE_BAR_WIDTH}" y="${SCALE_TICK_LABEL_BASELINE_Y}" text-anchor="end"
          font-family="${SERIF}" font-size="18" letter-spacing="0.4" fill="${PLATE_COLORS.ink}">${lastLabel}</text>
  </g>
</svg>
`;
}
