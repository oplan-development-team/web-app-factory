import type { CoverState, Palette } from './types.ts';
import { getPalette } from './palettes.ts';
import { buildDuotoneCanvas } from './duotone.ts';
import { diagonalBandPath, splitPath, splitBoundaryXAt, circlePath } from './shapes.ts';
import { drawTracked, drawVerticalTracked, fitTrackedToWidth, trackedWidth, truncateToWidth } from './textMetrics.ts';

export const CANVAS_SIZE = 1200;
const MARGIN = 72;

const FONT_HEAVY = 'Anton';
const FONT_TALL = 'Bebas Neue';
const FONT_MEDIUM = 'Oswald';

function boundingBoxOf(shape: 'diagonal' | 'right' | 'circle', extra?: { cx?: number; cy?: number; r?: number }) {
  // Generous rectangular boxes used only to size the source image/fill draw
  // before clipping. "diagonal" and "right" deliberately span the *full*
  // canvas rather than a tighter guess at the clip's bounds: the diagonal
  // cut angle is user-adjustable (-30..30deg) and can push the sheared
  // boundary far to either side, and a box narrower than the actual clip
  // region leaves an unpainted (transparent) gap between the fill and the
  // clip edge — exactly the bug this generosity avoids.
  switch (shape) {
    case 'diagonal':
    case 'right':
      return { x: 0, y: 0, w: CANVAS_SIZE, h: CANVAS_SIZE };
    case 'circle': {
      const r = extra?.r ?? CANVAS_SIZE * 0.34;
      const cx = extra?.cx ?? CANVAS_SIZE * 0.68;
      const cy = extra?.cy ?? CANVAS_SIZE * 0.38;
      return { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
    }
  }
}

function drawClippedFill(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  state: CoverState,
  palette: Palette,
  box: { x: number; y: number; w: number; h: number },
  flatColor: string,
) {
  ctx.save();
  ctx.clip(path);
  if (state.mode === 'photo' && state.photo) {
    const bmp = buildDuotoneCanvas(state.photo, state.transform, box.w, box.h, palette);
    ctx.drawImage(bmp, box.x, box.y, box.w, box.h);
  } else {
    ctx.fillStyle = flatColor;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  ctx.restore();
}

function drawCatalogLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'right') {
  ctx.font = `500 18px ${FONT_MEDIUM}`;
  ctx.fillStyle = color;
  drawTracked(ctx, text, x, y, 1.5, align === 'right' ? 'right' : align === 'center' ? 'center' : 'left');
}

/**
 * Renders up to 5 tracklist rows, truncating (with an ellipsis) any row that
 * would otherwise overrun `maxWidth` — track names are free text up to 40
 * chars, long enough to blow past a fixed layout block if left unchecked.
 */
function drawTrackList(ctx: CanvasRenderingContext2D, tracks: string[], x: number, y: number, color: string, maxWidth: number, lineHeight = 22) {
  const entries = tracks.map((t) => t.trim()).filter(Boolean).slice(0, 5);
  if (entries.length === 0) return;
  ctx.font = `400 15px ${FONT_MEDIUM}`;
  ctx.fillStyle = color;
  entries.forEach((track, i) => {
    const label = `${String(i + 1).padStart(2, '0')} — ${track.toUpperCase()}`;
    const fitted = truncateToWidth(ctx, label, 0.8, maxWidth);
    drawTracked(ctx, fitted, x, y + i * lineHeight, 0.8, 'left');
  });
}

/** Solid plate behind a piece of text so it stays legible regardless of
 * what's underneath (a duotone photo, a color block, or the plain field) —
 * the diagonal/geometric shapes can land anywhere depending on the cut
 * angle, so text can't assume a particular background color at draw time. */
function drawTextPlate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function fillBackground(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

// --- Template A: Diagonal Duotone -----------------------------------------
function drawDiagonal(ctx: CanvasRenderingContext2D, state: CoverState, palette: Palette) {
  fillBackground(ctx, palette.highlight);

  const band = diagonalBandPath(CANVAS_SIZE, CANVAS_SIZE, state.transform.angle, 0.46, 0.7);
  drawClippedFill(ctx, band, state, palette, boundingBoxOf('diagonal'), palette.shadow);

  const barTop = CANVAS_SIZE * 0.74;
  ctx.fillStyle = palette.shadow;
  ctx.fillRect(0, barTop, CANVAS_SIZE, CANVAS_SIZE - barTop);

  // Band name tag, top-left, on a highlight plate so it reads even if the
  // diagonal band swings underneath it at a steep angle.
  const bandNameText = state.bandName.toUpperCase();
  ctx.font = `500 24px ${FONT_MEDIUM}`;
  const bandNameW = trackedWidth(ctx, bandNameText, 6);
  drawTextPlate(ctx, MARGIN - 12, MARGIN - 10, bandNameW + 24, 42, palette.highlight);
  ctx.fillStyle = palette.shadow;
  drawTracked(ctx, bandNameText, MARGIN, MARGIN + 22, 6, 'left');

  // Track list plate, below the band name (only rendered if tracks exist).
  const trackEntries = state.tracks.map((t) => t.trim()).filter(Boolean).slice(0, 5);
  if (trackEntries.length > 0) {
    const plateH = trackEntries.length * 22 + 16;
    drawTextPlate(ctx, MARGIN - 12, MARGIN + 44, CANVAS_SIZE * 0.42, plateH, palette.highlight);
    drawTrackList(ctx, state.tracks, MARGIN, MARGIN + 62, palette.shadow, CANVAS_SIZE * 0.42 - 24);
  }

  // Album title, extreme tracking, fitted to the full measure, reversed in the bar.
  const targetWidth = CANVAS_SIZE - MARGIN * 2;
  const { fontSize, tracking } = fitTrackedToWidth(ctx, state.albumName.toUpperCase(), FONT_HEAVY, 400, targetWidth, {
    baseSize: 108,
    minSize: 40,
  });
  ctx.font = `400 ${fontSize}px ${FONT_HEAVY}`;
  ctx.fillStyle = palette.highlight;
  const titleY = barTop + (CANVAS_SIZE - barTop) / 2 + fontSize * 0.32;
  drawTracked(ctx, state.albumName.toUpperCase(), MARGIN, titleY, tracking, 'left');

  // Catalog label plate, top-right, clear of the bar.
  const catalogW = (() => {
    ctx.font = `500 18px ${FONT_MEDIUM}`;
    return trackedWidth(ctx, state.catalogLabel, 1.5);
  })();
  drawTextPlate(ctx, CANVAS_SIZE - MARGIN - catalogW - 20, barTop - 44, catalogW + 24, 34, palette.highlight);
  drawCatalogLabel(ctx, state.catalogLabel, CANVAS_SIZE - MARGIN, barTop - 22, palette.shadow, 'right');
}

// --- Template B: Typography Only ------------------------------------------
function drawTypography(ctx: CanvasRenderingContext2D, state: CoverState, palette: Palette) {
  const splitY = CANVAS_SIZE * 0.4;
  ctx.fillStyle = palette.shadow;
  ctx.fillRect(0, 0, CANVAS_SIZE, splitY);
  ctx.fillStyle = palette.highlight;
  ctx.fillRect(0, splitY, CANVAS_SIZE, CANVAS_SIZE - splitY);

  const stripeW = CANVAS_SIZE * 0.06;
  ctx.fillStyle = palette.highlight;
  ctx.fillRect(CANVAS_SIZE - stripeW, 0, stripeW, splitY);

  const words = state.bandName.toUpperCase().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  if (words.length <= 1) {
    lines.push(words[0] ?? '');
  } else {
    const mid = Math.ceil(words.length / 2);
    lines.push(words.slice(0, mid).join(' '));
    lines.push(words.slice(mid).join(' '));
  }

  const targetWidth = CANVAS_SIZE - MARGIN * 2 - stripeW;
  let cursorY = MARGIN + 100;
  lines.forEach((line) => {
    const { fontSize, tracking } = fitTrackedToWidth(ctx, line, FONT_HEAVY, 400, targetWidth, {
      baseSize: 150,
      minSize: 48,
    });
    ctx.font = `400 ${fontSize}px ${FONT_HEAVY}`;
    ctx.fillStyle = cursorY < splitY ? palette.highlight : palette.shadow;
    drawTracked(ctx, line, MARGIN, cursorY, tracking, 'left');
    cursorY += fontSize * 1.05;
  });

  // The lower field is otherwise a wide flat run of color — echo the split
  // grid with a thin rule + numbered tag (same device as Template D) and,
  // if tracks were supplied, use the space for them instead of leaving it
  // empty. Both keep the composition from reading as unstructured negative
  // space rather than deliberate Swiss whitespace.
  ctx.strokeStyle = palette.shadow;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CANVAS_SIZE - stripeW / 2, splitY + 24);
  ctx.lineTo(CANVAS_SIZE - stripeW / 2, CANVAS_SIZE - MARGIN - 110);
  ctx.stroke();

  ctx.font = `500 16px ${FONT_MEDIUM}`;
  ctx.fillStyle = palette.shadow;
  drawTracked(ctx, 'N° 02 — TYPOGRAPHY', MARGIN, splitY + 46, 3, 'left');

  const trackMaxWidth = CANVAS_SIZE - MARGIN * 2 - stripeW;
  drawTrackList(ctx, state.tracks, MARGIN, splitY + 84, palette.shadow, trackMaxWidth, 26);

  // Album name in a ruled box near the bottom, fitted so it never spills
  // past the box it's drawn in.
  const boxY = CANVAS_SIZE - MARGIN - 90;
  const boxW = CANVAS_SIZE - MARGIN * 2;
  ctx.strokeStyle = palette.shadow;
  ctx.lineWidth = 3;
  ctx.strokeRect(MARGIN, boxY, boxW, 64);
  const albumTarget = boxW - 40;
  const albumFit = fitTrackedToWidth(ctx, state.albumName.toUpperCase(), FONT_MEDIUM, 500, albumTarget, {
    baseSize: 30,
    minSize: 18,
    maxTrackingRatio: 0.4,
  });
  ctx.font = `500 ${albumFit.fontSize}px ${FONT_MEDIUM}`;
  ctx.fillStyle = palette.shadow;
  drawTracked(ctx, state.albumName.toUpperCase(), MARGIN + 20, boxY + 42, albumFit.tracking, 'left');

  drawCatalogLabel(ctx, state.catalogLabel, CANVAS_SIZE - MARGIN, CANVAS_SIZE - MARGIN + 8, palette.shadow, 'right');
}

// --- Template C: Circle Inset ----------------------------------------------
function drawCircle(ctx: CanvasRenderingContext2D, state: CoverState, palette: Palette) {
  fillBackground(ctx, palette.shadow);

  const r = CANVAS_SIZE * 0.34;
  const cx = CANVAS_SIZE * 0.66;
  const cy = CANVAS_SIZE * 0.4;
  const circle = circlePath(cx, cy, r);
  drawClippedFill(ctx, circle, state, palette, boundingBoxOf('circle', { cx, cy, r }), palette.highlight);

  // thin ring outline to keep the circle crisp against either mode
  ctx.save();
  ctx.strokeStyle = palette.highlight;
  ctx.lineWidth = 2;
  ctx.stroke(circle);
  ctx.restore();

  // Vertical band name running up the left margin, fitted to the available
  // vertical run so long names never clip off the top edge.
  const verticalRun = CANVAS_SIZE - MARGIN * 2;
  const vFit = fitTrackedToWidth(ctx, state.bandName.toUpperCase(), FONT_TALL, 400, verticalRun, {
    baseSize: 84,
    minSize: 32,
    maxTrackingRatio: 0.5,
  });
  ctx.font = `400 ${vFit.fontSize}px ${FONT_TALL}`;
  ctx.fillStyle = palette.highlight;
  drawVerticalTracked(ctx, state.bandName.toUpperCase(), MARGIN + vFit.fontSize * 0.4, CANVAS_SIZE - MARGIN, vFit.tracking, 'left');

  // Album name, horizontal, bottom band.
  const targetWidth = CANVAS_SIZE - MARGIN * 2 - 110;
  const { fontSize, tracking } = fitTrackedToWidth(ctx, state.albumName.toUpperCase(), FONT_MEDIUM, 600, targetWidth, {
    baseSize: 56,
    minSize: 26,
  });
  ctx.font = `600 ${fontSize}px ${FONT_MEDIUM}`;
  ctx.fillStyle = palette.highlight;
  drawTracked(ctx, state.albumName.toUpperCase(), MARGIN + 110, CANVAS_SIZE - MARGIN - 20, tracking, 'left');

  const trackX = CANVAS_SIZE - MARGIN - 260;
  drawTrackList(ctx, state.tracks, trackX, MARGIN + 30, palette.highlight, CANVAS_SIZE - MARGIN - trackX);
  drawCatalogLabel(ctx, state.catalogLabel, CANVAS_SIZE - MARGIN, MARGIN, palette.highlight, 'right');
}

// --- Template D: Grid Split --------------------------------------------------
function drawGrid(ctx: CanvasRenderingContext2D, state: CoverState, palette: Palette) {
  const xFraction = 0.4;
  const angle = state.transform.angle;
  const left = splitPath(CANVAS_SIZE, CANVAS_SIZE, angle, xFraction, 'left');
  const right = splitPath(CANVAS_SIZE, CANVAS_SIZE, angle, xFraction, 'right');

  ctx.save();
  ctx.clip(left);
  ctx.fillStyle = palette.shadow;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.restore();

  drawClippedFill(ctx, right, state, palette, boundingBoxOf('right'), palette.highlight);

  // Divider rule, echoing the studio UI's own hairline/section rules.
  ctx.save();
  ctx.clip(left);
  ctx.strokeStyle = palette.highlight;
  ctx.lineWidth = 3;
  ctx.stroke(left);
  ctx.restore();

  const textX = MARGIN;
  // The left panel is a sheared quadrilateral, not a rectangle: its right
  // edge moves with the cut angle. Everything drawn into it is (a) clipped
  // to the actual panel shape as a hard guarantee against spilling into the
  // photo/color panel, and (b) sized against the boundary's position at the
  // narrowest row it needs to clear, not a static width guess.
  ctx.save();
  ctx.clip(left);

  const availableWidthAt = (y: number) => Math.max(80, splitBoundaryXAt(y, angle, xFraction, CANVAS_SIZE) - textX - 24);

  ctx.font = `500 16px ${FONT_MEDIUM}`;
  ctx.fillStyle = palette.highlight;
  drawTracked(ctx, truncateToWidth(ctx, 'N° 04 — GRID', 3, availableWidthAt(MARGIN)), textX, MARGIN, 3, 'left');

  const words = state.bandName.toUpperCase().split(/\s+/).filter(Boolean);
  let cursorY = MARGIN + 90;
  const perLine = words.length > 2 ? Math.ceil(words.length / 2) : words.length;
  const lines = words.length > 1 ? [words.slice(0, perLine).join(' '), words.slice(perLine).join(' ')].filter(Boolean) : [words[0] ?? ''];
  const titleBottomY = cursorY + lines.length * 90;
  const titleWidth = Math.min(availableWidthAt(cursorY), availableWidthAt(titleBottomY));
  lines.forEach((line) => {
    const { fontSize, tracking } = fitTrackedToWidth(ctx, line, FONT_HEAVY, 400, titleWidth, {
      baseSize: 68,
      minSize: 26,
    });
    ctx.font = `400 ${fontSize}px ${FONT_HEAVY}`;
    ctx.fillStyle = palette.highlight;
    drawTracked(ctx, line, textX, cursorY, tracking, 'left');
    cursorY += fontSize * 1.08;
  });

  cursorY += 20;
  const ruleWidth = availableWidthAt(cursorY);
  ctx.strokeStyle = palette.highlight;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(textX, cursorY);
  ctx.lineTo(textX + ruleWidth, cursorY);
  ctx.stroke();
  cursorY += 34;

  const albumFit = fitTrackedToWidth(ctx, state.albumName.toUpperCase(), FONT_MEDIUM, 500, availableWidthAt(cursorY), {
    baseSize: 24,
    minSize: 16,
    maxTrackingRatio: 0.4,
  });
  ctx.font = `500 ${albumFit.fontSize}px ${FONT_MEDIUM}`;
  ctx.fillStyle = palette.highlight;
  drawTracked(ctx, state.albumName.toUpperCase(), textX, cursorY, albumFit.tracking, 'left');
  cursorY += 50;

  drawTrackList(ctx, state.tracks, textX, cursorY, palette.highlight, availableWidthAt(cursorY + 100));

  ctx.font = `500 18px ${FONT_MEDIUM}`;
  const catalogFitted = truncateToWidth(ctx, state.catalogLabel, 1.5, availableWidthAt(CANVAS_SIZE - MARGIN));
  drawCatalogLabel(ctx, catalogFitted, textX, CANVAS_SIZE - MARGIN, palette.highlight, 'left');

  ctx.restore();
}

export function renderCover(ctx: CanvasRenderingContext2D, state: CoverState): void {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const palette = getPalette(state.paletteId);

  switch (state.templateId) {
    case 'diagonal':
      drawDiagonal(ctx, state, palette);
      break;
    case 'typography':
      drawTypography(ctx, state, palette);
      break;
    case 'circle':
      drawCircle(ctx, state, palette);
      break;
    case 'grid':
      drawGrid(ctx, state, palette);
      break;
  }
}
