/**
 * Flow-level verification: the paths the main visual pass does not exercise.
 *
 * Covers the shot cap, drag-and-drop, unreadable files, the "no seam found"
 * branch, reordering, the band toggle, and the detection budget from NFR-011.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, devices } from 'playwright';

import { loadShots, runDetection, settle } from './harness.mjs';
import { makeFixtures, makeSeries, makeUnrelated } from './make-fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = join(here, 'artifacts', 'screens');
const BASE_URL = process.env.VERIFY_URL ?? 'http://127.0.0.1:4179/';
const MAX_SHOTS = 12;

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const rowCount = (page) => page.locator('.reel__shot').count();

async function fresh(browser) {
  const context = await browser.newContext({ ...devices['iPhone 14 Pro'], hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  return { context, page, errors };
}

/** Drops files onto the document the way a real drag does. */
async function dropFiles(page, paths) {
  const payload = paths.map((path) => ({
    name: basename(path),
    type: 'image/png',
    base64: readFileSync(path).toString('base64'),
  }));
  await page.evaluate(async (items) => {
    const transfer = new DataTransfer();
    for (const item of items) {
      const bytes = Uint8Array.from(atob(item.base64), (c) => c.charCodeAt(0));
      transfer.items.add(new File([bytes], item.name, { type: item.type }));
    }
    document.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: transfer }));
    document.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  }, payload);
}

