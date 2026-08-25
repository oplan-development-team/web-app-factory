/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildKamonStructure } from "../../src/lib/kamon";
import { DEFAULT_PALETTE_ID, PALETTES, isPaletteId, paletteById } from "../../src/lib/palette";
import { createCrestStage, type CrestStage } from "../../src/ui/crestStage";

function mount(): CrestStage {
  document.body.innerHTML = `
    <div id="stage" data-state="empty">
      <div id="mount"></div>
      <p id="error"></p>
    </div>
    <div id="caption" hidden>
      <h3 id="name"></h3><p id="spec"></p><p id="seed"></p>
    </div>`;
  const pick = <T extends Element>(id: string): T => {
    const el = document.getElementById(id);
    if (el === null) throw new Error(id);
    return el as unknown as T;
  };
  return createCrestStage({
    stage: pick<HTMLElement>("stage"),
    mount: pick<HTMLElement>("mount"),
    caption: pick<HTMLElement>("caption"),
    name: pick<HTMLElement>("name"),
    spec: pick<HTMLElement>("spec"),
    seed: pick<HTMLElement>("seed"),
    error: pick<HTMLElement>("error"),
  });
}

const view = (seed = "水野 蒼", variant = 0, plateNo = 1) => ({
  structure: buildKamonStructure(seed, variant),
  palette: paletteById(DEFAULT_PALETTE_ID),
  plateNo,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("配色プリセット (FR-200)", () => {
  it("知らない id は先頭のプリセットへ倒す", () => {
    expect(paletteById("存在しない").id).toBe(PALETTES[0]?.id);
  });

  it("既知の id はそのまま引ける", () => {
    expect(paletteById("kon").ink).toBe("#f4efe2");
  });

  it("id かどうかを判定できる", () => {
    expect(isPaletteId("shu")).toBe(true);
    expect(isPaletteId("むらさき")).toBe(false);
    expect(isPaletteId(42)).toBe(false);
    expect(isPaletteId(null)).toBe(false);
  });
});

describe("紋表示面の状態 (FR-500)", () => {
  let stage: CrestStage;

  beforeEach(() => {
    stage = mount();
  });

  it("空状態では作図線だけを出し、キャプションを畳む", () => {
    stage.showEmpty();
    expect(stage.state()).toBe("empty");
    expect(stage.view()).toBeNull();
    expect(document.querySelectorAll("#mount circle").length).toBeGreaterThan(0);
    expect((document.getElementById("caption") as HTMLElement).hidden).toBe(true);
  });

  it("紋を出すと紋名・諸元・種の控えが揃う", () => {
    const target = view("水野 蒼", 2, 7);
    stage.present(target);

    expect(stage.state()).toBe("ready");
    expect(document.getElementById("name")?.textContent).toBe(target.structure.name);
    expect(document.getElementById("spec")?.textContent).toContain("図版 07");
    expect(document.getElementById("spec")?.textContent).toContain(
      target.structure.categoryLabel,
    );
    expect(document.getElementById("seed")?.textContent).toContain("第 3 案");
    expect((document.getElementById("caption") as HTMLElement).hidden).toBe(false);
  });

  it("エラー面は文言を持ち、直前の紋を手放す", () => {
    stage.present(view());
    stage.showError("割り出せませんでした");

    expect(stage.state()).toBe("error");
    expect(stage.view()).toBeNull();
    expect(document.getElementById("error")?.textContent).toBe("割り出せませんでした");
  });

  it("紋を出し直すとエラー文言が消える", () => {
    stage.showError("割り出せませんでした");
    stage.present(view());
    expect(document.getElementById("error")?.textContent).toBe("");
  });

  it("色だけ差し替えても幾何は変わらない (FR-200.1)", () => {
    stage.present(view());
    const before = [...document.querySelectorAll("#mount path")].map((p) => p.getAttribute("d"));

    stage.recolor(paletteById("kon"));
    const after = [...document.querySelectorAll("#mount path")].map((p) => p.getAttribute("d"));

    expect(after).toEqual(before);
    expect(stage.view()?.palette.id).toBe("kon");
  });

  it("紋が無いときの色差し替えは何もしない", () => {
    stage.showEmpty();
    stage.recolor(paletteById("shu"));
    expect(stage.view()).toBeNull();
    expect(stage.state()).toBe("empty");
  });
});

describe("割り出し面の待ち時間 (FR-500.1 / FR-500.4)", () => {
  it("既定では最短表示時間だけ待つ", async () => {
    vi.useFakeTimers();
    const stage = mount();
    let done = false;
    void stage.beginDraft().then(() => {
      done = true;
    });

    expect(stage.state()).toBe("drafting");
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(120);
    expect(done).toBe(true);
    vi.useRealTimers();
  });

  it("動きを抑える設定では待たずに抜ける", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const stage = mount();
    await stage.beginDraft();
    expect(stage.state()).toBe("drafting");
  });

  it("matchMedia が無い環境でも落ちない", async () => {
    vi.stubGlobal("matchMedia", undefined);
    vi.useFakeTimers();
    const stage = mount();
    let done = false;
    void stage.beginDraft().then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(320);
    expect(done).toBe(true);
    vi.useRealTimers();
  });
});
