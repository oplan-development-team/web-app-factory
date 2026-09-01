/**
 * Browser verification for SHOT SPLICE.
 *
 * Runs the real app against fixtures whose correct answer is known by
 * construction, then measures the things a screenshot cannot tell you:
 * contrast of hairlines, inherited line-height, tap target sizes, and whether
 * any viewport overflows horizontally.
 *
 * Usage: npm run build && npm run preview -- --port 4173 & node scripts/verify.mjs
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, devices, firefox, webkit } from 'playwright';

import { FIXTURE, makeFixtures } from './make-fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = join(here, 'artifacts', 'screens');
// 127.0.0.1 rather than localhost: the two resolve to different sockets when
// something else is already bound to one address family, and the engines do not
// agree on which they prefer — Firefox took IPv4 while Chromium took IPv6.
const BASE_URL = process.env.VERIFY_URL ?? 'http://127.0.0.1:4179/';

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

function luminance([r, g, b]) {
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const parseRgb = (value) =>
  (value.match(/-?[\d.]+/g) ?? []).slice(0, 3).map((n) => Math.round(Number(n)));

/** Flattens a possibly translucent colour over an opaque backdrop. */
function over(color, backdrop) {
  const parts = (color.match(/-?[\d.]+/g) ?? []).map(Number);
  const [r, g, b] = parts;
  const alpha = parts.length > 3 ? parts[3] : 1;
  return [r, g, b].map((c, i) => Math.round(c * alpha + backdrop[i] * (1 - alpha)));
}

async function loadFixtures(page, files) {
  await page.setInputFiles('input[type="file"]', files);
  await page.waitForFunction(() => document.querySelectorAll('.reel__shot').length === 3, null, {
    timeout: 15000,
  });
}

async function runDetection(page) {
  await page.getByRole('button', { name: '自動で合わせる' }).click();
  await page.waitForFunction(
    () => document.querySelector('.toolbar__progress')?.hasAttribute('hidden') === true,
    null,
    { timeout: 30000 },
  );
}