async function main() {
  mkdirSync(SHOTS_DIR, { recursive: true });
  const browser = await chromium.launch();

  const trio = await makeFixtures();
  const overCap = await makeSeries({ count: MAX_SHOTS + 2, dir: join(here, 'artifacts', 'fixtures', 'cap') });
  const unrelated = await makeUnrelated();
  const heavy = await makeSeries({
    count: 5,
    width: 1179,
    bodyHeight: 2336,
    overlap: 600,
    dir: join(here, 'artifacts', 'fixtures', 'heavy'),
  });

  // ---- Drag and drop ------------------------------------------------------
  {
    const { context, page, errors } = await fresh(browser);
    await dropFiles(page, trio);
    await page.waitForFunction(() => document.querySelectorAll('.reel__shot').length === 3, null, {
      timeout: 20000,
    });
    await settle(page);
    record('drag and drop adds every dropped file (FR-002)', (await rowCount(page)) === 3);
    record(
      'the drop overlay clears itself afterwards',
      (await page.locator('.app').getAttribute('data-dragging')) === 'false',
    );
    record('no errors on the drop path', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---- Shot cap -----------------------------------------------------------
  {
    const { context, page } = await fresh(browser);
    await loadShots(page, overCap, MAX_SHOTS);
    const status = await page.locator('.status').textContent();
    record(`stops at ${MAX_SHOTS} shots (E-02)`, (await rowCount(page)) === MAX_SHOTS);
    record('and says why the rest were left out', status?.includes(`上限${MAX_SHOTS}枚`), status ?? '');
    await context.close();
  }

  // ---- Unreadable files ---------------------------------------------------
  {
    const { context, page } = await fresh(browser);
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]');
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array([0, 1, 2, 3])], 'broken.png', { type: 'image/png' }));
      transfer.items.add(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
      Object.defineProperty(input, 'files', { configurable: true, get: () => transfer.files });
      input.dispatchEvent(new Event('change'));
    });
    await page.waitForFunction(
      () => (document.querySelector('.status')?.textContent ?? '').includes('スキップ'),
      null,
      { timeout: 20000 },
    );
    const status = await page.locator('.status').textContent();
    record(
      'unreadable files are skipped by name, not silently (E-08)',
      status?.includes('broken.png') && status?.includes('notes.txt'),
      status ?? '',
    );
    record('and no shot is created from them', (await rowCount(page)) === 0);
    await context.close();
  }

  // ---- No seam to find ----------------------------------------------------
  {
    const { context, page } = await fresh(browser);
    await loadShots(page, unrelated);
    await runDetection(page);
    const status = await page.locator('.status').textContent();
    const seam = await page.locator('.seam__grade').first().textContent();
    record(
      'unrelated shots report no seam instead of inventing one (E-04)',
      status?.includes('見つかりませんでした') && seam === '未検出',
      `${status} / ${seam}`,
    );
    record(
      'and shows no delta for a measurement that was never taken',
      (await page.locator('.seam__delta').first().textContent()) === '',
    );
    record(
      'and the overlap is left at zero',
      (await page.locator('.seam__value').first().textContent()) === '0',
    );
    await page.screenshot({ path: join(SHOTS_DIR, '06-no-match.png'), fullPage: true });
    await context.close();
  }

  // ---- Reordering ---------------------------------------------------------
  {
    const { context, page } = await fresh(browser);
    await loadShots(page, trio);
    await runDetection(page);

    const namesBefore = await page.$$eval('.reel__name', (n) => n.map((x) => x.textContent));
    await page.locator('.reel__shot').first().getByRole('button', { name: 'ひとつ下へ移動' }).click();
    // Rendering is throttled to an animation frame, so the DOM lags the click.
    await page.waitForFunction(
      (first) => document.querySelector('.reel__name')?.textContent !== first,
      namesBefore[0],
      { timeout: 5000 },
    );
    const namesAfter = await page.$$eval('.reel__name', (n) => n.map((x) => x.textContent));
    record(
      'the move button reorders the reel (FR-006a)',
      namesAfter[0] === namesBefore[1] && namesAfter[1] === namesBefore[0],
      JSON.stringify(namesAfter.map((n) => n.slice(0, 8))),
    );
    record(
      'reordering drops the measurement for the pair that no longer exists',
      (await page.locator('.seam__grade').first().textContent()) === '未検出',
    );

    await page.locator('.reel__shot').nth(1).getByRole('button', { name: 'ひとつ上へ移動' }).click();
    await page.waitForFunction(
      (first) => document.querySelector('.reel__name')?.textContent === first,
      namesBefore[0],
      { timeout: 5000 },
    );
    record(
      'moving it back restores the original order',
      JSON.stringify(await page.$$eval('.reel__name', (n) => n.map((x) => x.textContent))) ===
        JSON.stringify(namesBefore),
    );
    record(
      'and the untouched pair kept its measurement',
      (await page.locator('.seam__grade').nth(1).textContent()) === '一致',
    );
    await context.close();
  }

  // ---- Band cut controls --------------------------------------------------
  {
    const { context, page } = await fresh(browser);
    await loadShots(page, trio);
    await runDetection(page);

    const heightOf = async () => {
      const text = await page.locator('.stage__size').textContent();
      return Number(text.match(/×\s([\d,]+)/)[1].replace(/,/g, ''));
    };
    const withBands = await heightOf();
    record('the detected cut is applied to the output', withBands === 1900, String(withBands));

    await page.locator('.switch').click();
    await settle(page);
    const withoutBands = await heightOf();
    record(
      'switching the cut off restores every trimmed row (FR-204)',
      withoutBands === withBands + 440,
      `${withBands} -> ${withoutBands}`,
    );

    await page.locator('.switch').click();
    await page.locator('.checkbox').click();
    await settle(page);
    const trimmedEnds = await heightOf();
    record(
      'trimming both ends removes the outer bands too (FR-206)',
      trimmedEnds === withBands - 220,
      `${withBands} -> ${trimmedEnds}`,
    );

    await page.locator('.checkbox').click();
    await settle(page);
    const header = page.locator('.stepper__input').first();
    await header.fill('40');
    await header.dispatchEvent('change');
    await settle(page);
    record(
      'a hand-edited band value is flagged and kept (FR-207)',
      (await page.locator('.band__drift').isVisible()) && (await header.inputValue()) === '40',
    );
    await page.getByRole('button', { name: '検出値に戻す' }).click();
    await settle(page);
    record('and can be restored to the detected value', (await header.inputValue()) === '88');
    await context.close();
  }

  // ---- Detection budget (NFR-011) ----------------------------------------
  {
    const { context, page } = await fresh(browser);
    await loadShots(page, heavy);
    const started = Date.now();
    await runDetection(page);
    const elapsed = Date.now() - started;
    const seams = await page.$$eval('.seam__value', (n) =>
      n.map((x) => Number(x.textContent.replace(/,/g, ''))),
    );
    record(
      'five full-resolution shots align within the 3s budget (NFR-011)',
      elapsed < 3000,
      `${elapsed}ms`,
    );
    record(
      'and every one of the four seams is exact',
      seams.length === 4 && seams.every((v) => v === 600),
      JSON.stringify(seams),
    );
    const sizeText = await page.locator('.stage__size').textContent();
    record('the large output reports its size', /1,179 ×/.test(sizeText ?? ''), sizeText ?? '');
    await page.screenshot({ path: join(SHOTS_DIR, '07-five-shots.png'), fullPage: true });
    await context.close();
  }

  await browser.close();
  const failed = results.filter((entry) => !entry.pass);
  console.log(`\n${results.length - failed.length}/${results.length} flow checks passed`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
