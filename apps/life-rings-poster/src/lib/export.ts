import { CANVAS_W, CANVAS_H } from './geometry';

const FONT_CSS = `
text { font-family: 'Manrope', 'Hiragino Sans', 'Yu Gothic', sans-serif; }
.poster-title { font-family: 'Fraunces', 'Hiragino Mincho ProN', serif; }
.poster-subtitle, .plate-caption, .label-year { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
`;

let embeddedFontFaceCss: string | null = null;

/** Best-effort: inline the three webfonts as base64 so exported SVG/PNG files
 * render correctly even outside this page (no @fontsource available). Falls
 * back silently (system fonts) if fetching ever fails, e.g. offline. */
async function getEmbeddedFontFaceCss(): Promise<string> {
  if (embeddedFontFaceCss !== null) return embeddedFontFaceCss;
  const sources: { family: string; weight: string; style: string; url: string; base: string }[] = [];
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin stylesheet, skip
      }
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSFontFaceRule) {
          const family = rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
          const weight = rule.style.getPropertyValue('font-weight').trim() || '400';
          const style = rule.style.getPropertyValue('font-style').trim() || 'normal';
          if (!/Fraunces|Manrope|IBM Plex Mono/.test(family)) continue;
          const src = rule.style.getPropertyValue('src');
          // @fontsource ships one @font-face per unicode-range subset (latin,
          // latin-ext, cyrillic, vietnamese, greek...) — we only need the
          // "latin" subset (not "latin-ext") to cover the Latin glyphs these
          // typefaces actually contain (numerals, English titles/captions).
          if (!/-latin-\d/.test(src) || /-latin-ext-/.test(src)) continue;
          const match = src.match(/url\(["']?([^"')]+)["']?\)\s*format\(["']?woff2["']?\)/);
          const url = match?.[1] ?? src.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
          // CSS url() values resolve relative to the *stylesheet's* location,
          // not the document's — using document.baseURI here silently
          // 404s (and, on this SPA, quietly serves index.html instead).
          const base = sheet.href ?? document.baseURI;
          if (url) sources.push({ family, weight, style, url, base });
        }
      }
    }

    const faces = await Promise.all(
      sources.map(async ({ family, weight, style, url, base }) => {
        const abs = new URL(url, base).href;
        const res = await fetch(abs);
        if (!res.ok) throw new Error(`font fetch failed: ${abs}`);
        const buf = await res.arrayBuffer();
        const b64 = arrayBufferToBase64(buf);
        return `@font-face { font-family: '${family}'; font-weight: ${weight}; font-style: ${style}; src: url(data:font/woff2;base64,${b64}) format('woff2'); }`;
      }),
    );
    embeddedFontFaceCss = faces.join('\n');
  } catch {
    embeddedFontFaceCss = '';
  }
  return embeddedFontFaceCss;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Produce a standalone, self-styled SVG document string ready to save or rasterize. */
export async function buildStandaloneSvg(svgMarkup: string, embedFonts: boolean): Promise<string> {
  const fontFaces = embedFonts ? await getEmbeddedFontFaceCss() : '';
  const style = `<style>${FONT_CSS}${fontFaces}
.ring { stroke: none; }
.label-year { font-size: 12.5px; font-weight: 600; fill: #2a1c10; letter-spacing: 0.02em; }
.label-text { font-size: 12.5px; fill: #2a1c10; }
.label-text.major { font-weight: 700; }
.poster-title { font-size: 46px; font-weight: 700; fill: #2a1c10; letter-spacing: 0.01em; }
.poster-subtitle { font-size: 15px; fill: #55402a; letter-spacing: 0.12em; }
.plate-caption { font-size: 13px; fill: #55402a; letter-spacing: 0.08em; }
</style>`;

  return svgMarkup.replace('</defs>', `${style}</defs>`);
}

export function downloadSvgFile(standaloneSvg: string, filename: string): void {
  const blob = new Blob([standaloneSvg], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, filename);
}

export async function rasterizeToPng(standaloneSvg: string, targetWidth: number): Promise<Blob> {
  const scale = targetWidth / CANVAS_W;
  const targetHeight = Math.round(CANVAS_H * scale);

  const svgBlob = new Blob([standaloneSvg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const c = canvas.getContext('2d');
    if (!c) throw new Error('canvas 2d context unavailable');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, targetWidth, targetHeight);
    c.drawImage(img, 0, 0, targetWidth, targetHeight);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG encoding failed');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to rasterize SVG'));
    img.src = src;
  });
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function makeFilename(title: string, ext: string): string {
  const safe = (title || 'life-rings')
    .trim()
    .replace(/[^\p{L}\p{N}\- _]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return `${safe || 'life-rings'}.${ext}`;
}
