const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/**
 * Serialize the live preview node. The preview is the only renderer in the app,
 * so what is exported is by construction what was on screen.
 */
export function serializeSvg(svg: SVGSVGElement, pixelSize: number, title: string): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;

  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('xmlns:xlink', XLINK_NS);
  clone.setAttribute('width', String(pixelSize));
  clone.setAttribute('height', String(pixelSize));
  clone.removeAttribute('class');
  clone.removeAttribute('aria-label');

  const titleNode = clone.ownerDocument.createElementNS(SVG_NS, 'title');
  titleNode.textContent = title;
  clone.insertBefore(titleNode, clone.firstChild);

  // Illustrator and other older consumers still look for xlink:href on <image>.
  for (const image of Array.from(clone.querySelectorAll('image'))) {
    const href = image.getAttribute('href');
    if (href) image.setAttributeNS(XLINK_NS, 'xlink:href', href);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('SVG を画像として読み込めませんでした。'));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG を生成できませんでした。'))),
      'image/png',
    );
  });
}

/**
 * Rasterize by drawing the serialized SVG onto a canvas. The logo is already a
 * data URL, so the canvas is never tainted and `toBlob` always succeeds.
 */
export async function rasterizeToPng(
  svg: SVGSVGElement,
  pixelSize: number,
  title: string,
): Promise<Blob> {
  const source = serializeSvg(svg, pixelSize, title);
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = pixelSize;
    canvas.height = pixelSize;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas を初期化できませんでした。');
    context.drawImage(image, 0, 0, pixelSize, pixelSize);

    return await canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a tick to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const MAX_SLUG_LENGTH = 40;

/** ASCII-safe file name derived from the payload, e.g. `qr-example-com-20260817.svg`. */
export function buildFileName(text: string, extension: string, now = new Date()): string {
  const slug = text
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');

  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');

  return `qr-${slug || 'code'}-${stamp}.${extension}`;
}
