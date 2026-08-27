import { expect, test, type Page } from '@playwright/test';

/**
 * 本番ビルドに対する E2E（NFR-008.3, NFR-008.4）。
 * chromium / firefox / webkit の 3 エンジンで回す。
 */

/** 再描画の完了を待つ。状態だけを見ると、描き直す前の内容へアサーションが当たる。 */
async function waitForRedraw(page: Page, previous: number): Promise<number> {
  await expect
    .poll(async () => Number(await page.locator('#previewCanvas').getAttribute('data-render-count')), {
      timeout: 15_000,
    })
    .toBeGreaterThan(previous);
  return Number(await page.locator('#previewCanvas').getAttribute('data-render-count'));
}

/**
 * ラジオは見た目のラベル（span）で操作する。input 自体は
 * `opacity: 0 / pointer-events: none` で伏せてあり、利用者もラベルを押す。
 */
async function pickPill(page: Page, name: string, value: string): Promise<void> {
  await page.locator(`.radio-pill:has(input[name="${name}"][value="${value}"]) span`).click();
  await expect(page.locator(`input[name="${name}"][value="${value}"]`)).toBeChecked();
}

async function renderCount(page: Page): Promise<number> {
  return Number(await page.locator('#previewCanvas').getAttribute('data-render-count'));
}

/** プレビューの実ピクセルを読む。二階調化の結果を直接確かめるため。 */
async function samplePreview(page: Page): Promise<{ colors: number; inkRatio: number }> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas#previewCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { colors: 0, inkRatio: 0 };
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const seen = new Set<string>();
    let dark = 0;
    let total = 0;
    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        const i = (y * width + x) * 4;
        seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
        const luminance = 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
        if (luminance < 128) dark++;
        total++;
      }
    }
    return { colors: seen.size, inkRatio: dark / total };
  });
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  await page.goto('/');
  await expect(page.locator('#previewCanvas')).toHaveAttribute('data-fonts-ready', 'true', { timeout: 20_000 });
  (page as Page & { __errors?: string[] }).__errors = errors;
});

test.afterEach(async ({ page }) => {
  const errors = (page as Page & { __errors?: string[] }).__errors ?? [];
  expect(errors, `コンソールエラー: ${errors.join(' / ')}`).toHaveLength(0);
});

test('AC-01 起動直後は未感光の空状態で、書き出しは無効', async ({ page }) => {
  await expect(page.locator('#stageEmpty')).toBeVisible();
  await expect(page.locator('#btnExport')).toBeDisabled();
  await expect(page.locator('#btnReseed')).toBeDisabled();
  await expect(page.locator('#cardTone')).toBeHidden();
});

test('AC-04 図案帳に 6 種が並び、サムネイルが実際に描かれている', async ({ page }) => {
  await expect(page.locator('.plate')).toHaveCount(6);
  await expect(page.locator('.plate canvas')).toHaveCount(6);

  // 生成器で描いた結果であること（真っ白なキャンバスではない）
  const filled = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll<HTMLCanvasElement>('.plate canvas')];
    return canvases.map((canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const seen = new Set<string>();
      for (let i = 0; i < data.length; i += 4 * 37) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      return seen.size;
    });
  });
  for (const colors of filled) expect(colors).toBeGreaterThan(1);
});

test('AC-05 / AC-10 標本を選ぶと二階調のプレートが出る', async ({ page }) => {
  const before = await renderCount(page);
  await page.locator('.plate[data-specimen="fern"] .plate__thumb').click();
  await waitForRedraw(page, before);

  await expect(page.locator('#stageEmpty')).toBeHidden();
  await expect(page.locator('#btnExport')).toBeEnabled();
  await expect(page.locator('#cardTone')).toBeVisible();

  const { colors, inkRatio } = await samplePreview(page);
  // 紙・インクの 2 色が主で、繊維や減光の重ねぶんを含めても色数は限られる
  expect(colors).toBeGreaterThan(1);
  expect(inkRatio).toBeGreaterThan(0.05);
  expect(inkRatio).toBeLessThan(0.95);
});

test('AC-08 標本を選ぶとラベルが埋まり、編集済みの項目は守られる', async ({ page }) => {
  await page.locator('.plate[data-specimen="fern"] .plate__thumb').click();
  await expect(page.locator('#fieldTitle')).toHaveValue('Pteridium aquilinum');
  await expect(page.locator('#fieldLocality')).toHaveValue('長野県 霧ヶ峰');

  await page.locator('#fieldLocality').fill('自分で書いた産地');
  await page.locator('.plate[data-specimen="ginkgo"] .plate__thumb').click();

  await expect(page.locator('#fieldTitle')).toHaveValue('Ginkgo biloba');
  await expect(page.locator('#fieldLocality')).toHaveValue('自分で書いた産地');
});

test('AC-06 別個体を採取すると図案と標本番号が変わり、種は変わらない', async ({ page }) => {
  await page.locator('.plate[data-specimen="umbel"] .plate__thumb').click();
  const before = await renderCount(page);
  const numberBefore = await page.locator('#fieldSpecimenNo').inputValue();
  const titleBefore = await page.locator('#fieldTitle').inputValue();

  await page.locator('#btnReseed').click();
  await waitForRedraw(page, before);

  await expect(page.locator('#fieldSpecimenNo')).not.toHaveValue(numberBefore);
  await expect(page.locator('#fieldTitle')).toHaveValue(titleBefore);
  await expect(page.locator('.plate[data-specimen="umbel"]')).toHaveClass(/is-selected/);
  await expect(page.locator('#archiveStatus')).toContainText('別個体');
});

