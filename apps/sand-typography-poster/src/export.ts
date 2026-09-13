export interface PosterExportOptions {
  sandSource: CanvasImageSource;
  sandAspect: number; // width / height of the source sand image
  phrase: string;
  phraseFont: string;
  plateNo: string;
  estText: string;
  ink: string;
  inkSoft: string;
  paper: string;
  paperDeep: string;
}

const EXPORT_W = 1200;
const PAD = 74;
const MONO_H = 116;
const PLATE_H = 210;

export function renderPosterToCanvas(opts: PosterExportOptions): HTMLCanvasElement {
  const stageW = EXPORT_W - PAD * 2;
  const stageH = Math.round(stageW / (4 / 3));
  const EXPORT_H = PAD + MONO_H + stageH + PLATE_H + PAD;

  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_W;
  canvas.height = EXPORT_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');

  // --- Paper background -----------------------------------------------
  ctx.fillStyle = opts.paper;
  ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);

  const vignette = ctx.createRadialGradient(
    EXPORT_W * 0.5,
    EXPORT_H * 0.35,
    EXPORT_H * 0.1,
    EXPORT_W * 0.5,
    EXPORT_H * 0.5,
    EXPORT_H * 0.85,
  );
  vignette.addColorStop(0, 'rgba(255,255,255,0.25)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.10)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);

  // Sparse speckle for a paper-grain feel.
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.fillStyle = 'rgba(45,36,24,0.05)';
  for (let i = 0; i < 900; i++) {
    const x = rand() * EXPORT_W;
    const y = rand() * EXPORT_H;
    ctx.fillRect(x, y, 1, 1);
  }

  // --- Double-rule frame -------------------------------------------------
  ctx.strokeStyle = opts.ink;
  ctx.lineWidth = 6;
  ctx.strokeRect(22, 22, EXPORT_W - 44, EXPORT_H - 44);
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, EXPORT_W - 80, EXPORT_H - 80);

  // --- Corner ornaments ----------------------------------------------
  drawCorner(ctx, 50, 50, 1, 1, opts.ink);
  drawCorner(ctx, EXPORT_W - 50, 50, -1, 1, opts.ink);
  drawCorner(ctx, 50, EXPORT_H - 50, 1, -1, opts.ink);
  drawCorner(ctx, EXPORT_W - 50, EXPORT_H - 50, -1, -1, opts.ink);

  // --- Monogram --------------------------------------------------------
  const cx = EXPORT_W / 2;
  drawHourglass(ctx, cx, PAD + 6, 40, opts.ink);
  ctx.fillStyle = opts.inkSoft;
  ctx.font = '700 15px Arvo, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.save();
  drawTracked(ctx, 'SAND TYPOGRAPHY STUDIO', cx, PAD + 66, 3.2);
  ctx.restore();

  // --- Sand stage --------------------------------------------------------
  const stageY = PAD + MONO_H;
  ctx.strokeStyle = 'rgba(45,36,24,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD, stageY);
  ctx.lineTo(PAD + stageW, stageY);
  ctx.moveTo(PAD, stageY + stageH);
  ctx.lineTo(PAD + stageW, stageY + stageH);
  ctx.stroke();

  ctx.fillStyle = opts.paperDeep;
  ctx.fillRect(PAD, stageY, stageW, stageH);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Fit the (roughly square-ish) sim buffer into the 4:3 stage without
  // distortion, letterboxing if the aspect ratios differ.
  const targetAspect = 4 / 3;
  let dw = stageW;
  let dh = stageW / opts.sandAspect;
  if (dh > stageH) {
    dh = stageH;
    dw = stageH * opts.sandAspect;
  }
  void targetAspect;
  const dx = PAD + (stageW - dw) / 2;
  const dy = stageY + (stageH - dh) / 2;
  ctx.drawImage(opts.sandSource, dx, dy, dw, dh);

  // --- Plate -------------------------------------------------------------
  const plateY = stageY + stageH + 56;
  ctx.fillStyle = opts.ink;
  ctx.textAlign = 'center';
  let phraseSize = 56;
  ctx.font = `700 ${phraseSize}px ${opts.phraseFont}`;
  const maxPhraseWidth = EXPORT_W - PAD * 2 - 40;
  const w = ctx.measureText(opts.phrase).width;
  if (w > maxPhraseWidth) {
    phraseSize *= maxPhraseWidth / w;
    ctx.font = `700 ${phraseSize}px ${opts.phraseFont}`;
  }
  ctx.fillText(opts.phrase, cx, plateY);

  ctx.fillStyle = opts.inkSoft;
  ctx.font = '700 14px Arvo, Georgia, serif';
  drawTracked(ctx, `${opts.plateNo}   ·   ${opts.estText}`, cx, plateY + 40, 2.6);

  return canvas;
}

function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  tracking: number,
): void {
  // Manual letter-spacing for crisp cross-browser export (canvas
  // letterSpacing support is inconsistent for measureText-based centering).
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (text.length - 1);
  let x = cx - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? '';
    ctx.fillText(ch, x, y);
    x += (widths[i] ?? 0) + tracking;
  }
  ctx.textAlign = prevAlign;
}

function drawCorner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sx: number,
  sy: number,
  color: string,
): void {
  const len = 34;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + len * sy);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len * sx, y);
  ctx.stroke();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.fillRect(-3, -3, 6, 6);
  ctx.restore();
}

function drawHourglass(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  size: number,
  color: string,
): void {
  const w = size * 0.8;
  const h = size;
  const left = cx - w / 2;
  const right = cx + w / 2;
  const bottom = top + h;
  const mid = top + h / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.moveTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.moveTo(left, top);
  ctx.bezierCurveTo(left, mid - h * 0.15, cx, mid - h * 0.05, cx, mid);
  ctx.bezierCurveTo(cx, mid - h * 0.05, right, mid - h * 0.15, right, top);
  ctx.moveTo(left, bottom);
  ctx.bezierCurveTo(left, mid + h * 0.15, cx, mid + h * 0.05, cx, mid);
  ctx.bezierCurveTo(cx, mid + h * 0.05, right, mid + h * 0.15, right, bottom);
  ctx.stroke();
}
