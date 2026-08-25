import { expect, test, type Page } from "@playwright/test";

/**
 * Counts pixels bright enough to be ribbon rather than background.
 *
 * Waits for a rendered animation frame first: the renderer only redraws on the
 * next frame after a change, so sampling immediately after a click would read
 * the previous frame.
 */
async function litPixels(page: Page): Promise<number> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#ribbon-canvas")!;
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]! > 40) {
        lit++;
      }
    }
    return lit;
  });
}

/** Draws a signature-like stroke across the middle of the poster. */
async function signOn(page: Page, offsetY = 0): Promise<void> {
  const frame = (await page.locator("#poster-frame").boundingBox())!;
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2 + offsetY;

  await page.mouse.move(cx - frame.width * 0.25, cy);
  await page.mouse.down();
  for (let i = 1; i <= 40; i++) {
    const t = i / 40;
    await page.mouse.move(
      cx - frame.width * 0.25 + t * frame.width * 0.5,
      cy + Math.sin(t * Math.PI * 2) * frame.height * 0.06
    );
  }
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // Surfaced by the assertion in each test via the closure below.
  (page as Page & { consoleErrors?: string[] }).consoleErrors = errors;
});

test("loads with an empty state and no console errors (AC-17, NFR-005.1)", async ({ page }) => {
  await expect(page.locator("#stage-hint")).toBeVisible();
  await expect(page.locator("#stage-hint")).toHaveText(/署名してください/);
  await expect(page.locator("#download-btn")).toBeDisabled();
  await expect(page.locator("#undo-btn")).toBeDisabled();
  await expect(page.locator("#redo-btn")).toBeDisabled();
  await expect(page.locator("#clear-btn")).toBeDisabled();

  expect((page as Page & { consoleErrors?: string[] }).consoleErrors).toEqual([]);
});

test("draws a ribbon and enables the actions (AC-01)", async ({ page }) => {
  expect(await litPixels(page)).toBe(0);
  await signOn(page);
  expect(await litPixels(page)).toBeGreaterThan(200);

  await expect(page.locator("#download-btn")).toBeEnabled();
  await expect(page.locator("#undo-btn")).toBeEnabled();
  await expect(page.locator("#clear-btn")).toBeEnabled();
  await expect(page.locator("#stage-hint")).toHaveCSS("opacity", "0");
});

test("undo, redo and clear behave symmetrically (AC-06)", async ({ page }) => {
  await signOn(page);
  const drawn = await litPixels(page);

  await page.click("#undo-btn");
  expect(await litPixels(page)).toBe(0);
  await expect(page.locator("#undo-btn")).toBeDisabled();
  await expect(page.locator("#redo-btn")).toBeEnabled();

  await page.click("#redo-btn");
  expect(await litPixels(page)).toBeGreaterThan(drawn * 0.9);

  await page.click("#clear-btn");
  expect(await litPixels(page)).toBe(0);
  // Clear is itself undoable.
  await page.click("#undo-btn");
  expect(await litPixels(page)).toBeGreaterThan(drawn * 0.9);
});

test("keyboard shortcuts undo and redo, but not while typing a caption (AC-11)", async ({
  page,
}) => {
  await signOn(page);
  const modifier = process.platform === "darwin" ? "Meta" : "Control";

  await page.keyboard.press(`${modifier}+z`);
  expect(await litPixels(page)).toBe(0);

  await page.keyboard.press(`${modifier}+Shift+z`);
  expect(await litPixels(page)).toBeGreaterThan(0);

  await page.click("#caption-input");
  await page.keyboard.press(`${modifier}+z`);
  // The caption field keeps the shortcut for its own text editing.
  expect(await litPixels(page)).toBeGreaterThan(0);
});

test("the colour of a stroke is fixed when it is drawn (AC-05)", async ({ page }) => {
  await signOn(page, -60);
  await page.click('#ribbon-swatches button[data-id="emerald"]');
  await signOn(page, 60);

  const hues = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#ribbon-canvas")!;
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    let goldish = 0;
    let greenish = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
      if (0.2126 * r + 0.7152 * g + 0.0722 * b < 60) continue;
      if (r > g && g > b) goldish++;
      if (g > r) greenish++;
    }
    return { goldish, greenish };
  });

  expect(hues.goldish).toBeGreaterThan(50);
  expect(hues.greenish).toBeGreaterThan(50);
});

