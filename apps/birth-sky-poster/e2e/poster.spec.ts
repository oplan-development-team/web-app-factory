import { expect, test, type Page } from '@playwright/test';

/** Waits for the app to finish its first successful render. */
async function waitForChart(page: Page): Promise<void> {
  await expect(page.locator('#poster-frame')).toHaveAttribute('data-state', 'ready');
}

/** Reads the monotonic render counter the app publishes on the frame. */
async function renderCount(page: Page): Promise<number> {
  return Number((await page.locator('#poster-frame').getAttribute('data-render')) ?? '0');
}

/**
 * Runs an action and waits for the chart it triggers.
 *
 * Waiting on data-state alone is not enough: input is debounced, so the frame
 * is still showing the previous chart in the 'ready' state when the assertion
 * would run. The render counter distinguishes the two.
 */
async function afterRender(page: Page, action: () => Promise<void>): Promise<void> {
  const before = await renderCount(page);
  await action();
  await expect
    .poll(() => renderCount(page), { timeout: 5000 })
    .toBeGreaterThan(before);
}

async function open(page: Page): Promise<void> {
  await page.goto('/');
  await waitForChart(page);
}

/**
 * Clicks an editable poster text the way a person does: at a point inside its
 * box.
 *
 * Playwright's element click refuses here, because an SVG <text> only hit-tests
 * on its glyph outlines and the poster background sits under the gaps between
 * letters. The app handles this by delegating clicks at the SVG root, which a
 * real pointer event exercises and a synthetic element click does not.
 */
async function clickPosterText(page: Page, id: string): Promise<void> {
  // The point is computed with the page's own getBoundingClientRect rather
  // than locator.boundingBox(): WebKit reports an SVG <text> some 45px above
  // its true position through the latter, which would put the click outside
  // the field.
  const point = await page.evaluate((elementId) => {
    const node = document.getElementById(elementId);
    if (node === null) return null;
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, id);

  if (point === null) throw new Error(`#${id} was not found`);
  await page.mouse.click(point.x, point.y);
  await page.locator('input.inline-edit-input').waitFor();
}

test.describe('first load', () => {
  test('renders a chart from the seeded inputs (AC-01)', async ({ page }) => {
    await open(page);

    await expect(page.locator('svg.poster-root')).toBeVisible();
    expect(await page.locator('.stars circle').count()).toBeGreaterThan(100);
    await expect(page.locator('#poster-editable-title')).toHaveText('STAR CHART');
  });

  test('logs no console errors (AC-21)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

    await open(page);
    await page.waitForTimeout(500);

    expect(errors).toEqual([]);
  });

  // The whole privacy claim rests on this: nothing about the user's birth date
  // or location may leave the browser (NFR-001, AC-20).
  test('makes no request outside its own origin (AC-20)', async ({ page, baseURL }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      const isLocal =
        url.startsWith(baseURL ?? '') || url.startsWith('data:') || url.startsWith('blob:');
      if (!isLocal) external.push(url);
    });

    await open(page);
    await afterRender(page, () => page.locator('#input-lat').fill('51.5074'));

    expect(external).toEqual([]);
  });

  test('reserves the poster area so nothing shifts on first paint (AC-22)', async ({ page }) => {
    await page.goto('/');

    const before = await page.locator('#poster-frame').boundingBox();
    await waitForChart(page);
    const after = await page.locator('#poster-frame').boundingBox();

    expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);
    expect(after?.width).toBeCloseTo(before?.width ?? 0, 0);
  });
});

