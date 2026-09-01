/**
 * Generates screenshot fixtures with a known-good answer.
 *
 * One tall "page" is rendered once, then each shot is a window into it, so the
 * overlap between consecutive shots is exact by construction rather than
 * approximated. An identical header and footer are stamped onto every shot to
 * exercise the fixed-band detector.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
export const OUT_DIR = join(here, 'artifacts', 'fixtures');

export const FIXTURE = {
  width: 390,
  bodyHeight: 700,
  headerHeight: 88,
  footerHeight: 132,
  starts: [0, 520, 980],
  overlaps: [180, 240],
};

const PAGE_SCRIPT = ({ width, bodyHeight, headerHeight, footerHeight, starts }) => {
  const totalHeight = starts[starts.length - 1] + bodyHeight;

  let seed = 20260901;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // The tall source page: every row is visually distinct so a seam can only
  // match at one offset.
  const page = document.createElement('canvas');
  page.width = width;
  page.height = totalHeight;
  const pctx = page.getContext('2d');
  pctx.fillStyle = '#f6f7fb';
  pctx.fillRect(0, 0, width, totalHeight);
  for (let y = 0; y < totalHeight; y += 1) {
    pctx.fillStyle = `hsl(${Math.floor(rand() * 360)} 45% ${55 + Math.floor(rand() * 30)}%)`;
    const x = Math.floor(rand() * width * 0.5);
    pctx.fillRect(x, y, Math.floor(rand() * width * 0.5) + 4, 1);
  }
  pctx.fillStyle = '#1b1f2a';
  pctx.font = '600 26px sans-serif';
  for (let i = 0; i * 140 < totalHeight; i += 1) {
    pctx.fillText(`SECTION ${String(i).padStart(2, '0')}`, 18, i * 140 + 40);
  }

  const header = document.createElement('canvas');
  header.width = width;
  header.height = headerHeight;
  const hctx = header.getContext('2d');
  hctx.fillStyle = '#10131c';
  hctx.fillRect(0, 0, width, headerHeight);
  hctx.fillStyle = '#ffffff';
  hctx.font = '600 15px sans-serif';
  hctx.fillText('9:41', 20, 34);
  hctx.fillText('FIXED HEADER', 20, 68);

  const footer = document.createElement('canvas');
  footer.width = width;
  footer.height = footerHeight;
  const fctx = footer.getContext('2d');
  fctx.fillStyle = '#10131c';
  fctx.fillRect(0, 0, width, footerHeight);
  fctx.fillStyle = '#8fd8e0';
  for (let i = 0; i < 4; i += 1) {
    fctx.fillRect(24 + i * 88, 40, 56, 56);
  }

  return starts.map((start) => {
    const shot = document.createElement('canvas');
    shot.width = width;
    shot.height = headerHeight + bodyHeight + footerHeight;
    const ctx = shot.getContext('2d');
    ctx.drawImage(header, 0, 0);
    ctx.drawImage(page, 0, start, width, bodyHeight, 0, headerHeight, width, bodyHeight);
    ctx.drawImage(footer, 0, headerHeight + bodyHeight);
    return shot.toDataURL('image/png');
  });
};

export async function makeFixtures() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('about:blank');
  const dataUrls = await page.evaluate(PAGE_SCRIPT, FIXTURE);
  await browser.close();

  mkdirSync(OUT_DIR, { recursive: true });
  const names = [
    'shot-1.png',
    'shot-2.png',
    'shot-3-with-an-unusually-long-file-name-to-test-truncation.png',
  ];
  const paths = dataUrls.map((url, i) => {
    const file = join(OUT_DIR, names[i]);
    writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    return file;
  });
  return paths;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  makeFixtures().then((paths) => {
    for (const path of paths) console.log(path);
  });
}
