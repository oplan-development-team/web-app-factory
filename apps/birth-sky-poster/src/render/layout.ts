/** Shared layout constants for the poster SVG (all values in SVG user units). */
export const POSTER_W = 1000;
export const POSTER_H = 1400;
export const MARGIN = 64;

export const CHART_CX = POSTER_W / 2;
export const CHART_CY = 596;
/** Radius of the horizon circle (alt = 0). */
export const CHART_R = 322;

export const RING_INNER = CHART_R + 16;
export const RING_OUTER = CHART_R + 30;
export const RING_MAJOR_TICK = CHART_R + 40;
export const RING_LABEL_R = CHART_R + 58;

export const LEGEND_TOP = 986;
export const LEGEND_COLS = 4;
export const LEGEND_ROWS = 2;
export const LEGEND_W = POSTER_W - MARGIN * 2;
export const LEGEND_COL_W = LEGEND_W / LEGEND_COLS;
export const LEGEND_ROW_H = 96;

export const FOOTER_TOP = LEGEND_TOP + LEGEND_ROWS * LEGEND_ROW_H + 34;

export interface LegendCellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function legendCell(row: number, col: number): LegendCellRect {
  return {
    x: MARGIN + col * LEGEND_COL_W,
    y: LEGEND_TOP + row * LEGEND_ROW_H,
    w: LEGEND_COL_W,
    h: LEGEND_ROW_H,
  };
}
