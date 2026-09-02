import { expect, test, type Page } from "@playwright/test";

/**
 * ヘッドレスブラウザには DeviceMotion センサーが存在しない。
 * したがってこのスイート全体が FR-020（ジャイロ非対応環境のフォールバック）の
 * 実環境での検証になっている。
 */

const ERROR_ALLOWLIST: RegExp[] = [];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (ERROR_ALLOWLIST.some((r) => r.test(message.text()))) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function drawOnce(page: Page): Promise<void> {
  const onReveal = await page.locator('[data-screen="reveal"][data-active="true"]').count();
  await page.click(onReveal > 0 ? "[data-shake-again]" : "[data-shake-button]");
  await expect(page.locator('[data-screen="reveal"][data-active="true"]')).toBeVisible({
    timeout: 5000,
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("待機画面が表示され、進捗が 0 / 12 で始まる（AC-17）", async ({ page }) => {
  await expect(page.locator('[data-screen="standby"][data-active="true"]')).toBeVisible();
  await expect(page.locator("[data-standby-progress]")).toHaveText("0 / 12");
  await expect(page.locator("[data-shake-label]")).toHaveText("振ってみる");
});

test("センサーが無くてもボタンひとつで抽選が成立する（AC-18 / FR-020）", async ({ page }) => {
  const errors = collectErrors(page);

  await page.click("[data-shake-button]");
  // FR-021 のプローブ（1200ms）を経てフォールバックへ降格する
  await expect(page.locator('[data-screen="reveal"][data-active="true"]')).toBeVisible({
    timeout: 5000,
  });

  await expect(page.locator("[data-reveal-art] svg")).toBeVisible();
  await expect(page.locator("[data-reveal-family-en]")).toHaveText(/FLOW|GRID|RADIAL|NOISE/);
  await expect(page.locator("[data-reveal-rarity]")).toHaveText(/COMMON|RARE|EPIC/);
  await expect(page.locator("[data-reveal-tilt]")).toContainText("センサーなし");
  await expect(page.locator("[data-reveal-index]")).toHaveText("№ 001");

  // 降格が UI に表れている（FR-302 / FR-053）
  await expect(page.locator("[data-shake-label]")).toHaveText("タップで引く");
  expect(errors).toEqual([]);
});

test("続けて引ける（AC-21）", async ({ page }) => {
  await drawOnce(page);
  await drawOnce(page);
  await expect(page.locator("[data-reveal-index]")).toHaveText("№ 002");
});

test("図鑑へ遷移し、引いた型が発見済みになる（AC-19 / AC-20）", async ({ page }) => {
  await drawOnce(page);
  const family = await page.locator("[data-reveal-family-en]").innerText();
  const rarity = await page.locator("[data-reveal-rarity]").innerText();

  await page.click('[data-screen="reveal"] [data-open-collection]');
  await expect(page.locator('[data-screen="collection"][data-active="true"]')).toBeVisible();
  await expect(page.locator("[data-collection-count]")).toHaveText("1 / 12");

  const cell = page.locator(`.family[data-family="${family}"] .cell[data-rarity="${rarity}"]`);
  await expect(cell).toHaveAttribute("data-state", "found");
  await expect(cell.locator("svg")).toBeVisible();

  // 残り 11 マスは未収集表示（破線 + ?）
  await expect(page.locator('.cell[data-state="locked"]')).toHaveCount(11);
  await expect(page.locator('.cell[data-state="locked"] .cell__unknown').first()).toHaveText("?");
});

test("空の図鑑でも 12 マスが崩れず描画される（FR-504）", async ({ page }) => {
  await page.click('[data-screen="standby"] [data-open-collection]');
  await expect(page.locator(".cell")).toHaveCount(12);
  await expect(page.locator('.cell[data-state="locked"]')).toHaveCount(12);
  await expect(page.locator(".family")).toHaveCount(4);
});

test("リロード後も図鑑が保持される（AC-22）", async ({ page }) => {
  await drawOnce(page);
  await page.reload();
  await expect(page.locator("[data-standby-progress]")).toHaveText("1 / 12");
});

test("未収集マスの破線枠が地色に埋もれず知覚できる（visual-qa / R6）", async ({ page }) => {
  await page.click('[data-screen="standby"] [data-open-collection]');
  const frame = page.locator('.cell[data-state="locked"] .cell__frame').first();

  const style = await frame.evaluate((el) => {
    const computed = getComputedStyle(el);
    return { style: computed.borderTopStyle, width: computed.borderTopWidth };
  });
  expect(style.style).toBe("dashed");
  expect(parseFloat(style.width)).toBeGreaterThan(0);

  // 「CSS に書いた」ではなく、実際に背景と違う色として出ていることを確かめる。
  // oklch/oklab で返る環境があるので文字列比較はせず、canvas に塗って実バイトを読む。
  const contrast = await frame.evaluate((el) => {
    const toRgb = (value: string): [number, number, number] => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (ctx === null) throw new Error("2d context が取れない");
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r ?? 0, g ?? 0, b ?? 0];
    };
    const luminance = ([r, g, b]: [number, number, number]): number => {
      const channel = (c: number): number => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const border = toRgb(getComputedStyle(el).borderTopColor);
    const page = toRgb(getComputedStyle(document.body).backgroundColor);
    const a = luminance(border);
    const b = luminance(page);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });

  // 非テキストの境界線として最低限識別できる比（WCAG 1.4.11 の 3:1 は装飾線には厳しいため、
  // ここでは「地に埋もれていない」ことの下限として 1.6 を置く）
  expect(contrast).toBeGreaterThan(1.6);
});

test("主要な幅で横スクロールが出ない（AC-25）", async ({ page }) => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });

    for (const step of ["standby", "reveal", "collection"] as const) {
      if (step === "reveal") await drawOnce(page);
      if (step === "collection") await page.click('[data-screen="reveal"] [data-open-collection]');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${step} @${width}px`).toBeLessThanOrEqual(0);
    }
    await page.click("[data-close-collection]");
  }
});

test("reduced-motion でアニメーションが無効になり、図版は見えたままになる（AC-26）", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await drawOnce(page);

  const art = page.locator("[data-reveal-art]");
  await expect(art).toBeVisible();

  const state = await art.evaluate((el) => {
    const computed = getComputedStyle(el);
    return { opacity: computed.opacity, duration: computed.animationDuration };
  });
  // アニメーションを止めた結果、図版が opacity:0 のまま消えていないこと
  expect(Number(state.opacity)).toBeGreaterThan(0.9);
  expect(parseFloat(state.duration)).toBeLessThan(0.01);
});

test("一連の操作でコンソールエラーが出ない（AC-27）", async ({ page }) => {
  const errors = collectErrors(page);

  await drawOnce(page);
  await drawOnce(page);
  await page.click('[data-screen="reveal"] [data-open-collection]');
  await page.click("[data-close-collection]");
  await page.click('[data-screen="standby"] [data-open-collection]');
  await page.click("[data-close-collection]");
  await page.reload();

  expect(errors).toEqual([]);
});
