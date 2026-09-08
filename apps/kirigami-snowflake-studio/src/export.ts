import { assembleSnowflakePathD } from './geometry/assemble';
import { WEDGE_RADIUS } from './geometry/types';
import type { Cut } from './geometry/types';

const BOUND = WEDGE_RADIUS * 1.12;
const VB = `${-BOUND} ${-BOUND} ${BOUND * 2} ${BOUND * 2}`;

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Cut-ready outline SVG: unfilled, single black stroke path, evenodd — print & cut. */
export function buildOutlineSvg(cuts: Cut[]): string {
  const d = assembleSnowflakePathD(cuts);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="${VB}">\n  <path d="${d}" fill="none" stroke="#000000" stroke-width="1.6" fill-rule="evenodd" stroke-linejoin="round"/>\n</svg>\n`;
}

export function exportSvg(cuts: Cut[]) {
  const svgString = buildOutlineSvg(cuts);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  download(blob, 'kirigami-snowflake.svg');
}

export type PngBackground = 'transparent' | 'mat';

/** Filled preview SVG used as the PNG export source (same geometry, paper-colored). */
function buildFilledSvg(cuts: Cut[], background: PngBackground): string {
  const d = assembleSnowflakePathD(cuts);
  const bgRect =
    background === 'mat'
      ? `<rect x="${-BOUND}" y="${-BOUND}" width="${BOUND * 2}" height="${BOUND * 2}" fill="#101627"/>`
      : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="${VB}">\n  ${bgRect}\n  <path d="${d}" fill="#f6f1e7" fill-rule="evenodd"/>\n</svg>\n`;
}

export async function exportPng(cuts: Cut[], size: number, background: PngBackground): Promise<void> {
  const svgString = buildFilledSvg(cuts, background);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2D context unavailable');
    if (background === 'transparent') {
      ctx.clearRect(0, 0, size, size);
    }
    ctx.drawImage(img, 0, 0, size, size);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG の書き出しに失敗しました');
    download(blob, `kirigami-snowflake-${size}px.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = src;
  });
}
