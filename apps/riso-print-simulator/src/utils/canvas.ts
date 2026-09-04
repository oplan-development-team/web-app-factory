/** Draws an image/bitmap into a w x h box using CSS "cover" fit (crop to fill, centered). */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { width: number; height: number },
  w: number,
  h: number,
): void {
  const iw = img.width;
  const ih = img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

export function makeAlphaSampler(
  imageData: ImageData,
  width: number,
  height: number,
): (x: number, y: number) => number {
  const data = imageData.data;
  return (x: number, y: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || xi >= width || yi < 0 || yi >= height) return 0;
    return data[(yi * width + xi) * 4 + 3] / 255;
  };
}
