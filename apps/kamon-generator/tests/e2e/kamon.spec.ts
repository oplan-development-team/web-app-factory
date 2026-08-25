import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * 本番ビルドに当てる E2E。Chromium / Firefox / WebKit の 3 種で走らせる。
 * Chromium だけ緑でも、SVG のヒット判定やフォントの実測差で他の 2 種が壊れることが
 * あるため、クリック対象・可視判定はブラウザ差の出にくい形に寄せている。
 */

const STAGE = "#crest-stage";

/**
 * 2 つの欄を続けて埋めると、1 欄目だけの種で一度 ready になってから
 * 2 欄目の種で割り出し直す。`data-state` だけを見ると途中の紋を掴むので、
 * キャプションが目的の種を指すところまで待つ。
 */
async function seed(page: Page, name: string, birthday = ""): Promise<void> {
  await page.fill("#input-name", name);
  if (birthday) await page.fill("#input-birthday", birthday);

  const expected = [name, birthday].filter((v) => v.length > 0).join(" / ");
  await expect(page.locator("#crest-seed")).toContainText(expected);
  await expect(page.locator(STAGE)).toHaveAttribute("data-state", "ready");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("空状態から割り出しを経て紋が立ち上がる (AC-12)", async ({ page }) => {
  await expect(page.locator(STAGE)).toHaveAttribute("data-state", "empty");
  await expect(page.locator(".stage-note-empty")).toBeVisible();
  await expect(page.locator("#crest-caption")).toBeHidden();

  /*
   * drafting は 260ms しか出ないので、「その瞬間に見えているか」を 2 度に分けて
   * 問い合わせると取りこぼす。属性の変化そのものを記録して並びで確かめる。
   */
  await page.evaluate(() => {
    const stage = document.querySelector("#crest-stage");
    if (stage === null) throw new Error("表示面が無い");
    const seen: string[] = [];
    Object.assign(window, { __states: seen });
    new MutationObserver(() => {
      const state = stage.getAttribute("data-state") ?? "";
      if (seen.at(-1) !== state) seen.push(state);
    }).observe(stage, { attributes: true, attributeFilter: ["data-state"] });
  });

  await page.fill("#input-name", "水野 蒼");
  await expect(page.locator(STAGE)).toHaveAttribute("data-state", "ready");

  const states = await page.evaluate(
    () => (window as unknown as { __states: string[] }).__states,
  );
  expect(states).toEqual(["drafting", "ready"]);

  await expect(page.locator("#crest-name")).not.toBeEmpty();
  await expect(page.locator("#crest-mount svg")).toBeVisible();
  await expect(page.locator("#crest-caption")).toBeVisible();
});

test("割り出し中は作図線と文言が出る (FR-500)", async ({ page }) => {
  await page.fill("#input-name", "水野 蒼");

  /*
   * 入力のデバウンス 200ms のあとに割り出しが 260ms 出る。待ってから読むと
   * その間に ready へ抜けることがあるので、「drafting のあいだに読めたら返す」を
   * 1 つの評価にまとめて、観測を不可分にする。
   */
  interface DraftShot {
    noteShown: boolean;
    guideCircles: number;
  }

  const handle = await page.waitForFunction<DraftShot | null>(() => {
    const stage = document.querySelector("#crest-stage");
    if (stage?.getAttribute("data-state") !== "drafting") return null;
    const note = document.querySelector(".stage-note-drafting");
    return {
      noteShown: note !== null && getComputedStyle(note).display !== "none",
      guideCircles: document.querySelectorAll("#crest-mount circle").length,
    };
  });
  const shot = await handle.jsonValue();

  expect(shot?.noteShown).toBe(true);
  expect(shot?.guideCircles).toBeGreaterThan(0);
});

test("同じ種からは何度開いても同じ紋になる (AC-01)", async ({ page }) => {
  await seed(page, "水野 蒼", "1998-04-12");
  const first = await page.locator("#crest-mount svg").innerHTML();
  const name = await page.locator("#crest-name").textContent();

  await page.reload();
  await seed(page, "水野 蒼", "1998-04-12");
  expect(await page.locator("#crest-mount svg").innerHTML()).toBe(first);
  expect(await page.locator("#crest-name").textContent()).toBe(name);
});

test("色目を変えても紋の幾何は変わらない (AC-13)", async ({ page }) => {
  await seed(page, "水野 蒼");
  const paths = await page.locator("#crest-mount path").evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute("d")),
  );

  await page.click('.palette-swatch[data-palette-id="kon"]');
  const after = await page.locator("#crest-mount path").evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute("d")),
  );
  expect(after).toEqual(paths);
  await expect(page.locator('.palette-swatch[data-palette-id="kon"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("「次の紋へ」を連打しても表示が壊れず、図版帖に順に積まれる (AC-14)", async ({ page }) => {
  await seed(page, "水野 蒼");
  for (let i = 0; i < 10; i += 1) await page.click("#next-crest-btn");

  await expect(page.locator(STAGE)).toHaveAttribute("data-state", "ready");
  await expect(page.locator(".plate-item")).toHaveCount(11);
  await expect(page.locator(".plate-item .plate-no").first()).toHaveText("11");
  await expect(page.locator(".plate-item .plate-no").last()).toHaveText("01");
  await expect(page.locator('.plate-item[aria-current="true"]')).toHaveCount(1);
});

