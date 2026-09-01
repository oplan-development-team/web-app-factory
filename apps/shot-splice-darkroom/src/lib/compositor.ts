export type FrontLayer = 'top' | 'bottom';
export type CompositeMode = 'normal' | 'diff';

export interface SpliceParams {
  readonly cropBottomA: number;
  readonly cropTopB: number;
  readonly overlapPx: number;
  readonly frontLayer: FrontLayer;
}

export interface WorkingGeometry {
  readonly heightA: number;
  readonly heightB: number;
  readonly overlap: number;
  readonly outWidth: number;
  readonly outHeight: number;
}

const DIFF_AMPLIFY = 3;
const DIFF_DIM_FILTER = 'grayscale(1) brightness(0.5)';

export function computeGeometry(imgA: HTMLImageElement, imgB: HTMLImageElement, params: SpliceParams): WorkingGeometry {
  const heightA = Math.max(0, imgA.naturalHeight - params.cropBottomA);
  const heightB = Math.max(0, imgB.naturalHeight - params.cropTopB);
  const overlap = Math.max(0, Math.min(params.overlapPx, heightA, heightB));
  const outWidth = Math.max(1, Math.min(imgA.naturalWidth, imgB.naturalWidth));
  const outHeight = Math.max(1, heightA + heightB - overlap);
  return { heightA, heightB, overlap, outWidth, outHeight };
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

function drawDiffBand(
  ctx: CanvasRenderingContext2D,
  imgA: HTMLImageElement,
  imgB: HTMLImageElement,
  params: SpliceParams,
  geometry: WorkingGeometry,
  bandY: number,
): void {
  const { heightA, overlap, outWidth } = geometry;
  if (overlap <= 0) return;

  const aCanvas = document.createElement('canvas');
  aCanvas.width = outWidth;
  aCanvas.height = overlap;
  const aCtx = aCanvas.getContext('2d');
  if (!aCtx) return;
  aCtx.drawImage(imgA, 0, heightA - overlap, outWidth, overlap, 0, 0, outWidth, overlap);
  const aData = aCtx.getImageData(0, 0, outWidth, overlap);

  const bCanvas = document.createElement('canvas');
  bCanvas.width = outWidth;
  bCanvas.height = overlap;
  const bCtx = bCanvas.getContext('2d');
  if (!bCtx) return;
  bCtx.drawImage(imgB, 0, params.cropTopB, outWidth, overlap, 0, 0, outWidth, overlap);
  const bData = bCtx.getImageData(0, 0, outWidth, overlap);

  const diff = ctx.createImageData(outWidth, overlap);
  for (let i = 0; i < diff.data.length; i += 4) {
    diff.data[i] = clampByte(Math.abs((aData.data[i] ?? 0) - (bData.data[i] ?? 0)) * DIFF_AMPLIFY);
    diff.data[i + 1] = clampByte(Math.abs((aData.data[i + 1] ?? 0) - (bData.data[i + 1] ?? 0)) * DIFF_AMPLIFY);
    diff.data[i + 2] = clampByte(Math.abs((aData.data[i + 2] ?? 0) - (bData.data[i + 2] ?? 0)) * DIFF_AMPLIFY);
    diff.data[i + 3] = 255;
  }
  ctx.putImageData(diff, 0, bandY);
}

export function renderComposite(
  canvas: HTMLCanvasElement,
  imgA: HTMLImageElement,
  imgB: HTMLImageElement,
  params: SpliceParams,
  mode: CompositeMode,
): WorkingGeometry {
  const geometry = computeGeometry(imgA, imgB, params);
  const { heightA, heightB, overlap, outWidth, outHeight } = geometry;

  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return geometry;

  ctx.clearRect(0, 0, outWidth, outHeight);
  const bandY = heightA - overlap;

  if (mode === 'normal') {
    const drawA = () => ctx.drawImage(imgA, 0, 0, outWidth, heightA, 0, 0, outWidth, heightA);
    const drawB = () => ctx.drawImage(imgB, 0, params.cropTopB, outWidth, heightB, 0, bandY, outWidth, heightB);
    if (params.frontLayer === 'top') {
      drawB();
      drawA();
    } else {
      drawA();
      drawB();
    }
    return geometry;
  }

  // Diff mode: non-overlap regions dimmed to grayscale for context,
  // overlap band replaced with amplified absolute pixel difference
  // (identical alignment renders as black).
  ctx.save();
  ctx.filter = DIFF_DIM_FILTER;
  if (bandY > 0) {
    ctx.drawImage(imgA, 0, 0, outWidth, bandY, 0, 0, outWidth, bandY);
  }
  const belowBandSourceY = params.cropTopB + overlap;
  const belowBandHeight = heightB - overlap;
  if (belowBandHeight > 0) {
    ctx.drawImage(imgB, 0, belowBandSourceY, outWidth, belowBandHeight, 0, bandY + overlap, outWidth, belowBandHeight);
  }
  ctx.restore();

  drawDiffBand(ctx, imgA, imgB, params, geometry, bandY);

  return geometry;
}