test.describe('recomputation', () => {
  test('follows a change of date through to the readouts (AC-02)', async ({ page }) => {
    await open(page);
    const before = await page.locator('.legend-value').nth(4).textContent();

    await afterRender(page, () => page.locator('#input-date').fill('1987-12-05'));

    await expect(page.locator('.legend-value').nth(4)).not.toHaveText(before ?? '');
    await expect(page.locator('#poster-editable-date')).toHaveText('1987.12.05');
  });

  test('reveals the southern sky below the equator (AC-03)', async ({ page }) => {
    await open(page);

    await page.locator('#input-lat').fill('-33.8688');
    await afterRender(page, () => page.locator('#input-lon').fill('151.2093'));

    await expect(page.locator('.star-label', { hasText: 'Canopus' }).first()).toBeVisible();
  });

  test('charts the pole without collapsing the star field (AC-06)', async ({ page }) => {
    await open(page);

    await afterRender(page, () => page.locator('#input-lat').fill('90'));

    const bearings = await page.locator('.stars circle').evaluateAll((nodes) => {
      const angles = nodes.map((node) => {
        const cx = Number(node.getAttribute('cx')) - 500;
        const cy = Number(node.getAttribute('cy')) - 596;
        return Math.round((Math.atan2(cy, cx) * 180) / Math.PI);
      });
      return new Set(angles).size;
    });

    // The previous azimuth formula degenerated to a single bearing here.
    expect(bearings).toBeGreaterThan(20);
  });

  test('keeps the sexagesimal readouts free of 60 (AC-07)', async ({ page }) => {
    await open(page);

    for (const [lat, lon] of [
      ['35.99999', '120.0166666'],
      ['-0.99999', '-179.99999'],
      ['0', '0'],
    ]) {
      await page.locator('#input-lat').fill(lat!);
      await afterRender(page, () => page.locator('#input-lon').fill(lon!));

      for (const value of await page.locator('.legend-value').allTextContents()) {
        expect(value).not.toMatch(/[:']60\b/);
      }
    }
  });

  test('keeps every constellation line inside the horizon circle (AC-08)', async ({ page }) => {
    await open(page);

    const outside = await page.locator('.constellation-lines line').evaluateAll((nodes) =>
      nodes.filter((node) => {
        const r = (x: string, y: string) =>
          Math.hypot(Number(node.getAttribute(x)) - 500, Number(node.getAttribute(y)) - 596);
        return r('x1', 'y1') > 323 || r('x2', 'y2') > 323;
      }).length,
    );

    expect(outside).toBe(0);
  });
});

test.describe('display toggles', () => {
  test('hides and restores the constellation lines (AC-09)', async ({ page }) => {
    await open(page);
    expect(await page.locator('.constellation-lines line').count()).toBeGreaterThan(0);

    await afterRender(page, () => page.locator('#input-constellations').uncheck());
    expect(await page.locator('.constellation-lines line').count()).toBe(0);

    await afterRender(page, () => page.locator('#input-constellations').check());
    expect(await page.locator('.constellation-lines line').count()).toBeGreaterThan(0);
  });

  test('hides the star names while keeping the dots (AC-10)', async ({ page }) => {
    await open(page);
    expect(await page.locator('.star-label').count()).toBeGreaterThan(0);

    await afterRender(page, () => page.locator('#input-star-names').uncheck());

    expect(await page.locator('.star-label').count()).toBe(0);
    expect(await page.locator('.stars circle').count()).toBeGreaterThan(100);
  });

  test('never overlaps two star labels (AC-11)', async ({ page }) => {
    await open(page);

    const overlaps = await page.locator('.star-label').evaluateAll((nodes) => {
      const boxes = nodes.map((node) => node.getBoundingClientRect());
      let count = 0;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
            count += 1;
          }
        }
      }
      return count;
    });

    expect(overlaps).toBe(0);
  });
});