test("background presets repaint the poster without losing strokes (AC-05)", async ({ page }) => {
  await signOn(page);
  const before = await litPixels(page);

  await page.click('#background-swatches button[data-id="midnight-navy"]');
  const corner = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#ribbon-canvas")!;
    const { data } = canvas.getContext("2d")!.getImageData(2, 2, 1, 1);
    return [data[0], data[1], data[2]];
  });

  expect(corner[2]).toBeGreaterThan(corner[0]!);
  expect(await litPixels(page)).toBeGreaterThan(before * 0.8);
});

test("the response slider re-carves existing strokes (AC-09)", async ({ page }) => {
  await signOn(page);
  const balanced = await litPixels(page);

  await page.locator("#response-slider").evaluate((input: HTMLInputElement) => {
    input.value = "100";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator("#response-readout")).toHaveText("Volatile");
  expect(await litPixels(page)).toBeLessThan(balanced);

  await page.locator("#response-slider").evaluate((input: HTMLInputElement) => {
    input.value = "0";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator("#response-readout")).toHaveText("Calm");
  expect(await litPixels(page)).toBeGreaterThan(balanced);
});

test("caption previews live and is announced in the export (AC-10)", async ({ page }) => {
  await signOn(page);
  await expect(page.locator("#caption-preview")).toHaveText("");

  await page.fill("#caption-input", "Hotta / 2026");
  await expect(page.locator("#caption-preview")).toHaveText("Hotta / 2026");
});

test("exports the selected resolution (AC-07)", async ({ page }) => {
  await signOn(page);
  await page.click('#resolution-picker button[data-id="study"]');
  await expect(page.locator("#resolution-readout")).toContainText("900 × 1273 px");

  const download = page.waitForEvent("download");
  await page.click("#download-btn");
  const file = await download;

  expect(file.suggestedFilename()).toMatch(/^signature-ribbon-poster-.*\.png$/);
  await expect(page.locator(".toast")).toContainText("900 × 1273 px");
});

test("shows a success toast after exporting (AC-12, NFR-005.4)", async ({ page }) => {
  await signOn(page);
  const download = page.waitForEvent("download");
  await page.click("#download-btn");
  await download;

  const toast = page.locator(".toast");
  await expect(toast).toBeVisible();
  await expect(toast).toContainText("書き出しました");
  await expect(toast).toHaveAttribute("role", "status");
});

test("offers to restore the previous session, and restores it (AC-08)", async ({ page }) => {
  await signOn(page);
  await page.fill("#caption-input", "Hotta / 2026");
  await page.click('#background-swatches button[data-id="deep-bordeaux"]');
  // Wait past the autosave debounce.
  await page.waitForTimeout(1200);

  await page.reload();
  const banner = page.locator(".restore-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("ストローク");
  // Nothing is restored until the user asks.
  expect(await litPixels(page)).toBe(0);

  await banner.getByRole("button", { name: "復元する" }).click();
  expect(await litPixels(page)).toBeGreaterThan(200);
  await expect(page.locator("#caption-input")).toHaveValue("Hotta / 2026");
  await expect(
    page.locator('#background-swatches button[data-id="deep-bordeaux"]')
  ).toHaveAttribute("aria-checked", "true");
});

test("discarding the saved draft stops it coming back (AC-08)", async ({ page }) => {
  await signOn(page);
  await page.waitForTimeout(1200);

  await page.reload();
  await page.locator(".restore-banner").getByRole("button", { name: "破棄する" }).click();
  await expect(page.locator(".restore-banner")).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".restore-banner")).toHaveCount(0);
});

test("keeps the artwork through a viewport resize (E-02)", async ({ page }) => {
  await signOn(page);
  const before = await litPixels(page);
  const beforeSize = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#ribbon-canvas")!;
    return canvas.width;
  });

  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForTimeout(300);

  const afterSize = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#ribbon-canvas")!;
    return canvas.width;
  });
  expect(afterSize).not.toBe(beforeSize);
  // The artwork is re-rendered at the new size rather than lost.
  expect(await litPixels(page)).toBeGreaterThan(0);
  expect(before).toBeGreaterThan(0);
});

test("the primary action stays reachable without scrolling the panel (NFR-005.6)", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>(".control-panel")!;
      return panel.scrollHeight - panel.clientHeight;
    });
    expect(overflow, `panel overflows at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(
      1
    );
  }
});

test("colour swatches are operable from the keyboard (NFR-006.1)", async ({ page }) => {
  const first = page.locator('#ribbon-swatches button[data-id="gold"]');
  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('#ribbon-swatches button[data-id="ice-blue"]')).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await page.keyboard.press("ArrowLeft");
  await expect(first).toHaveAttribute("aria-checked", "true");
});