test("図版帖から選び直しても件数が増えない (AC-15)", async ({ page }) => {
  await seed(page, "水野 蒼");
  await expect(page.locator(".plate-item")).toHaveCount(1);
  await page.locator(".plate-item").first().click();
  await expect(page.locator(".plate-item")).toHaveCount(1);
  await expect(page.locator("#input-name")).toHaveValue("水野 蒼");
});

test("再読み込みしても図版帖と紋が復元される (AC-16)", async ({ page }) => {
  await seed(page, "水野 蒼");
  await page.click("#next-crest-btn");
  await expect(page.locator(".plate-item")).toHaveCount(2);
  const names = await page.locator(".plate-name").allTextContents();

  await page.reload();
  await expect(page.locator(".plate-item")).toHaveCount(2);
  expect(await page.locator(".plate-name").allTextContents()).toEqual(names);

  await page.locator(".plate-item").first().click();
  await expect(page.locator("#crest-name")).toHaveText(names[0] ?? "");
});

test("帳を空にすると、再読み込み後も空である (AC-19)", async ({ page }) => {
  await seed(page, "水野 蒼");
  await expect(page.locator("#clear-book-btn")).toBeVisible();

  await page.click("#clear-book-btn");
  await expect(page.locator("#clear-book-confirm")).toBeVisible();
  await expect(page.locator("#clear-book-btn")).toBeHidden();

  await page.click("#clear-book-yes");
  await expect(page.locator(".plate-item")).toHaveCount(0);
  await expect(page.locator("#plate-book-empty")).toBeVisible();
  await expect(page.locator(STAGE)).toHaveAttribute("data-state", "empty");

  await page.reload();
  await expect(page.locator(".plate-item")).toHaveCount(0);
});

test("SVG を書き出せる (AC-20 / AC-22)", async ({ page }) => {
  await seed(page, "水野 蒼");

  const alerts: string[] = [];
  page.on("dialog", (d) => {
    alerts.push(d.message());
    void d.dismiss();
  });

  const download = page.waitForEvent("download");
  await page.click("#export-svg-btn");
  const file = await download;

  expect(file.suggestedFilename()).toMatch(/^kamon-.+\.svg$/);
  await expect(page.locator("#status-region")).toContainText("書き出しました");
  await expect(page.locator("#status-region")).toHaveAttribute("data-tone", "success");
  expect(alerts).toEqual([]);
});

test("PNG を 1200×1200 の地色つきで書き出せる (AC-21)", async ({ page }) => {
  await seed(page, "水野 蒼");

  const download = page.waitForEvent("download");
  await page.click("#export-png-btn");
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^kamon-.+\.png$/);

  // PNG の IHDR から幅と高さを読む（外部ライブラリを使わずに寸法を確かめる）
  const buffer = readFileSync(await file.path());
  expect(buffer.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(buffer.readUInt32BE(16)).toBe(1200);
  expect(buffer.readUInt32BE(20)).toBe(1200);
});