test.describe('validation', () => {
  // Chromium refuses to put an impossible date such as 2026-02-31 into an
  // <input type="date"> at all, so the reachable way into the error state is
  // an empty required field. The impossible-date rule is a defence-in-depth
  // guard and is covered in src/ui/validation.test.ts instead.
  test('enters the error state and blocks export (AC-04)', async ({ page }) => {
    await open(page);

    await page.locator('#input-date').fill('');

    await expect(page.locator('#poster-frame')).toHaveAttribute('data-state', 'invalid');
    await expect(page.locator('#error-date')).toBeVisible();
    await expect(page.locator('#input-date')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#export-png')).toBeDisabled();
    await expect(page.locator('#export-svg')).toBeDisabled();
  });

  test('recovers as soon as the value is corrected (AC-05)', async ({ page }) => {
    await open(page);
    await page.locator('#input-lat').fill('999');
    await expect(page.locator('#poster-frame')).toHaveAttribute('data-state', 'invalid');

    await afterRender(page, () => page.locator('#input-lat').fill('35.6762'));

    await expect(page.locator('#error-lat')).toBeHidden();
    await expect(page.locator('#export-png')).toBeEnabled();
  });

  test('names the offending field rather than failing silently', async ({ page }) => {
    await open(page);

    await page.locator('#input-lon').fill('900');

    await expect(page.locator('#poster-overlay-list li')).toHaveCount(1);
    await expect(page.locator('#poster-overlay-list li')).toContainText('経度');
  });
});

test.describe('inline editing', () => {
  test('edits the title by mouse and keeps it across a re-render (AC-12)', async ({ page }) => {
    await open(page);

    await clickPosterText(page, 'poster-editable-title');
    await page.locator('input.inline-edit-input').fill('OUR FIRST NIGHT');
    await page.keyboard.press('Enter');
    await expect(page.locator('#poster-editable-title')).toHaveText('OUR FIRST NIGHT');

    await afterRender(page, () => page.locator('#input-lat').fill('51.5074'));

    await expect(page.locator('#poster-editable-title')).toHaveText('OUR FIRST NIGHT');
  });

  test('opens the editor from the keyboard (AC-13)', async ({ page }) => {
    await open(page);

    await page.locator('#poster-editable-place').focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('input.inline-edit-input')).toBeFocused();
  });

  test('discards an edit on Escape', async ({ page }) => {
    await open(page);

    await clickPosterText(page, 'poster-editable-title');
    await page.locator('input.inline-edit-input').fill('DISCARD ME');
    await page.keyboard.press('Escape');

    await expect(page.locator('#poster-editable-title')).toHaveText('STAR CHART');
    await expect(page.locator('input.inline-edit-input')).toHaveCount(0);
  });

  test('restores the generated wording on reset (AC-14)', async ({ page }) => {
    await open(page);
    await expect(page.locator('#reset-text')).toBeDisabled();

    await clickPosterText(page, 'poster-editable-title');
    await page.locator('input.inline-edit-input').fill('OUR FIRST NIGHT');
    await page.keyboard.press('Enter');
    await expect(page.locator('#reset-text')).toBeEnabled();

    await page.locator('#reset-text').click();

    await expect(page.locator('#poster-editable-title')).toHaveText('STAR CHART');
    await expect(page.locator('#reset-text')).toBeDisabled();
  });
});

test.describe('export', () => {
  test('saves a PNG at the selected resolution (AC-15)', async ({ page }) => {
    await open(page);
    await page.locator('#png-scale').selectOption('1');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#export-png').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^birth-sky-poster_.+\.png$/);

    const path = await download.path();
    const { readFileSync } = await import('node:fs');
    const bytes = readFileSync(path);

    // PNG signature, then IHDR width and height as big-endian 32-bit ints.
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    expect(bytes.readUInt32BE(16)).toBe(1000);
    expect(bytes.readUInt32BE(20)).toBe(1400);
  });

  test('saves an SVG with its fonts embedded (AC-16)', async ({ page }) => {
    await open(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#export-svg').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^birth-sky-poster_.+\.svg$/);

    const { readFileSync } = await import('node:fs');
    const source = readFileSync(await download.path(), 'utf8');

    expect(source).toContain('@font-face');
    expect(source).toContain('data:font/woff2;base64,');
    // Nothing in the saved file may point back at the network.
    expect(source).not.toMatch(/(?:src|href)=["']https?:/);
  });

  test('confirms the export in the status region (AC-17)', async ({ page }) => {
    await open(page);

    await Promise.all([page.waitForEvent('download'), page.locator('#export-svg').click()]);

    await expect(page.locator('#status-region')).toBeVisible();
    await expect(page.locator('#status-region')).toHaveText('SVGを書き出しました。');
    await expect(page.locator('#status-region')).toHaveAttribute('data-tone', 'success');
  });

  test('names the file after the place and the charted date', async ({ page }) => {
    await open(page);
    await page.locator('#input-place').fill('Reykjavik');
    await afterRender(page, () => page.locator('#input-date').fill('1987-12-05'));

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#export-svg').click(),
    ]);

    expect(download.suggestedFilename()).toBe('birth-sky-poster_reykjavik_19871205.svg');
  });
});

test.describe('geolocation', () => {
  test('fills the coordinates when permission is granted', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 64.1466, longitude: -21.9426 });
    await open(page);

    await page.locator('#geolocate-btn').click();

    await expect(page.locator('#input-lat')).toHaveValue('64.1466');
    await expect(page.locator('#input-lon')).toHaveValue('-21.9426');
    await expect(page.locator('#status-region')).toHaveAttribute('data-tone', 'success');
  });

  // The permission state itself is driven by the browser and differs per
  // engine in headless mode (Firefox leaves an unanswered prompt pending
  // indefinitely). What matters here is how the app reacts to a denial, so the
  // API is stubbed to deny deterministically.
  test('explains a denied permission and points at manual entry (AC-18)', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (
            _onSuccess: PositionCallback,
            onError?: PositionErrorCallback | null,
          ) => {
            onError?.({
              code: 1,
              message: 'denied',
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError);
          },
        },
      });
    });
    await open(page);
    const before = await page.locator('#input-lat').inputValue();

    await page.locator('#geolocate-btn').click();

    await expect(page.locator('#status-region')).toHaveAttribute('data-tone', 'error');
    await expect(page.locator('#status-region')).toContainText('手入力');
    await expect(page.locator('#input-lat')).toHaveValue(before);
    await expect(page.locator('#geolocate-btn')).toBeEnabled();
  });

  // A permission prompt the user never answers leaves getCurrentPosition
  // pending forever, because the spec excludes that wait from its own timeout.
  // The app applies its own deadline so the control comes back.
  test('recovers when the position request never settles', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: { getCurrentPosition: () => {} },
      });
    });
    await open(page);

    await page.locator('#geolocate-btn').click();
    await expect(page.locator('#geolocate-btn')).toBeDisabled();

    await expect(page.locator('#status-region')).toHaveAttribute('data-tone', 'error', {
      timeout: 25_000,
    });
    await expect(page.locator('#geolocate-btn')).toBeEnabled();
  });
});

