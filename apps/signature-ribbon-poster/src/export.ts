import { CANVAS_HEIGHT, CANVAS_WIDTH, renderScene, type Stroke } from "./ribbon";
import { rgba } from "./palette";

async function ensureFontsLoaded(): Promise<void> {
  const loaders = [
    document.fonts.load('italic 500 64px "Playfair Display"'),
    document.fonts.load('500 28px "Cormorant Garamond"'),
  ];
  await Promise.allSettled(loaders);
  await document.fonts.ready;
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  backgroundHex: string,
  captionText: string
): void {
  const scrimHeight = height * 0.16;
  const scrimTop = height - scrimHeight;

  const gradient = ctx.createLinearGradient(0, scrimTop, 0, height);
  gradient.addColorStop(0, rgba(backgroundHex, 0));
  gradient.addColorStop(0.55, rgba(backgroundHex, 0.85));
  gradient.addColorStop(1, rgba(backgroundHex, 0.97));

  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, scrimTop, width, scrimHeight);

  const hairlineY = height - scrimHeight * 0.42;
  const hairlineWidth = width * 0.18;
  ctx.strokeStyle = "rgba(201, 162, 75, 0.75)";
  ctx.lineWidth = Math.max(1, width * 0.0011);
  ctx.beginPath();
  ctx.moveTo(width / 2 - hairlineWidth / 2, hairlineY);
  ctx.lineTo(width / 2 + hairlineWidth / 2, hairlineY);
  ctx.stroke();

  const eyebrow = "S I G N E D";
  ctx.fillStyle = "rgba(201, 162, 75, 0.85)";
  ctx.font = `500 ${Math.round(width * 0.014)}px "Cormorant Garamond", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(eyebrow, width / 2, hairlineY - scrimHeight * 0.12);

  ctx.fillStyle = "#f4efe4";
  ctx.font = `italic 500 ${Math.round(width * 0.028)}px "Playfair Display", serif`;
  ctx.fillText(captionText, width / 2, hairlineY + scrimHeight * 0.34);
}

export interface ExportOptions {
  backgroundHex: string;
  strokes: Stroke[];
  captionText: string;
}

/**
 * Renders the poster (background + ribbon strokes + optional caption) onto
 * an offscreen canvas at the full export resolution and triggers a PNG
 * download. Runs entirely client-side; nothing is sent to a server.
 */
export async function exportPoster(options: ExportOptions): Promise<void> {
  const { backgroundHex, strokes, captionText } = options;

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = CANVAS_WIDTH;
  exportCanvas.height = CANVAS_HEIGHT;
  const ctx = exportCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context is not available for export");
  }

  renderScene(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, backgroundHex, strokes);

  const trimmedCaption = captionText.trim();
  if (trimmedCaption.length > 0) {
    await ensureFontsLoaded();
    drawCaption(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, backgroundHex, trimmedCaption);
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    exportCanvas.toBlob(resolve, "image/png");
  });
  if (!blob) {
    throw new Error("Failed to encode poster as PNG");
  }

  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `signature-ribbon-poster-${timestamp}.png`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
