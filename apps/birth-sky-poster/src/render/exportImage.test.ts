// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportPngFile, exportSvgFile } from './exportImage';
import { POSTER_H, POSTER_W } from './layout';
import { COLORS } from './tokens';
import { svgEl, svgText } from './svg-utils';

vi.mock('./embedFonts', () => ({
  getEmbeddedFontCss: () => Promise.resolve('@font-face { font-family: "Inter Variable"; }'),
}));

interface DownloadRecord {
  filename: string;
  blob: Blob;
}

let downloads: DownloadRecord[];
let objectUrls: { created: number; revoked: number };
let fillStyles: string[];
let toBlobResult: Blob | null;
let imageShouldFail: boolean;
let lastCanvas: HTMLCanvasElement | null;
let createdBlobs: Blob[];

/** The most recent blob handed to URL.createObjectURL. */
function lastBlob(): Blob {
  const blob = createdBlobs.at(-1);
  if (blob === undefined) throw new Error('No blob was created.');
  return blob;
}

function buildPoster(): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: `0 0 ${POSTER_W} ${POSTER_H}`, class: 'poster-root' });
  const style = svgEl('style');
  style.textContent = '.poster-bg { fill: #f1efe7; }';
  svg.appendChild(style);
  svg.appendChild(
    svgText(64, 108, 'STAR CHART', {
      id: 'poster-editable-title',
      class: 'editable',
      tabindex: '0',
      role: 'button',
      'aria-label': 'STAR CHART（クリックまたはEnterで編集）',
    }),
  );
  return svg;
}

beforeEach(() => {
  downloads = [];
  objectUrls = { created: 0, revoked: 0 };
  fillStyles = [];
  toBlobResult = new Blob(['png-bytes'], { type: 'image/png' });
  imageShouldFail = false;
  lastCanvas = null;

  createdBlobs = [];
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: (blob: Blob) => {
      objectUrls.created += 1;
      createdBlobs.push(blob);
      return `blob:test/${objectUrls.created}`;
    },
    revokeObjectURL: () => {
      objectUrls.revoked += 1;
    },
  });

  // jsdom never loads images; resolve or reject as the test asks.
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => (imageShouldFail ? this.onerror?.() : this.onload?.()));
      }
    },
  );

  // jsdom has no canvas implementation, so stand in for the parts used here.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    lastCanvas = this;
    return {
      set fillStyle(value: string) {
        fillStyles.push(value);
      },
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(toBlobResult);
  });

  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ filename: this.download, blob: new Blob() });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('exportSvgFile', () => {
  it('downloads under the requested filename', async () => {
    await exportSvgFile(buildPoster(), 'birth-sky-poster_tokyo_20260821.svg');

    expect(downloads.map((d) => d.filename)).toEqual(['birth-sky-poster_tokyo_20260821.svg']);
  });

  it('leaves no object URL behind', async () => {
    await exportSvgFile(buildPoster(), 'chart.svg');

    expect(objectUrls.created).toBe(objectUrls.revoked);
  });

  // Without the inlined faces the file falls back to a system font wherever it
  // is opened, silently losing the typography the design rests on (FR-008.1).
  it('inlines the font faces so the file stands alone', async () => {
    await exportSvgFile(buildPoster(), 'chart.svg');

    expect(await lastBlob().text()).toContain('@font-face');
  });

  it('declares the SVG namespace and an XML prolog', async () => {
    await exportSvgFile(buildPoster(), 'chart.svg');
    const source = await lastBlob().text();

    expect(source.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(source).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  // The editing affordances exist for the live page; carrying role="button"
  // into a saved artwork file would misdescribe it to anything reading it.
  it('strips the inline-editing affordances from the saved file', async () => {
    await exportSvgFile(buildPoster(), 'chart.svg');
    const source = await lastBlob().text();

    expect(source).toContain('STAR CHART');
    expect(source).not.toContain('role="button"');
    expect(source).not.toContain('tabindex');
  });

  it('does not mutate the live poster', async () => {
    const poster = buildPoster();

    await exportSvgFile(poster, 'chart.svg');

    expect(poster.querySelector('text.editable')?.getAttribute('role')).toBe('button');
  });
});

describe('exportPngFile', () => {
  it.each([
    [1, POSTER_W, POSTER_H],
    [2, POSTER_W * 2, POSTER_H * 2],
    [4, POSTER_W * 4, POSTER_H * 4],
  ])('rasterizes at %ix into a %ix%i canvas', async (scale, width, height) => {
    await exportPngFile(buildPoster(), 'chart.png', scale);

    expect(lastCanvas?.width).toBe(width);
    expect(lastCanvas?.height).toBe(height);
  });

  // A transparent poster prints as a black rectangle on many consumer drivers.
  it('paints an opaque paper ground before drawing', async () => {
    await exportPngFile(buildPoster(), 'chart.png', 1);

    expect(fillStyles).toContain(COLORS.paper);
  });

  it('downloads the encoded image', async () => {
    await exportPngFile(buildPoster(), 'chart.png', 2);

    expect(downloads.map((d) => d.filename)).toEqual(['chart.png']);
  });

  it('releases the object URL even when rasterizing fails', async () => {
    imageShouldFail = true;

    await expect(exportPngFile(buildPoster(), 'chart.png', 1)).rejects.toThrow(/画像化に失敗/);
    expect(objectUrls.created).toBe(objectUrls.revoked);
  });

  // Canvas area limits vary by browser and device; 4x is the size that hits
  // them, so the message has to name the way out (FR-008.7).
  it('explains how to recover when the canvas is too large to encode', async () => {
    toBlobResult = null;

    await expect(exportPngFile(buildPoster(), 'chart.png', 4)).rejects.toThrow(
      /解像度を下げて/,
    );
    expect(downloads).toHaveLength(0);
  });

  it('reports a missing 2D context rather than throwing a null error', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    await expect(exportPngFile(buildPoster(), 'chart.png', 1)).rejects.toThrow(/Canvas/);
  });
});
