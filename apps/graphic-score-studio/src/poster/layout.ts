/**
 * All geometry for the poster sheet is computed here so that the renderer,
 * the pointer/drawing input, and the SVG/PNG exporters agree on exactly the
 * same rectangle for the ink (score) area.
 *
 * The sheet uses an A-series ratio (1 : sqrt(2)), like a real print plate.
 */
export const POSTER_W = 1500;
export const POSTER_H = 2122;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  posterW: number;
  posterH: number;
  cropMarkLen: number;
  cropMarkGap: number;
  border: Rect;
  content: Rect;
  header: Rect;
  titleBox: Rect;
  catalogBox: Rect;
  instructionY: number;
  ink: Rect;
  bandLabelX: number;
  metaY: number;
  legendHeaderY: number;
  legend: Rect;
  legendRowH: number;
  footerY: number;
}

export function computeLayout(): Layout {
  const marginOuter = 46;
  const border: Rect = {
    x: marginOuter,
    y: marginOuter,
    w: POSTER_W - marginOuter * 2,
    h: POSTER_H - marginOuter * 2,
  };
  const contentPad = 40;
  const content: Rect = {
    x: border.x + contentPad,
    y: border.y + contentPad,
    w: border.w - contentPad * 2,
    h: border.h - contentPad * 2,
  };

  const header: Rect = { x: content.x, y: content.y, w: content.w, h: 214 };
  const catalogW = 300;
  const titleBox: Rect = {
    x: header.x,
    y: header.y + 34,
    w: header.w - catalogW - 32,
    h: header.h - 34,
  };
  const catalogBox: Rect = {
    x: header.x + header.w - catalogW,
    y: header.y + 34,
    w: catalogW,
    h: header.h - 34,
  };

  const instructionY = header.y + header.h + 46;

  const bandLabelX = content.x;
  const inkX = content.x + 84;
  const inkY = instructionY + 34;
  const inkH = 980;
  const ink: Rect = { x: inkX, y: inkY, w: content.x + content.w - inkX, h: inkH };

  const metaY = ink.y + ink.h + 46;

  const legendHeaderY = metaY + 64;
  const legendRowH = 66;
  const legend: Rect = {
    x: content.x,
    y: legendHeaderY + 34,
    w: content.w,
    h: legendRowH * 3,
  };

  const footerY = legend.y + legend.h + 56;

  return {
    posterW: POSTER_W,
    posterH: POSTER_H,
    cropMarkLen: 20,
    cropMarkGap: 10,
    border,
    content,
    header,
    titleBox,
    catalogBox,
    instructionY,
    ink,
    bandLabelX,
    metaY,
    legendHeaderY,
    legend,
    legendRowH,
    footerY,
  };
}
