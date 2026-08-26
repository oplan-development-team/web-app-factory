export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Fit a HiDPI-aware square canvas: syncs the backing-store resolution to the
 * element's *current CSS box size* (which CSS/layout controls) * devicePixelRatio.
 * Returns the measured CSS size in px, which callers need for their own
 * logical-to-device scale factor.
 */
export function fitCanvasToDisplaySize(canvas: HTMLCanvasElement): number {
  const rect = canvas.getBoundingClientRect();
  const cssSize = Math.max(1, Math.round(rect.width || rect.height || canvas.clientWidth || 300));
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  const size = Math.round(cssSize * dpr);
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  return cssSize;
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('画像として読み込めませんでした'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** "Cover" fit: draws src image into a square dest region, cropping to fill. */
export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  dx: number,
  dy: number,
  dSize: number,
): void {
  const scale = Math.max(dSize / imgW, dSize / imgH);
  const sw = dSize / scale;
  const sh = dSize / scale;
  const sx = imgW / 2 - sw / 2;
  const sy = imgH / 2 - sh / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dSize, dSize);
}
