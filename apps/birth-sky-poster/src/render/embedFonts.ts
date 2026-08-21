// Embeds the poster's two typefaces as base64 data URIs so that a
// downloaded/exported SVG is fully self-contained (renders identically on a
// machine that never had Inter or JetBrains Mono installed) and so the PNG
// rasterizer, which loads the SVG as a foreign document, can resolve the
// font files without an extra network hop.
import interWoff2Url from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import jetbrainsMonoWoff2Url from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url';

async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:font/woff2;base64,${btoa(binary)}`;
}

let cachedCss: Promise<string> | null = null;

/** Returns (and caches) a <style> body with @font-face rules using embedded font data. */
export function getEmbeddedFontCss(): Promise<string> {
  if (!cachedCss) {
    cachedCss = Promise.all([toDataUri(interWoff2Url), toDataUri(jetbrainsMonoWoff2Url)]).then(
      ([interData, monoData]) => `
        @font-face {
          font-family: 'Inter Variable';
          font-weight: 100 900;
          font-style: normal;
          src: url('${interData}') format('woff2');
        }
        @font-face {
          font-family: 'JetBrains Mono Variable';
          font-weight: 100 800;
          font-style: normal;
          src: url('${monoData}') format('woff2');
        }
      `,
    );
  }
  return cachedCss;
}