test("成功の通知は時間で消える (FR-501.3)", async ({ page }) => {
  await seed(page, "水野 蒼");
  const download = page.waitForEvent("download");
  await page.click("#export-svg-btn");
  await download;

  await expect(page.locator("#status-region")).toContainText("書き出しました");
  await expect(page.locator("#status-region")).toBeEmpty({ timeout: 6000 });
});

test("操作要素はすべてキーボードで到達できる形をしている (AC-23 / FR-600)", async ({ page }) => {
  await seed(page, "水野 蒼");

  // tabindex="-1" や div ボタンが紛れていないことを構造として確かめる。
  // WebKit は macOS の既定でボタンへ Tab しないため、実際の Tab 送りは別のテストで見る
  const controls = await page.locator("#app button, #app input").evaluateAll((nodes) =>
    nodes
      .filter((n) => !(n as HTMLElement).hidden && (n as HTMLElement).offsetParent !== null)
      .map((n) => ({
        tag: n.tagName,
        tabindex: n.getAttribute("tabindex"),
        disabled: (n as HTMLButtonElement).disabled === true,
      })),
  );

  expect(controls.length).toBeGreaterThan(6);
  for (const control of controls) {
    expect(["BUTTON", "INPUT"]).toContain(control.tag);
    expect(control.tabindex).not.toBe("-1");
    expect(control.disabled).toBe(false);
  }
});

test("Tab だけで入力から書き出しまで到達できる (AC-23)", async ({ page, browserName }) => {
  // WebKit は macOS の「キーボードナビゲーション」既定に従い、ボタンへ Tab で移らない
  test.skip(browserName === "webkit", "WebKit の既定ではボタンが Tab の対象にならない");

  await seed(page, "水野 蒼");
  await page.locator("#input-name").focus();

  const seen = new Set<string>();
  for (let i = 0; i < 24; i += 1) {
    await page.keyboard.press("Tab");
    const id = await page.evaluate(() => document.activeElement?.id ?? "");
    const cls = await page.evaluate(() => document.activeElement?.className ?? "");
    if (id) seen.add(id);
    if (cls.includes("palette-swatch")) seen.add("palette");
    if (cls.includes("plate-item")) seen.add("plate");
    if (id === "export-png-btn") break;
  }

  expect(seen).toContain("input-birthday");
  expect(seen).toContain("palette");
  expect(seen).toContain("next-crest-btn");
  expect(seen).toContain("plate");
  expect(seen).toContain("export-svg-btn");
  expect(seen).toContain("export-png-btn");
});

test("図版帖の項目は button で、Enter で開ける (FR-300.1 / FR-601)", async ({ page }) => {
  await seed(page, "水野 蒼");
  await page.click("#next-crest-btn");
  await expect(page.locator(".plate-item")).toHaveCount(2);

  const oldest = page.locator(".plate-item").last();
  expect(await oldest.evaluate((el) => el.tagName)).toBe("BUTTON");

  const expected = await oldest.locator(".plate-name").textContent();
  await oldest.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#crest-name")).toHaveText(expected ?? "");
});

test("320px 幅で横スクロールが起きない (AC-25)", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await seed(page, "水野 蒼");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`${width}px 幅で横スクロールが起きない (NFR-005)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page, "水野 蒼");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("操作を一巡してもコンソールに ERROR が出ない (AC-26)", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/");
  await seed(page, "水野 蒼", "1998-04-12");
  await page.click("#next-crest-btn");
  await page.click('.palette-swatch[data-palette-id="shu"]');
  await page.click('.palette-swatch[data-palette-id="kon"]');
  await page.locator(".plate-item").last().click();

  const download = page.waitForEvent("download");
  await page.click("#export-svg-btn");
  await download;

  await page.click("#clear-book-btn");
  await page.click("#clear-book-no");

  expect(errors).toEqual([]);
});

test.describe("動きを抑える設定", () => {
  // Playwright 1.62 では reducedMotion は contextOptions の下にある
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("割り出しを待たずに紋が出る (AC-24 / FR-500.4)", async ({ page }) => {
    await page.goto("/");
    await page.fill("#input-name", "水野 蒼");
    await expect(page.locator(STAGE)).toHaveAttribute("data-state", "ready", { timeout: 1200 });

    const running = await page.evaluate(() =>
      document.getAnimations().filter((a) => a.playState === "running").length,
    );
    expect(running).toBe(0);
  });
});
