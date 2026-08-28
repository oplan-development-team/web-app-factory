/**
 * プレート（図版）のジオメトリ定数。
 * Canvasプレビュー／PNG書き出しとSVG書き出しの両方が、この座標系を共有する
 * ことで、罫線・文字・スケールバー・線画の位置がぴったり一致する。
 */

export const PLATE_W = 1200;
export const PLATE_H = 1560;

export const OUTER_RULE = { x: 56, y: 56, w: 1088, h: 1448, lineWidth: 3 };
export const INNER_RULE = { x: 74, y: 74, w: 1052, h: 1412, lineWidth: 1.4 };

/** 標本画像（エングレービング）を収める矩形。中身は contain-fit で中央配置。 */
export const IMAGE_BOX = { x: 120, y: 120, w: 960, h: 1120 };

export const CAPTION_BASELINE_Y = 1292;
export const CAPTION_FONT_SIZE = 34;

export const DIVIDER_Y = 1324;
export const DIVIDER_X0 = 120;
export const DIVIDER_X1 = 1080;

export const PLATE_NUMBER_X = 120;
export const PLATE_NUMBER_BASELINE_Y = 1400;
export const PLATE_NUMBER_FONT_SIZE = 21;

export const SCALE_BAR_RIGHT_X = 1080;
export const SCALE_BAR_WIDTH = 320;
export const SCALE_BAR_TOP_Y = 1365;
export const SCALE_BAR_HEIGHT = 12;
export const SCALE_TICK_LABEL_BASELINE_Y = SCALE_BAR_TOP_Y + SCALE_BAR_HEIGHT + 22;

/** 画像の contain-fit（アスペクト比維持で最大化）配置を計算する。 */
export function containFit(
  srcW: number,
  srcH: number,
  box: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  const scale = Math.min(box.w / srcW, box.h / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return {
    x: box.x + (box.w - w) / 2,
    y: box.y + (box.h - h) / 2,
    w,
    h,
  };
}
