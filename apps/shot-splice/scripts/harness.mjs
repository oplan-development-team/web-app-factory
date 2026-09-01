/** Shared browser-driving helpers for the verification scripts. */

/** Waits for two animation frames, so the last state change has been painted. */
export async function settle(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
      }),
  );
}

/**
 * Clicks "align everything" and waits for the run to actually finish.
 *
 * The progress indicator is watched with a MutationObserver installed *before*
 * the click rather than by polling. Polling loses both ends of the race: the
 * busy flag is set synchronously but painted a frame later, so an immediate
 * poll sees the idle DOM and returns at once, and a short run can flip on and
 * off between two polls. Neither failure is visible in the results — every
 * assertion downstream just reads pre-detection values.
 */
export async function runDetection(page, { timeout = 60000 } = {}) {
  await page.evaluate(() => {
    const node = document.querySelector('.toolbar__progress');
    window.__busySeen = false;
    window.__busyObserver?.disconnect();
    window.__busyObserver = new MutationObserver(() => {
      if (!node.hasAttribute('hidden')) window.__busySeen = true;
    });
    window.__busyObserver.observe(node, { attributes: true, attributeFilter: ['hidden'] });
  });

  await page.getByRole('button', { name: '自動で合わせる' }).click();
  await page.waitForFunction(
    () =>
      window.__busySeen === true &&
      document.querySelector('.toolbar__progress')?.hasAttribute('hidden') === true,
    null,
    { timeout },
  );
  await settle(page);
}

export async function loadShots(page, files, expected) {
  await page.setInputFiles('input[type="file"]', files);
  await page.waitForFunction(
    (count) => document.querySelectorAll('.reel__shot').length === count,
    expected ?? files.length,
    { timeout: 60000 },
  );
  await settle(page);
}
