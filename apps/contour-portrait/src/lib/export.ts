import { DOC_H, DOC_W } from './constants';

function serialize(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(clone);
}

export function downloadSvg(svg: SVGSVGElement, filename: string): void {
  const xml = serialize(svg);
  const blob = new Blob([xml], { type: 'image/svg+xml' });
  triggerDownload(blob, `${filename}.svg`);
}

export function downloadPng(svg: SVGSVGElement, filename: string, scale: 1 | 2 | 3): Promise<void> {
  return new Promise((resolve, reject) => {
    const xml = serialize(svg);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = DOC_W * scale;
      canvas.height = DOC_H * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas 2D context is unavailable.'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('PNG のエンコードに失敗しました。'));
          return;
        }
        triggerDownload(blob, `${filename}@${scale}x.png`);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('PNG の書き出しに失敗しました。ブラウザの制限により画像を変換できませんでした。'));
    };
    img.src = url;
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugifyTitle(title: string): string {
  const trimmed = title.trim() || 'untitled-summit';
  return trimmed
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9぀-ヿ一-鿿]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'untitled-summit';
}