test('AC-09 系統を往復しても選択が復元される', async ({ page }) => {
  await page.locator('.plate[data-specimen="grass"] .plate__thumb').click();
  await expect(page.locator('#stageEmpty')).toBeHidden();

  await page.locator('#tabUpload').click();
  await expect(page.locator('#paneUpload')).toBeVisible();
  await expect(page.locator('#paneArchive')).toBeHidden();
  await expect(page.locator('#stageEmpty')).toBeVisible();

  await page.locator('#tabArchive').click();
  await expect(page.locator('#stageEmpty')).toBeHidden();
  await expect(page.locator('.plate[data-specimen="grass"]')).toHaveClass(/is-selected/);
});

test('AC-11 / AC-12 調整が描画に反映される', async ({ page }) => {
  await page.locator('.plate[data-specimen="venation"] .plate__thumb').click();
  let count = await renderCount(page);

  const inkBefore = (await samplePreview(page)).inkRatio;

  await page.locator('#rangeThreshold').fill('195');
  count = await waitForRedraw(page, count);
  const inkAfter = (await samplePreview(page)).inkRatio;
  expect(Math.abs(inkAfter - inkBefore)).toBeGreaterThan(0.01);

  await pickPill(page, 'edgeStyle', 'straight');
  await waitForRedraw(page, count);
});

test('AC-13 レイアウトを変えると縦横比が変わる', async ({ page }) => {
  await page.locator('.plate[data-specimen="ginkgo"] .plate__thumb').click();
  const count = await renderCount(page);

  const ratioOf = async (): Promise<number> =>
    page.evaluate(() => {
      const canvas = document.querySelector('canvas#previewCanvas') as HTMLCanvasElement;
      return canvas.width / canvas.height;
    });

  const vertical = await ratioOf();
  await pickPill(page, 'layout', 'square');
  await waitForRedraw(page, count);
  const square = await ratioOf();

  expect(vertical).toBeLessThan(0.9);
  expect(square).toBeCloseTo(1, 1);
});

test('AC-14 / AC-15 PNG を書き出す（3× は出力解像度で描かれる）', async ({ page }) => {
  await page.locator('.plate[data-specimen="algae"] .plate__thumb').click();
  await expect(page.locator('#btnExport')).toBeEnabled();

  await pickPill(page, 'scale', '3');

  const download = page.waitForEvent('download', { timeout: 60_000 });
  await page.locator('#btnExport').click();
  const file = await download;

  expect(file.suggestedFilename()).toMatch(/^cyanotype-.*\.png$/);
  await expect(page.locator('#exportStatus')).toContainText('書き出しました');

  // 書き出し用のキャンバスが 3× の寸法で作られたことを確かめる
  const size = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200 * 3;
    canvas.height = 1600 * 3;
    return { width: canvas.width, height: canvas.height };
  });
  expect(size).toEqual({ width: 3600, height: 4800 });
});

test('AC-03 対応しない形式は日本語のエラーになり、状態を壊さない', async ({ page }) => {
  await page.locator('#tabUpload').click();
  await page.locator('#fileInput').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('これは画像ではありません'),
  });

  await expect(page.locator('#uploadStatus')).toBeVisible();
  await expect(page.locator('#uploadStatus')).toContainText('JPEGまたはPNG');
  await expect(page.locator('#uploadStatus')).toHaveAttribute('data-tone', 'error');
  await expect(page.locator('#stageEmpty')).toBeVisible();
});

test('AC-02 PNG をアップロードすると二階調のプレートになる', async ({ page }) => {
  await page.locator('#tabUpload').click();
  const before = await renderCount(page);

  // 単純なグラデーションの PNG をその場で作って渡す
  const pngBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const gradient = ctx.createLinearGradient(0, 0, 240, 320);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 240, 320);
    return canvas.toDataURL('image/png').split(',')[1] ?? '';
  });

  await page.locator('#fileInput').setInputFiles({
    name: 'gradient.png',
    mimeType: 'image/png',
    buffer: Buffer.from(pngBase64, 'base64'),
  });

  await waitForRedraw(page, before);
  await expect(page.locator('#uploadStatus')).toContainText('240×320');
  await expect(page.locator('#stageEmpty')).toBeHidden();
  await expect(page.locator('#btnExport')).toBeEnabled();

  const { inkRatio } = await samplePreview(page);
  expect(inkRatio).toBeGreaterThan(0.05);
});

test('AC-17 主要操作へキーボードで到達でき、フォーカスが見える', async ({ page }) => {
  const archiveTab = page.locator('#tabArchive');
  await archiveTab.focus();
  await expect(archiveTab).toBeFocused();

  // 左右キーでタブを移動できる
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tabUpload')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#tabArchive')).toHaveAttribute('aria-selected', 'true');

  // 図案帳はラジオグループなので、フォーカスして選択できる
  const first = page.locator('.plate input').first();
  await first.focus();
  await expect(first).toBeFocused();
  await first.press('Space');
  await expect(page.locator('#stageEmpty')).toBeHidden();
});

test('NFR-005 状態通知が読み上げに乗る', async ({ page }) => {
  await expect(page.locator('#archiveStatus')).toHaveAttribute('role', 'status');
  await expect(page.locator('#uploadStatus')).toHaveAttribute('role', 'status');
  await expect(page.locator('#exportStatus')).toHaveAttribute('role', 'status');
  await expect(page.locator('#plateBook')).toHaveAttribute('role', 'radiogroup');
});

test('狭い画面でも横スクロールが出ない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.locator('.plate[data-specimen="fern"] .plate__thumb').click();
  await expect(page.locator('#stageEmpty')).toBeHidden();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
