// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/ui/app.ts";
import { mulberry32 } from "../../src/lib/rng.ts";
import { SHAKE, STORAGE_KEY, TOTAL_TYPES } from "../../src/lib/constants.ts";
import type { StorageLike } from "../../src/lib/storage.ts";

// jsdom 環境では import.meta.url が http: になり fileURLToPath が使えないので、
// vitest の実行ディレクトリ（プロジェクトルート）から解決する。
const HTML = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

const NOW = new Date("2026-09-02T04:00:00.000Z");

function memoryStorage(initial: Record<string, string> = {}): StorageLike & {
  dump: () => Record<string, string>;
} {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    dump: () => Object.fromEntries(map),
  };
}

interface Harness {
  app: App;
  motionTarget: EventTarget;
  storage: ReturnType<typeof memoryStorage>;
}

function mount(options: { storage?: StorageLike | null; seed?: number } = {}): Harness {
  document.documentElement.innerHTML = HTML.replace(/<script[\s\S]*?<\/script>/g, "");
  const storage = memoryStorage();
  const motionTarget = new EventTarget();
  const app = new App({
    root: document,
    rng: mulberry32(options.seed ?? 12345),
    now: () => NOW,
    storage: options.storage === undefined ? storage : options.storage,
    motionTarget,
  });
  return { app, motionTarget, storage };
}

