const SAMPLE_PX = 40; // source-pixel window sampled around the pointer; loupe canvas is 160px, so zoom = 4x

export interface LoupeElements {
  readonly container: HTMLElement;
  readonly canvas: HTMLCanvasElement;
}

/**
 * Renders a magnified crop of `sourceCanvas` centered on the pointer, and
 * positions the loupe element over the pointer within `wrap`.
 */
export function updateLoupe(elements: LoupeElements, sourceCanvas: HTMLCanvasElement, wrap: HTMLElement, clientX: number, clientY: number): void {
  const wrapRect = wrap.getBoundingClientRect();
  const canvasRect = sourceCanvas.getBoundingClientRect();

  const withinCanvas =
    clientX >= canvasRect.left && clientX <= canvasRect.right && clientY >= canvasRect.top && clientY <= canvasRect.bottom;

  if (!withinCanvas) {
    elements.container.hidden = true;
    return;
  }

  const scaleX = sourceCanvas.width / canvasRect.width;
  const scaleY = sourceCanvas.height / canvasRect.height;
  const sourceX = (clientX - canvasRect.left) * scaleX;
  const sourceY = (clientY - canvasRect.top) * scaleY;

  const half = SAMPLE_PX / 2;
  const sx = Math.max(0, Math.min(sourceCanvas.width - SAMPLE_PX, sourceX - half));
  const sy = Math.max(0, Math.min(sourceCanvas.height - SAMPLE_PX, sourceY - half));

  const ctx = elements.canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
  ctx.drawImage(sourceCanvas, sx, sy, SAMPLE_PX, SAMPLE_PX, 0, 0, elements.canvas.width, elements.canvas.height);

  elements.container.style.left = `${clientX - wrapRect.left}px`;
  elements.container.style.top = `${clientY - wrapRect.top}px`;
  elements.container.hidden = false;
}

export function hideLoupe(elements: LoupeElements): void {
  elements.container.hidden = true;
}