async function main() {
  mkdirSync(SHOTS_DIR, { recursive: true });
  const files = await makeFixtures();
  const browser = await chromium.launch();

  // ---- Functional pass on a phone-sized viewport --------------------------
  const context = await browser.newContext({
    ...devices['iPhone 14 Pro'],
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const external = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  page.on('request', (request) => {
    if (!request.url().startsWith(BASE_URL) && !request.url().startsWith('data:')) {
      external.push(request.url());
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(SHOTS_DIR, '01-empty.png'), fullPage: true });

  record(
    'empty state explains what to do',
    (await page.locator('.stage__placeholder-title').first().textContent())?.includes('準備'),
  );

  await loadFixtures(page, files);
  const bandSummary = await page.locator('.band__summary').textContent();
  record(
    `fixed band detected (header ${FIXTURE.headerHeight} / footer ${FIXTURE.footerHeight})`,
    bandSummary?.includes(`上端 ${FIXTURE.headerHeight}px`) &&
      bandSummary?.includes(`下端 ${FIXTURE.footerHeight}px`),
    bandSummary ?? '',
  );

  await runDetection(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS_DIR, '02-detected.png'), fullPage: true });

  // getComputedStyle reports oklab() here; rasterise before judging the hue.
  const railColours = await page.$$eval('.seam__rail', (nodes) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    return nodes.map((node) => {
      ctx.fillStyle = getComputedStyle(node, '::before').backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b];
    });
  });
  record(
    'seam rails settle on the matched tint',
    railColours.every(([r, , b]) => b > r),
    JSON.stringify(railColours),
  );

  const seams = await page.$$eval('.seam', (nodes) =>
    nodes.map((node) => ({
      overlap: Number(node.querySelector('.seam__value')?.textContent?.replace(/,/g, '')),
      grade: node.querySelector('.seam__grade')?.textContent,
      delta: node.querySelector('.seam__delta')?.textContent,
    })),
  );
  record(
    `overlaps detected exactly (${FIXTURE.overlaps.join(', ')})`,
    seams.length === 2 &&
      seams[0].overlap === FIXTURE.overlaps[0] &&
      seams[1].overlap === FIXTURE.overlaps[1],
    JSON.stringify(seams),
  );
  record(
    'both seams graded as pixel-identical',
    seams.every((s) => s.grade === '一致' && s.delta === 'Δ0.00'),
  );

  const expectedHeight =
    FIXTURE.headerHeight +
    FIXTURE.bodyHeight +
    FIXTURE.bodyHeight +
    FIXTURE.bodyHeight +
    FIXTURE.footerHeight -
    FIXTURE.overlaps[0] -
    FIXTURE.overlaps[1];
  const sizeText = await page.locator('.stage__size').textContent();
  record(
    `output size matches the model (${FIXTURE.width} x ${expectedHeight})`,
    sizeText?.replace(/,/g, '') === `${FIXTURE.width} × ${expectedHeight} px`,
    sizeText ?? '',
  );

  // ---- Seam sheet ---------------------------------------------------------
  await page.locator('.seam').first().click();
  await page.waitForSelector('.sheet:not([hidden])');
  await page.screenshot({ path: join(SHOTS_DIR, '03-sheet.png') });

  const loupeFill = await page.evaluate(() => {
    const frame = document.querySelector('.loupe');
    const canvas = document.querySelector('.loupe__canvas');
    return canvas.getBoundingClientRect().width / frame.getBoundingClientRect().width;
  });
  record(
    'seam crop fills the sheet width even for a narrow source',
    loupeFill > 0.9,
    `${(loupeFill * 100).toFixed(0)}%`,
  );

  const loupeBox = await page.locator('.loupe').boundingBox();
  await page.mouse.move(loupeBox.x + loupeBox.width / 2, loupeBox.y + loupeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(loupeBox.x + loupeBox.width / 2, loupeBox.y + loupeBox.height / 2 - 20);
  await page.mouse.up();
  const afterDrag = Number((await page.locator('.sheet__value').textContent()).replace(/,/g, ''));
  record(
    'dragging the crop upwards increases the overlap',
    afterDrag > FIXTURE.overlaps[0],
    `${FIXTURE.overlaps[0]} -> ${afterDrag}`,
  );

  const gradeAfterDrag = await page.locator('.sheet__grade').textContent();
  record(
    'grade stops claiming a match once the seam is dragged off',
    !gradeAfterDrag.startsWith('一致・') || !gradeAfterDrag.includes('Δ0.00'),
    gradeAfterDrag,
  );

  await page.getByRole('radio', { name: '差分' }).click();
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(SHOTS_DIR, '04-diff.png') });
  const diffStats = await page.$eval('.loupe__canvas', (canvas) => {
    const ctx = canvas.getContext('2d');
    const band = document.querySelector('.loupe__band');
    const ratio = canvas.width / canvas.getBoundingClientRect().width;
    const top = Math.round(Math.max(0, parseFloat(band.style.transform.match(/-?[\d.]+/)[0]) * ratio));
    const height = Math.min(canvas.height - top, Math.round(parseFloat(band.style.height) * ratio));
    const { data } = ctx.getImageData(0, top + 2, canvas.width, Math.max(1, height - 4));
    let max = 0;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.max(data[i], data[i + 1], data[i + 2]);
      max = Math.max(max, v);
      sum += v;
    }
    return { max, mean: sum / (data.length / 4) };
  });
  // The overlap was nudged off by the drag above, so the band must NOT be black.
  record('difference view reacts to a misaligned seam', diffStats.max > 20, JSON.stringify(diffStats));

  await page.getByRole('button', { name: 'この継ぎ目を再検出' }).click();
  await page.waitForTimeout(400);
  const restored = Number((await page.locator('.sheet__value').textContent()).replace(/,/g, ''));
  record('re-detecting a single seam restores the exact overlap', restored === FIXTURE.overlaps[0], String(restored));

  const diffAligned = await page.$eval('.loupe__canvas', (canvas) => {
    const ctx = canvas.getContext('2d');
    const band = document.querySelector('.loupe__band');
    const ratio = canvas.width / canvas.getBoundingClientRect().width;
    const top = Math.round(Math.max(0, parseFloat(band.style.transform.match(/-?[\d.]+/)[0]) * ratio));
    const height = Math.min(canvas.height - top, Math.round(parseFloat(band.style.height) * ratio));
    const { data } = ctx.getImageData(0, top + 2, canvas.width, Math.max(1, height - 4));
    let max = 0;
    for (let i = 0; i < data.length; i += 4) max = Math.max(max, data[i], data[i + 1], data[i + 2]);
    return max;
  });
  record('difference view goes black on a perfect seam', diffAligned <= 12, `max=${diffAligned}`);

  await page.getByRole('button', { name: '完了' }).click();
  await page.waitForSelector('.sheet[hidden]', { state: 'attached' });

  // ---- Export -------------------------------------------------------------
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.getByRole('button', { name: 'PNG保存' }).click(),
  ]);
  const savedAs = download.suggestedFilename();
  await download.saveAs(join(SHOTS_DIR, savedAs));
  record('PNG export produces a timestamped file', /^shot-splice-\d{8}-\d{6}\.png$/.test(savedAs), savedAs);

  // Read the IHDR chunk directly: loading the file back into the page would
  // trip the "no external requests" and "no console errors" assertions below.
  const png = readFileSync(join(SHOTS_DIR, savedAs));
  const exported = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  record(
    'exported PNG is full resolution',
    exported.width === FIXTURE.width && exported.height === expectedHeight,
    `${exported.width}x${exported.height}`,
  );

  // ---- Measured visual checks --------------------------------------------
  const measurements = await page.evaluate(() => {
    const cs = (node) => getComputedStyle(node);
    const pick = (selector) => document.querySelector(selector);
    const hairline = pick('.card');
    const seam = pick('.seam');
    const chunks = ['.btn', '.seam__grade', '.reel__index', '.reel__name', '.checkbox__text', '.band__field-label'];

    return {
      fonts: [...document.fonts].map((f) => ({ family: f.family, status: f.status })),
      bodyLineHeight: cs(document.body).lineHeight,
      bodyFontFamily: cs(document.body).fontFamily,
      cardBorder: hairline ? cs(hairline).borderTopColor : null,
      cardBackground: hairline ? cs(hairline).backgroundColor : null,
      appBackground: cs(document.body).backgroundColor,
      stageMask: cs(pick('.stage')).maskImage,
      stageMetaOpacity: cs(pick('.stage__meta')).opacity,
      stageBorder: cs(pick('.stage__frame')).borderTopColor,
      stageBackground: cs(pick('.stage__frame')).backgroundColor,
      seamTint: seam ? cs(seam).getPropertyValue('--seam-tint').trim() : null,
      seamRailColor: seam ? cs(seam.querySelector('.seam__rail'), '::before').backgroundColor : null,
      lineHeights: chunks.map((selector) => {
        const node = pick(selector);
        if (!node) return { selector, missing: true };
        const style = cs(node);
        return {
          selector,
          fontSize: parseFloat(style.fontSize),
          lineHeight:
            style.lineHeight === 'normal' ? 'normal' : parseFloat(style.lineHeight),
        };
      }),
      paddings: [...document.querySelectorAll('.card, .btn, .icon-btn, input, .seam, .segmented__btn, .status')]
        .map((node) => ({
          cls: node.className,
          padding: cs(node).padding,
          text: (node.textContent ?? '').trim().slice(0, 12),
        }))
        .filter((entry) => entry.padding === '0px' && entry.text.length > 0),
      taps: [...document.querySelectorAll('button, input, [role="switch"], [role="radio"]')]
        .filter((node) => node.offsetParent !== null || node.getClientRects().length > 0)
        .filter((node) => {
          // A control the pointer cannot reach is not a tap target; the label
          // or button that triggers it is, and those are measured on their own.
          const style = getComputedStyle(node);
          if (style.pointerEvents === 'none' || Number(style.opacity) === 0) return false;
          return !node.closest('.visually-hidden') && !node.classList.contains('visually-hidden');
        })
        .map((node) => {
          const rect = node.getBoundingClientRect();
          // A control may be smaller than 44px if it extends its own hit area.
          const after = getComputedStyle(node, '::after');
          const grown = after.content !== 'none' ? parseFloat(after.minHeight) || 0 : 0;
          return {
            cls: typeof node.className === 'string' ? node.className : '',
            label: node.getAttribute('aria-label') ?? (node.textContent ?? '').trim().slice(0, 10),
            w: Math.round(rect.width),
            h: Math.round(Math.max(rect.height, grown)),
          };
        })
        .filter((entry) => entry.w > 0),
      overflow: [...document.querySelectorAll('*')]
        .filter((node) => ['hidden', 'clip'].includes(getComputedStyle(node).overflow))
        .map((node) => (typeof node.className === 'string' ? node.className : ''))
        .filter(Boolean),
      scaleContrast: {
        title: parseFloat(cs(pick('.app__title')).fontSize),
        body: parseFloat(cs(pick('.app__tagline')).fontSize),
        readout: parseFloat(cs(pick('.seam__value')).fontSize),
        caption: parseFloat(cs(pick('.seam__caption')).fontSize),
      },
    };
  });

  record(
    'no web fonts are fetched (system stack only)',
    measurements.fonts.length === 0 && /-apple-system/.test(measurements.bodyFontFamily),
    measurements.bodyFontFamily,
  );
  record('no external network requests', external.length === 0, external.join(', '));

  const appBg = parseRgb(measurements.appBackground);
  const cardBg = over(measurements.cardBackground, appBg);
  const cardBorder = over(measurements.cardBorder, cardBg);
  const cardContrast = contrast(cardBorder, cardBg);
  record(
    'card hairline is perceivable against its own surface',
    cardContrast >= 1.4,
    `contrast ${cardContrast.toFixed(2)}`,
  );

  const stageBg = over(measurements.stageBackground, appBg);
  const stageBorder = over(measurements.stageBorder, stageBg);
  const stageContrast = contrast(stageBorder, stageBg);
  record(
    'stage frame border is perceivable',
    stageContrast >= 1.4,
    `contrast ${stageContrast.toFixed(2)}`,
  );

  record(
    'the stage fade is applied to its backdrop, not to its own text',
    measurements.stageMask === 'none' && measurements.stageMetaOpacity === '1',
    `mask=${measurements.stageMask} opacity=${measurements.stageMetaOpacity}`,
  );

  const leaked = measurements.lineHeights.filter(
    (entry) => !entry.missing && entry.lineHeight !== 'normal' && entry.lineHeight > entry.fontSize * 1.5,
  );
  record(
    'no body line-height leaked into UI chunks',
    leaked.length === 0,
    JSON.stringify(measurements.lineHeights),
  );

  record(
    'every content-bearing component has padding',
    measurements.paddings.length === 0,
    JSON.stringify(measurements.paddings),
  );

  const smallTaps = measurements.taps.filter((entry) => entry.h < 44 || entry.w < 44);
  record('all tap targets are at least 44px', smallTaps.length === 0, JSON.stringify(smallTaps));

  const scale = measurements.scaleContrast;
  record(
    'type scale has real contrast (title/readout vs caption)',
    scale.title / scale.caption >= 2.4 && scale.readout / scale.caption >= 1.8,
    JSON.stringify(scale),
  );

  // ---- Colour is a measurement, not decoration ---------------------------
  // getComputedStyle reports these as oklab(); rasterise them so the check runs
  // on the sRGB bytes a person actually sees.
  const tints = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.width = '4px';
    probe.style.height = '4px';
    document.body.append(probe);
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    const read = (percent) => {
      probe.style.backgroundColor = `color-mix(in oklab, var(--align) ${percent}%, var(--drift))`;
      ctx.fillStyle = getComputedStyle(probe).backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b];
    };
    const out = { drift: read(0), mid: read(50), align: read(100) };
    probe.remove();
    return out;
  });
  const [driftRgb, midRgb, alignRgb] = [tints.drift, tints.mid, tints.align];
  const hue = ([r, g, b]) => (b > r ? 'cool' : 'warm');
  record(
    'seam tint really interpolates amber -> cyan',
    hue(driftRgb) === 'warm' &&
      hue(alignRgb) === 'cool' &&
      midRgb.join() !== driftRgb.join() &&
      midRgb.join() !== alignRgb.join(),
    JSON.stringify(tints),
  );

  // ---- Long text ----------------------------------------------------------
  const longNameOverflow = await page.$$eval('.reel__name', (nodes) =>
    nodes.map((node) => ({
      overflowing: node.scrollWidth > node.clientWidth + 1,
      ellipsis: getComputedStyle(node).textOverflow,
    })),
  );
  record(
    'a very long file name truncates instead of breaking the row',
    longNameOverflow.every((entry) => !entry.overflowing || entry.ellipsis === 'ellipsis'),
    JSON.stringify(longNameOverflow),
  );

  record('no console errors during the whole flow', consoleErrors.length === 0, consoleErrors.join(' | '));

  await context.close();

  // ---- Width sweep, across engines ---------------------------------------
  const widths = [320, 375, 390, 428, 768, 1024, 1280];
  for (const [name, launcher] of [
    ['chromium', chromium],
    ['webkit', webkit],
    ['firefox', firefox],
  ]) {
    const engine = launcher === chromium ? browser : await launcher.launch();
    const overflows = [];
    for (const width of widths) {
      const ctx = await engine.newContext({ viewport: { width, height: 780 } });
      const p = await ctx.newPage();
      await p.goto(BASE_URL, { waitUntil: 'networkidle' });
      await loadFixtures(p, files);
      await runDetection(p);
      const offenders = await p.evaluate(() => {
        const doc = document.documentElement;
        if (doc.scrollWidth <= doc.clientWidth) return null;
        return [...document.querySelectorAll('*')]
          .filter((node) => node.getBoundingClientRect().right > doc.clientWidth + 1)
          .slice(0, 6)
          .map((node) => ({
            cls: typeof node.className === 'string' ? node.className : node.tagName,
            right: Math.round(node.getBoundingClientRect().right),
          }));
      });
      if (offenders) overflows.push({ width, offenders });
      if (name === 'chromium' && (width === 375 || width === 1280)) {
        await p.waitForTimeout(500);
        await p.screenshot({ path: join(SHOTS_DIR, `05-${width}.png`), fullPage: true });
      }
      await ctx.close();
    }
    record(`no horizontal overflow at any width (${name})`, overflows.length === 0, JSON.stringify(overflows));
    if (engine !== browser) await engine.close();
  }

  // ---- Reduced motion -----------------------------------------------------
  const rmContext = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 780 } });
  const rmPage = await rmContext.newPage();
  await rmPage.goto(BASE_URL, { waitUntil: 'networkidle' });
  await loadFixtures(rmPage, files);
  const durations = await rmPage.evaluate(() =>
    [...document.querySelectorAll('.reel__shot, .btn, .seam__bar-fill')].map((node) => ({
      animation: getComputedStyle(node).animationDuration,
      transition: getComputedStyle(node).transitionDuration,
    })),
  );
  record(
    'reduced motion disables animation',
    durations.every(
      (entry) =>
        entry.animation.split(',').every((d) => parseFloat(d) <= 0.002) &&
        entry.transition.split(',').every((d) => parseFloat(d) <= 0.002),
    ),
    JSON.stringify(durations.slice(0, 3)),
  );
  await rmContext.close();

  await browser.close();

  const failed = results.filter((entry) => !entry.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  console.log(`screenshots: ${SHOTS_DIR}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
