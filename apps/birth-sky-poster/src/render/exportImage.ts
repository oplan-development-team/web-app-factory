import { getEmbeddedFontCss } from './embedFonts';
import { POSTER_H, POSTER_W } from './layout';
import { COLORS } from './tokens';

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

/**
 * Clones the poster SVG and inlines the font data so the output file is
 * self-contained: it renders identically on a machine that has never had Inter
 * or JetBrains Mono installed, and the PNG rasterizer -- which loads the SVG as
 * a foreign document -- can resolve the faces without a network hop.
 */
async function buildStandaloneSvgSource(svg: SVGSVGElement): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;

  // Editing affordances belong to the live page, not to a saved file.
  clone.querySelectorAll('.inline-edit-input').forEach((node) => node.remove());
  clone.querySelectorAll('text.editable').forEach((node) => {
    node.removeAttribute('tabindex');
    node.removeAttribute('role');
    node.removeAttribute('aria-label');
  });

  const fontCss = await getEmbeddedFontCss();
  const style = clone.querySelector('style');
  if (style !== null) {
    style.textContent = `${fontCss}\n${style.textContent ?? ''}`;
  }

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const serializer = new XMLSerializer();
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serializer.serializeToString(clone)}`;
}

export async function exportSvgFile(svg: SVGSVGElement, filename: string): Promise<void> {
  const source = await buildStandaloneSvgSource(svg);
  triggerDownload(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }), filename);
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
    if (ctx === null) {
      throw new Error('このブラウザではCanvasを利用できないため、PNGを書き出せません。');
    }

    // Paint the paper ground explicitly: PNG output for print must be opaque
    // (FR-008.3), and a transparent poster prints as a black rectangle on many
    // consumer drivers.
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (pngBlob === null) {
      // Canvas area limits differ by browser and device; 4x (4000x5600) is the
      // size that runs into them, so name the way out rather than just failing.
      throw new Error(
        'この解像度ではPNGを生成できませんでした。解像度を下げて再度お試しください。',
      );
    }

    triggerDownload(pngBlob, filename);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('ポスターの画像化に失敗しました。'));
    img.src = src;
  });
}
