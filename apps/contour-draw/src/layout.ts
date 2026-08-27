export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PosterLayout {
  W: number;
  H: number;
  frame: Rect;
  drawArea: Rect;
  headerRect: Rect;
  footerRect: Rect;
  unit: number;
}

/**
 * Computes the fixed poster layout (frame, header/footer bands, drawable
 * contour area) purely from the canvas pixel size. Header/footer space is
 * always reserved regardless of element visibility toggles, so hiding a
 * chrome element never reflows or resizes the drawing grid.
 */
export function computeLayout(W: number, H: number): PosterLayout {
  const unit = Math.min(W, H);
  const frameMargin = unit * 0.05;
  const pad = unit * 0.02;
  const headerHeight = H * 0.13;
  const footerHeight = H * 0.09;

  const frame: Rect = {
    x: frameMargin,
    y: frameMargin,
    w: W - frameMargin * 2,
    h: H - frameMargin * 2,
  };

  const drawArea: Rect = {
    x: frame.x + pad,
    y: frame.y + pad + headerHeight,
    w: frame.w - pad * 2,
    h: frame.h - pad * 2 - headerHeight - footerHeight,
  };

  const headerRect: Rect = { x: frame.x + pad, y: frame.y + pad, w: frame.w - pad * 2, h: headerHeight };
  const footerRect: Rect = {
    x: frame.x + pad,
    y: frame.y + frame.h - pad - footerHeight,
    w: frame.w - pad * 2,
    h: footerHeight,
  };

  return { W, H, frame, drawArea, headerRect, footerRect, unit };
}

/** Ideal internal field grid resolution for a given drawable area, kept in the 100-200 range. */
export function computeGridSize(drawArea: Rect): { nx: number; ny: number } {
  const nx = 160;
  const ny = Math.max(80, Math.min(200, Math.round(nx * (drawArea.h / drawArea.w))));
  return { nx, ny };
}
