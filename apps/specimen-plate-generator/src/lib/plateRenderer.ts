import { drawPaperTexture } from "./paperTexture.ts";
import { drawSmallCaps, drawTracked } from "./smallCaps.ts";
import { computeScale, scaleMarkLabel, type ScaleUnit } from "./scaleBar.ts";
import { PLATE_COLORS } from "./theme.ts";
import {
  PLATE_W,
  PLATE_H,
  OUTER_RULE,
  INNER_RULE,
  IMAGE_BOX,
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
  containFit,
} from "./layout.ts";

export interface PlateContent {
  plateNumber: string;
  caption: string;
  scaleValue: number;
  scaleUnit: ScaleUnit;
}

const SERIF = "EB Garamond";

/** 紙テクスチャ＋線画（ラスター部分）のみを描く。SVG書き出しで埋め込む<image>と共通の見た目。 */
export function drawRasterLayer(
  ctx: CanvasRenderingContext2D,
  engravingCanvas: HTMLCanvasElement | null,
  textureIntensity: number,
): void {
  drawPaperTexture(ctx, PLATE_W, PLATE_H, textureIntensity);

  if (engravingCanvas) {
    const fit = containFit(engravingCanvas.width, engravingCanvas.height, IMAGE_BOX);
    ctx.drawImage(engravingCanvas, fit.x, fit.y, fit.w, fit.h);

    // 実物の銅版画に見られる「プレートマーク」（版の縁の凹み）を細い罫で表現
    ctx.save();
    ctx.strokeStyle = PLATE_COLORS.inkSoft;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.strokeRect(fit.x, fit.y, fit.w, fit.h);
    ctx.restore();
  }
}

function drawScaleBar(ctx: CanvasRenderingContext2D, value: number, unit: ScaleUnit): void {
  const scale = computeScale(value, unit);
  const barX0 = SCALE_BAR_RIGHT_X - SCALE_BAR_WIDTH;

  ctx.save();
  ctx.strokeStyle = PLATE_COLORS.ink;
  ctx.fillStyle = PLATE_COLORS.ink;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(barX0, SCALE_BAR_TOP_Y, SCALE_BAR_WIDTH, SCALE_BAR_HEIGHT);

  // 交互の塗り分け（古典的な地図/図版のスケールバー意匠）
  for (let i = 0; i < scale.segments; i++) {
    if (i % 2 === 0) continue;
    const x0 = barX0 + (i / scale.segments) * SCALE_BAR_WIDTH;
    const x1 = barX0 + ((i + 1) / scale.segments) * SCALE_BAR_WIDTH;
    ctx.fillRect(x0, SCALE_BAR_TOP_Y, x1 - x0, SCALE_BAR_HEIGHT);
  }

  // 目盛り線
  for (const mark of scale.marks) {
    const x = barX0 + mark.frac * SCALE_BAR_WIDTH;
    ctx.beginPath();
    ctx.moveTo(x, SCALE_BAR_TOP_Y - 4);
    ctx.lineTo(x, SCALE_BAR_TOP_Y + SCALE_BAR_HEIGHT + 4);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ラベル：始点(0)・終点のみ表示（区間が多いと煩雑になるため）
  const zeroLabel = scaleMarkLabel(scale.marks[0], unit);
  const lastLabel = scaleMarkLabel(scale.marks[scale.marks.length - 1], unit);
  drawTracked(ctx, zeroLabel, barX0, SCALE_TICK_LABEL_BASELINE_Y, {
    fontFamily: SERIF,
    size: 18,
    letterSpacing: 0.4,
    color: PLATE_COLORS.ink,
    align: "left",
  });
  drawTracked(ctx, lastLabel, barX0 + SCALE_BAR_WIDTH, SCALE_TICK_LABEL_BASELINE_Y, {
    fontFamily: SERIF,
    size: 18,
    letterSpacing: 0.4,
    color: PLATE_COLORS.ink,
    align: "right",
  });
  ctx.restore();
}

/** 罫線・キャプション・プレート番号・スケールバーの「意匠」レイヤーを描く。 */
export function drawVectorOverlay(ctx: CanvasRenderingContext2D, content: PlateContent): void {
  ctx.save();
  ctx.strokeStyle = PLATE_COLORS.ink;

  ctx.lineWidth = OUTER_RULE.lineWidth;
  ctx.strokeRect(OUTER_RULE.x, OUTER_RULE.y, OUTER_RULE.w, OUTER_RULE.h);

  ctx.lineWidth = INNER_RULE.lineWidth;
  ctx.strokeRect(INNER_RULE.x, INNER_RULE.y, INNER_RULE.w, INNER_RULE.h);

  if (content.caption.trim()) {
    drawSmallCaps(ctx, content.caption.trim(), PLATE_W / 2, CAPTION_BASELINE_Y, {
      fontFamily: SERIF,
      size: CAPTION_FONT_SIZE,
      italic: true,
      capsScale: 0.76,
      letterSpacing: 1.2,
      color: PLATE_COLORS.ink,
      align: "center",
    });
  }

  ctx.strokeStyle = PLATE_COLORS.rust;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(DIVIDER_X0, DIVIDER_Y);
  ctx.lineTo(DIVIDER_X1, DIVIDER_Y);
  ctx.stroke();

  const plateLabel = `PLATE Nº ${content.plateNumber.trim() || "—"}.`;
  drawTracked(ctx, plateLabel, PLATE_NUMBER_X, PLATE_NUMBER_BASELINE_Y, {
    fontFamily: SERIF,
    size: PLATE_NUMBER_FONT_SIZE,
    letterSpacing: 2.2,
    color: PLATE_COLORS.ink,
    align: "left",
  });

  drawScaleBar(ctx, content.scaleValue, content.scaleUnit);

  ctx.restore();
}

export interface RenderInputs {
  engravingCanvas: HTMLCanvasElement | null;
  textureIntensity: number;
  content: PlateContent;
}

export function renderPlate(canvas: HTMLCanvasElement, inputs: RenderInputs): void {
  canvas.width = PLATE_W;
  canvas.height = PLATE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D コンテキストを取得できませんでした。");

  drawRasterLayer(ctx, inputs.engravingCanvas, inputs.textureIntensity);
  drawVectorOverlay(ctx, inputs.content);
}
