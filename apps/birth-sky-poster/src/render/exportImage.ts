import { getEmbeddedFontCss } from './embedFonts';
import { POSTER_H, POSTER_W } from './layout';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Clones the poster SVG and inlines the font-face data so the output file is self-contained. */
async function buildStandaloneSvgSource(svg: SVGSVGElement): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('.inline-edit-input').forEach((n) => n.remove());

  const fontCss = await getEmbeddedFontCss();
  const style = clone.querySelector('style');
  if (style) {
    style.textContent = `${fontCss}\n${style.textContent ?? ''}`;
  }

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const serializer = new XMLSerializer();
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serializer.serializeToString(clone)}`;
}

export async function exportSvgFile(svg: SVGSVGElement, filename: string): Promise<void> {
  const source = await buildStandaloneSvgSource(svg);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, filename);
}

export async function exportPngFile(
  svg: SVGSVGElement,
  filename: string,
  scale: number,
): Promise<void> {
  const source = await buildStandaloneSvgSource(svg);
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(POSTER_W * scale);
    canvas.height = Math.round(POSTER_H * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is unavailable in this browser.');

    ctx.fillStyle = '#f1efe7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!pngBlob) throw new Error('Failed to encode PNG.');
    triggerDownload(pngBlob, filename);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to rasterize the poster SVG.'));
    img.src = src;
  });
}
