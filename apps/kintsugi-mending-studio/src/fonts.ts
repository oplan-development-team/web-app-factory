import { CAPTIONS } from './captions';
import { VESSELS, VESSEL_ORDER } from './vessels';
import { GLAZES, GLAZE_ORDER } from './glaze';

/**
 * @fontsource ships CJK fonts split into dozens of unicode-range subset
 * files. Normal DOM text triggers the browser to fetch whichever subset
 * covers the characters actually laid out on the page, but <canvas>
 * fillText does NOT participate in that layout-driven loading — and
 * `document.fonts.load(font)` without a `text` argument only probes the
 * default (space-character) subset. The practical symptom: canvas text
 * silently drops specific kanji glyphs (they paint as blank space) on the
 * very first draw, even though the exact same string renders correctly in
 * DOM elsewhere on the page. Explicitly loading every family/weight with the
 * *exact* characters we will ever draw on canvas avoids that.
 */
const CANVAS_TEXT = [
  ...CAPTIONS,
  ...VESSEL_ORDER.map((id) => VESSELS[id].label),
  ...GLAZE_ORDER.map((id) => GLAZES[id].label),
  '形釉亀裂条継',
  '0123456789.',
].join('');

export async function ensureFontsReady(): Promise<void> {
  const specs: Array<[string, string]> = [
    ['400 16px "Shippori Mincho"', CANVAS_TEXT],
    ['600 16px "Shippori Mincho"', CANVAS_TEXT],
    ['700 16px "Shippori Mincho"', CANVAS_TEXT],
    ['400 16px "Zen Kaku Gothic New"', CANVAS_TEXT],
    ['500 16px "Zen Kaku Gothic New"', CANVAS_TEXT],
    ['700 16px "Zen Kaku Gothic New"', CANVAS_TEXT],
  ];
  try {
    await Promise.all(specs.map(([font, text]) => document.fonts.load(font, text)));
    await document.fonts.ready;
  } catch {
    // Font loading is a progressive enhancement here; if it fails the
    // browser default fallback still renders legible (if plainer) text.
  }
}
