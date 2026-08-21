// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url', () => ({
  default: '/fonts/inter.woff2',
}));
vi.mock('@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url', () => ({
  default: '/fonts/jetbrains-mono.woff2',
}));

let fetchMock: ReturnType<typeof vi.fn>;

/** A payload larger than the 32KB chunk the encoder splits on. */
function largeFontBytes(): ArrayBuffer {
  const bytes = new Uint8Array(0x8000 * 2 + 17);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
  return bytes.buffer;
}

beforeEach(() => {
  vi.resetModules();
  fetchMock = vi.fn(async () => ({ arrayBuffer: async () => largeFontBytes() }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getEmbeddedFontCss', () => {
  it('emits a face for each of the two poster typefaces', async () => {
    const { getEmbeddedFontCss } = await import('./embedFonts');

    const css = await getEmbeddedFontCss();

    expect(css).toContain("font-family: 'Inter Variable'");
    expect(css).toContain("font-family: 'JetBrains Mono Variable'");
    expect(css.match(/@font-face/g)).toHaveLength(2);
  });

  it('inlines the font data rather than pointing at a URL', async () => {
    const { getEmbeddedFontCss } = await import('./embedFonts');

    const css = await getEmbeddedFontCss();

    expect(css).toContain("url('data:font/woff2;base64,");
    expect(css).not.toContain('/fonts/inter.woff2');
  });

  // The encoder walks the buffer in 32KB chunks because String.fromCharCode
  // applied to a whole font file overflows the argument limit and throws.
  it('encodes a payload larger than one chunk', async () => {
    const { getEmbeddedFontCss } = await import('./embedFonts');

    const css = await getEmbeddedFontCss();
    const encoded = /base64,([^']+)'/.exec(css)?.[1] ?? '';

    expect(encoded.length).toBeGreaterThan(0);
    expect(atob(encoded).length).toBe(0x8000 * 2 + 17);
  });

  it('declares the full variable weight range', async () => {
    const { getEmbeddedFontCss } = await import('./embedFonts');

    const css = await getEmbeddedFontCss();

    expect(css).toContain('font-weight: 100 900');
    expect(css).toContain('font-weight: 100 800');
  });

  // Every export re-reads this; refetching two font files each time would add
  // avoidable latency to a button the user may press repeatedly.
  it('fetches each file once and reuses the result', async () => {
    const { getEmbeddedFontCss } = await import('./embedFonts');

    const first = await getEmbeddedFontCss();
    const second = await getEmbeddedFontCss();

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