test.describe('responsive layout', () => {
  for (const width of [320, 375, 768, 1024, 1440, 1920]) {
    test(`fits ${width}px without horizontal overflow (AC-19)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );

      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('accessibility', () => {
  // WebKit is excluded on purpose: Safari omits buttons and checkboxes from
  // the Tab sequence unless the user turns on "Press Tab to highlight each
  // item on a webpage". That is a browser preference, not something the page
  // can or should override. The focusability check below covers all engines.
  test('reaches every control by keyboard (NFR-005.2)', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari excludes buttons from Tab by default');
    await open(page);

    const reachable = new Set<string>();
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => document.activeElement?.id ?? '');
      if (id !== '') reachable.add(id);
    }

    for (const id of [
      'input-date',
      'input-time',
      'input-offset',
      'input-lat',
      'input-lon',
      'geolocate-btn',
      'input-place',
      'input-constellations',
      'input-star-names',
      'png-scale',
      'export-png',
      'export-svg',
    ]) {
      expect(reachable, `${id} should be reachable by Tab`).toContain(id);
    }
  });

  test('leaves every control focusable', async ({ page }) => {
    await open(page);

    for (const id of [
      'input-date',
      'input-time',
      'input-offset',
      'input-lat',
      'input-lon',
      'geolocate-btn',
      'input-place',
      'input-constellations',
      'input-star-names',
      'png-scale',
      'export-png',
      'export-svg',
      'poster-editable-title',
      'poster-editable-date',
      'poster-editable-place',
    ]) {
      await page.locator(`#${id}`).focus();
      expect(await page.evaluate(() => document.activeElement?.id), `#${id}`).toBe(id);
    }
  });

  test('renders numeric readouts in the monospace face (NFR-006.2)', async ({ page }) => {
    await open(page);

    const faces = await page.evaluate(() => {
      const familyOf = (selector: string) => {
        const node = document.querySelector(selector);
        return node === null ? '' : getComputedStyle(node).fontFamily;
      };
      return {
        legendValue: familyOf('.legend-value'),
        starLabel: familyOf('.star-label'),
        title: familyOf('.title-text'),
      };
    });

    expect(faces.legendValue).toContain('JetBrains Mono');
    expect(faces.starLabel).toContain('JetBrains Mono');
    expect(faces.title).toContain('Inter');
  });

  test('labels every input', async ({ page }) => {
    await open(page);

    const unlabelled = await page.locator('#input-form input').evaluateAll((nodes) =>
      nodes
        .filter((node) => node.ownerDocument.querySelector(`label[for="${node.id}"]`) === null)
        .map((node) => node.id),
    );

    expect(unlabelled).toEqual([]);
  });

  test('describes the poster for assistive technology (NFR-005.7)', async ({ page }) => {
    await open(page);

    const poster = page.locator('svg.poster-root');
    await expect(poster).toHaveAttribute('role', 'img');
    await expect(poster).toHaveAttribute('aria-label', /星図ポスター/);
  });
});