function screen(name: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-screen="${name}"]`);
  if (el === null) throw new Error(`画面が無い: ${name}`);
  return el;
}

function isActive(name: string): boolean {
  return screen(name).dataset["active"] === "true";
}

function click(selector: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (el === null) throw new Error(`要素が無い: ${selector}`);
  el.click();
}

function text(selector: string): string {
  return document.querySelector(selector)?.textContent?.trim() ?? "";
}

/** 値を伴う devicemotion を作る。 */
function motionEvent(x: number, y: number, z: number): Event {
  const event = new Event("devicemotion");
  Object.defineProperty(event, "accelerationIncludingGravity", {
    value: { x, y, z },
    configurable: true,
  });
  return event;
}

function orientationEvent(beta: number, gamma: number): Event {
  const event = new Event("deviceorientation");
  Object.defineProperty(event, "beta", { value: beta, configurable: true });
  Object.defineProperty(event, "gamma", { value: gamma, configurable: true });
  return event;
}

beforeEach(() => {
  vi.useRealTimers();
  // DeviceMotionEvent が無い環境を既定にする（＝ヘッドレス相当）
  Reflect.deleteProperty(globalThis, "DeviceMotionEvent");
  Reflect.deleteProperty(globalThis, "DeviceOrientationEvent");
});

describe("初期表示（AC-17）", () => {
  it("待機画面が表示され進捗が 0 / 12 になる", () => {
    mount();
    expect(isActive("standby")).toBe(true);
    expect(isActive("reveal")).toBe(false);
    expect(isActive("collection")).toBe(false);
    expect(text("[data-standby-progress]")).toBe(`0 / ${TOTAL_TYPES}`);
  });

  it("非表示の画面は inert かつ aria-hidden になる（NFR-007）", () => {
    mount();
    expect(screen("reveal").inert).toBe(true);
    expect(screen("reveal").getAttribute("aria-hidden")).toBe("true");
    expect(screen("standby").inert).toBe(false);
  });
});

describe("センサー非対応環境のフォールバック（AC-18 / FR-020）", () => {
  it("ボタンを押すと DeviceMotionEvent が無くても抽選が成立する", async () => {
    mount();
    click("[data-shake-button]");
    // requestPermission は Promise を返すのでマイクロタスクを流す
    await Promise.resolve();
    await Promise.resolve();

    expect(isActive("reveal")).toBe(true);
    expect(text("[data-reveal-family-en]")).toMatch(/FLOW|GRID|RADIAL|NOISE/);
    expect(text("[data-reveal-rarity]")).toMatch(/COMMON|RARE|EPIC/);
    expect(document.querySelectorAll("[data-reveal-art] svg")).toHaveLength(1);
  });

  it("センサー由来でないことを表示に明示する（FR-053）", async () => {
    mount();
    click("[data-shake-button]");
    await Promise.resolve();
    await Promise.resolve();
    expect(text("[data-reveal-tilt]")).toContain("センサーなし");
  });

  it("ボタンの文言が「タップで引く」に変わる（FR-302）", async () => {
    mount();
    click("[data-shake-button]");
    await Promise.resolve();
    await Promise.resolve();
    expect(text("[data-shake-label]")).toBe("タップで引く");
  });

  it("初回は「はじめて発見」が表示される（FR-200.3）", async () => {
    mount();
    click("[data-shake-button]");
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector<HTMLElement>("[data-reveal-first]")?.hidden).toBe(false);
  });
});

describe("許可が拒否された場合（FR-003）", () => {
  it("停止せずフォールバックで 1 回引く", async () => {
    const requestPermission = vi.fn().mockResolvedValue("denied");
    Object.defineProperty(globalThis, "DeviceMotionEvent", {
      value: { requestPermission },
      configurable: true,
    });
    Object.defineProperty(globalThis, "DeviceOrientationEvent", {
      value: { requestPermission },
      configurable: true,
    });

    mount();
    click("[data-shake-button]");
    await vi.waitFor(() => expect(isActive("reveal")).toBe(true));
    expect(text("[data-shake-label]")).toBe("タップで引く");
  });

  it("requestPermission が例外を投げても止まらない", async () => {
    const requestPermission = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    Object.defineProperty(globalThis, "DeviceMotionEvent", {
      value: { requestPermission },
      configurable: true,
    });

    mount();
    click("[data-shake-button]");
    await vi.waitFor(() => expect(isActive("reveal")).toBe(true));
  });

  it("2 つの requestPermission を await を挟まず起動する（FR-001.1）", async () => {
    const order: string[] = [];
    const motionRequest = vi.fn(() => {
      order.push("motion");
      return Promise.resolve("granted" as const);
    });
    const orientationRequest = vi.fn(() => {
      order.push("orientation");
      return Promise.resolve("granted" as const);
    });
    Object.defineProperty(globalThis, "DeviceMotionEvent", {
      value: { requestPermission: motionRequest },
      configurable: true,
    });
    Object.defineProperty(globalThis, "DeviceOrientationEvent", {
      value: { requestPermission: orientationRequest },
      configurable: true,
    });

    mount();
    click("[data-shake-button]");
    // 同期パスで両方が起動していること = 間に await が挟まっていないこと
    expect(order).toEqual(["motion", "orientation"]);
  });
});

describe("センサーがある場合（AC-23 / AC-24）", () => {
  async function armed(): Promise<Harness> {
    Object.defineProperty(globalThis, "DeviceMotionEvent", { value: {}, configurable: true });
    const harness = mount();
    click("[data-shake-button]");
    await vi.waitFor(() => expect(text("[data-shake-label]")).toBe("振って！"));
    return harness;
  }

  it("シェイクを合成すると抽選が成立する", async () => {
    const { motionTarget } = await armed();
    motionTarget.dispatchEvent(orientationEvent(90, 0));
    motionTarget.dispatchEvent(motionEvent(0, 0, 0));
    await new Promise((r) => setTimeout(r, SHAKE.MIN_SAMPLE_INTERVAL_MS + 10));
    motionTarget.dispatchEvent(motionEvent(30, 30, 30));

    expect(isActive("reveal")).toBe(true);
    expect(text("[data-reveal-tilt]")).toBe("検出した傾き: たて");
  });

  it("閾値未満の揺れでは抽選されない", async () => {
    const { motionTarget } = await armed();
    motionTarget.dispatchEvent(motionEvent(0, 0, 0));
    await new Promise((r) => setTimeout(r, SHAKE.MIN_SAMPLE_INTERVAL_MS + 10));
    motionTarget.dispatchEvent(motionEvent(1, 1, 1));

    expect(isActive("reveal")).toBe(false);
  });

  it("クールダウン内の連続した閾値超えで 2 枚出ない（FR-010.3）", async () => {
    const { motionTarget } = await armed();
    motionTarget.dispatchEvent(motionEvent(0, 0, 0));
    await new Promise((r) => setTimeout(r, SHAKE.MIN_SAMPLE_INTERVAL_MS + 10));
    motionTarget.dispatchEvent(motionEvent(30, 30, 30));
    const first = text("[data-reveal-index]");

    // 直後にもう一度大きく振る
    await new Promise((r) => setTimeout(r, SHAKE.MIN_SAMPLE_INTERVAL_MS + 10));
    motionTarget.dispatchEvent(motionEvent(-30, -30, -30));

    expect(text("[data-reveal-index]")).toBe(first);
  });

  it("値の無い devicemotion では降格判定が進まない（FR-010.4）", async () => {
    Object.defineProperty(globalThis, "DeviceMotionEvent", { value: {}, configurable: true });
    const { motionTarget } = mount();
    click("[data-shake-button]");
    await vi.waitFor(() => expect(text("[data-shake-label]")).toBe("振って！"));

    // accelerationIncludingGravity が null のイベントだけを流す
    const empty = new Event("devicemotion");
    Object.defineProperty(empty, "accelerationIncludingGravity", { value: null });
    motionTarget.dispatchEvent(empty);

    // プローブ時間を過ぎるとセンサー不在と判断されフォールバックする
    await new Promise((r) => setTimeout(r, SHAKE.SENSOR_PROBE_MS + 150));
    expect(text("[data-shake-label]")).toBe("タップで引く");
    expect(isActive("reveal")).toBe(true);
  });

  it("待ち受け中のタップでも引ける（FR-022）", async () => {
    await armed();
    click("[data-shake-button]");
    expect(isActive("reveal")).toBe(true);
  });
});

describe("画面遷移（AC-19 / AC-21）", () => {
  async function draw(): Promise<void> {
    click("[data-shake-button]");
    await vi.waitFor(() => expect(isActive("reveal")).toBe(true));
  }

  it("「図鑑を見る」で図鑑へ遷移し、引いた型が発見済みになる", async () => {
    mount();
    await draw();
    const family = text("[data-reveal-family-en]");
    const rarity = text("[data-reveal-rarity]");

    click('[data-screen="reveal"] [data-open-collection]');
    expect(isActive("collection")).toBe(true);
    expect(text("[data-collection-count]")).toBe(`1 / ${TOTAL_TYPES}`);

    const cell = document.querySelector(
      `.family[data-family="${family}"] .cell[data-rarity="${rarity}"]`,
    );
    expect(cell?.getAttribute("data-state")).toBe("found");
    expect(cell?.querySelector("svg")).not.toBeNull();
  });

  it("「もう一度振る」で続けて引ける", async () => {
    mount();
    await draw();
    expect(text("[data-reveal-index]")).toBe("№ 001");

    click("[data-shake-again]");
    await vi.waitFor(() => expect(text("[data-reveal-index]")).toBe("№ 002"));
  });

  it("図鑑から「もどる」で待機画面へ戻る", async () => {
    mount();
    await draw();
    click('[data-screen="reveal"] [data-open-collection]');
    click("[data-close-collection]");
    expect(isActive("standby")).toBe(true);
  });

  it("待機画面からも図鑑を開ける", () => {
    mount();
    click('[data-screen="standby"] [data-open-collection]');
    expect(isActive("collection")).toBe(true);
  });
});

describe("図鑑の表示（AC-20 / FR-504）", () => {
  it("空でも 12 マスすべてが未収集として描画される", () => {
    mount();
    click('[data-screen="standby"] [data-open-collection]');

    expect(document.querySelectorAll(".cell")).toHaveLength(TOTAL_TYPES);
    expect(document.querySelectorAll('.cell[data-state="locked"]')).toHaveLength(TOTAL_TYPES);
    expect(document.querySelectorAll(".family")).toHaveLength(4);
    expect(text("[data-collection-count]")).toBe(`0 / ${TOTAL_TYPES}`);
  });

  it("未収集マスは「?」を持ち、模様を持たない", () => {
    mount();
    click('[data-screen="standby"] [data-open-collection]');
    const locked = document.querySelector('.cell[data-state="locked"]');
    expect(locked?.querySelector(".cell__unknown")?.textContent).toBe("?");
    expect(locked?.querySelector("svg")).toBeNull();
  });

  it("進捗バーの aria-valuenow が収集数と一致する", async () => {
    mount();
    click("[data-shake-button]");
    await vi.waitFor(() => expect(isActive("reveal")).toBe(true));
    click('[data-screen="reveal"] [data-open-collection]');
    expect(document.querySelector("[data-collection-meter]")?.getAttribute("aria-valuenow")).toBe(
      "1",
    );
  });
});

describe("永続化（AC-22 / FR-201）", () => {
  it("引くと localStorage に書かれ、再マウントで復元される", async () => {
    const storage = memoryStorage();
    document.documentElement.innerHTML = HTML.replace(/<script[\s\S]*?<\/script>/g, "");
    new App({
      root: document,
      rng: mulberry32(7),
      now: () => NOW,
      storage,
      motionTarget: new EventTarget(),
    });

    click("[data-shake-button]");
    await vi.waitFor(() => expect(isActive("reveal")).toBe(true));
    expect(Object.keys(storage.dump())).toContain(STORAGE_KEY);

    // 同じ storage で新しく起動する = リロード相当
    document.documentElement.innerHTML = HTML.replace(/<script[\s\S]*?<\/script>/g, "");
    new App({
      root: document,
      rng: mulberry32(7),
      now: () => NOW,
      storage,
      motionTarget: new EventTarget(),
    });
    expect(text("[data-standby-progress]")).toBe(`1 / ${TOTAL_TYPES}`);
  });

  it("storage が無くてもアプリは動作する（FR-201.3）", async () => {
    mount({ storage: null });
    click("[data-shake-button]");
    await vi.waitFor(() => expect(isActive("reveal")).toBe(true));

    click('[data-screen="reveal"] [data-open-collection]');
    const note = document.querySelector<HTMLElement>("[data-collection-note]");
    expect(note?.hidden).toBe(false);
    expect(note?.textContent).toContain("保存ができない");
  });

  it("保存できる環境では注意書きを出さない", () => {
    mount();
    click('[data-screen="standby"] [data-open-collection]');
    expect(document.querySelector<HTMLElement>("[data-collection-note]")?.hidden).toBe(true);
  });

  it("破損した保存内容でも起動する（AC-15）", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "{壊れている" });
    expect(() => mount({ storage })).not.toThrow();
    expect(text("[data-standby-progress]")).toBe(`0 / ${TOTAL_TYPES}`);
  });
});

describe("読み上げ（FR-050）", () => {
  it("抽選結果が live region に反映される", async () => {
    mount();
    click("[data-shake-button]");
    await vi.waitFor(() => expect(isActive("reveal")).toBe(true));
    expect(text("[data-live]")).toContain("図鑑は 1 /");
  });
});
