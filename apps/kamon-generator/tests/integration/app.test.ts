/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppHandle } from "../../src/ui/app";
import { MAX_PLATES, STORAGE_KEY } from "../../src/lib/storage";
import {
  $,
  crestPathData,
  mountApp,
  plateNames,
  plateNumbers,
  stageState,
  typeName,
  wait,
} from "./harness";

let app: AppHandle | undefined;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  app?.destroy();
  app = undefined;
  vi.restoreAllMocks();
});

describe("状態の遷移 (FR-500 / AC-12)", () => {
  it("入力が無いあいだは empty で、紋の領域だけ先に確保されている", () => {
    app = mountApp();
    expect(stageState()).toBe("empty");
    expect(document.querySelector("#crest-mount svg")).not.toBeNull();
    expect($("#crest-caption", HTMLDivElement).hidden).toBe(true);
  });

  it("名前を入れると drafting を経て ready になる", async () => {
    app = mountApp();
    const input = $("#input-name", HTMLInputElement);
    input.value = "水野 蒼";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    await wait(260);
    expect(stageState()).toBe("drafting");

    await wait(300);
    expect(stageState()).toBe("ready");
    expect($("#crest-name", HTMLHeadingElement).textContent).not.toBe("");
    expect($("#crest-caption", HTMLDivElement).hidden).toBe(false);
  });

  it("空白だけの入力は種とみなさない (FR-001.2)", async () => {
    app = mountApp();
    await typeName("   ");
    expect(stageState()).toBe("empty");
    expect(plateNames()).toHaveLength(0);
  });

  it("ready になるまで書き出しは押せない", async () => {
    app = mountApp();
    expect($("#export-svg-btn", HTMLButtonElement).disabled).toBe(true);
    expect($("#export-png-btn", HTMLButtonElement).disabled).toBe(true);
    await typeName("水野 蒼");
    expect($("#export-svg-btn", HTMLButtonElement).disabled).toBe(false);
    expect($("#export-png-btn", HTMLButtonElement).disabled).toBe(false);
  });
});

describe("配色 (FR-200 / AC-13)", () => {
  it("色目を変えても紋の幾何が変わらない", async () => {
    app = mountApp();
    await typeName("水野 蒼");
    const before = crestPathData();
    expect(before.length).toBeGreaterThan(0);

    $('.palette-swatch[data-palette-id="kon"]', HTMLButtonElement).click();
    expect(crestPathData()).toEqual(before);
  });

  it("選択中の色目だけが押された状態になる", async () => {
    app = mountApp();
    await typeName("水野 蒼");
    $('.palette-swatch[data-palette-id="shu"]', HTMLButtonElement).click();

    const pressed = [...document.querySelectorAll(".palette-swatch")]
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => (b as HTMLElement).dataset["paletteId"]);
    expect(pressed).toEqual(["shu"]);
  });

  it("図版帖のサムネイルにも色目が反映される (FR-200.3)", async () => {
    app = mountApp();
    await typeName("水野 蒼");
    $('.palette-swatch[data-palette-id="kon"]', HTMLButtonElement).click();

    // 白×紺の紋の色。外郭の輪は fill="none" の線なので、面のパスだけを見る
    const fill = document
      .querySelector('.plate-thumb path[fill-rule="evenodd"]')
      ?.getAttribute("fill");
    expect(fill).toBe("#f4efe2");
  });
});

describe("図版帖 (FR-300 / AC-14 / AC-15)", () => {
  it("「次の紋へ」を 10 回連打しても 10 件が正しい順で積まれる", async () => {
    app = mountApp();
    await typeName("水野 蒼");

    const next = $("#next-crest-btn", HTMLButtonElement);
    for (let i = 0; i < 10; i += 1) next.click();
    await wait(400);

    // 第 1 案 + 連打した 10 案
    expect(plateNumbers()).toEqual(["11", "10", "09", "08", "07", "06", "05", "04", "03", "02", "01"]);
    expect(stageState()).toBe("ready");
  });

  it("同じ種・同じ案を選び直しても件数が増えない", async () => {
    app = mountApp();
    await typeName("水野 蒼");
    expect(plateNames()).toHaveLength(1);

    $(".plate-item", HTMLButtonElement).click();
    expect(plateNames()).toHaveLength(1);
  });

  it("図版を選ぶと入力欄がその種へ戻り、割り出しを挟まず即座に出る", async () => {
    app = mountApp();
    await typeName("水野 蒼");
    $("#next-crest-btn", HTMLButtonElement).click();
    await wait(400);

    const oldest = [...document.querySelectorAll(".plate-item")].at(-1);
    if (!(oldest instanceof HTMLButtonElement)) throw new Error("図版が無い");
    oldest.click();

    expect(stageState()).toBe("ready");
    expect($("#input-name", HTMLInputElement).value).toBe("水野 蒼");
    expect($("#crest-name", HTMLHeadingElement).textContent).toBe(
      oldest.querySelector(".plate-name")?.textContent,
    );
  });

  it("選択中の図版に現在地が付く (FR-601)", async () => {
    app = mountApp();
    await typeName("水野 蒼");
    const current = document.querySelectorAll('.plate-item[aria-current="true"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.tagName).toBe("BUTTON");
  });

  it("上限を超えると最も古い図版から捨てられる (AC-18)", async () => {
    app = mountApp();
    const seeded = Array.from({ length: MAX_PLATES }, (_, i) => ({
      plateNo: i + 1,
      name: `見本${i}`,
      birthday: "",
      seedText: `見本${i}`,
      variantIndex: 0,
      savedAt: i,
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));

    app.destroy();
    app = mountApp();
    expect(plateNames()).toHaveLength(MAX_PLATES);

    await typeName("あたらしい種");
    expect(plateNames()).toHaveLength(MAX_PLATES);
    expect(plateNumbers()[0]).toBe("61");
  });
});

describe("永続化 (FR-301 / AC-16 / AC-19)", () => {
  it("開き直しても図版帖の内容と紋が完全に一致する", async () => {
    app = mountApp();
    await typeName("水野 蒼");
    $("#next-crest-btn", HTMLButtonElement).click();
    await wait(400);
    const before = plateNames();

    app.destroy();
    app = mountApp();
    expect(plateNames()).toEqual(before);

    $(".plate-item", HTMLButtonElement).click();
    expect($("#crest-name", HTMLHeadingElement).textContent).toBe(before[0]);
  });

  it("壊れた保存値は捨てて残りを読む (FR-301.3)", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { plateNo: 1, name: "健全", birthday: "", seedText: "健全", variantIndex: 0, savedAt: 1 },
        { plateNo: "壊れている" },
        null,
      ]),
    );
    app = mountApp();
    expect(plateNames()).toHaveLength(1);
  });

  it("保存値そのものが JSON でなければ空から始める", () => {
    window.localStorage.setItem(STORAGE_KEY, "{壊れた");
    app = mountApp();
    expect(plateNames()).toHaveLength(0);
    expect($("#plate-book-empty", HTMLParagraphElement).hidden).toBe(false);
  });

  it("帳を空にすると、開き直しても空のまま", async () => {
    app = mountApp();
    await typeName("水野 蒼");
    expect(plateNames()).toHaveLength(1);

    $("#clear-book-btn", HTMLButtonElement).click();
    expect($("#clear-book-confirm", HTMLDivElement).hidden).toBe(false);
    $("#clear-book-yes", HTMLButtonElement).click();

    expect(plateNames()).toHaveLength(0);
    expect(stageState()).toBe("empty");
    expect($("#status-region", HTMLParagraphElement).textContent).toContain("空にしました");

    app.destroy();
    app = mountApp();
    expect(plateNames()).toHaveLength(0);
  });

  it("確認を取り消すと図版帖は残る", async () => {
    app = mountApp();
    await typeName("水野 蒼");
    $("#clear-book-btn", HTMLButtonElement).click();
    $("#clear-book-no", HTMLButtonElement).click();

    expect($("#clear-book-confirm", HTMLDivElement).hidden).toBe(true);
    expect($("#clear-book-btn", HTMLButtonElement).hidden).toBe(false);
    expect(plateNames()).toHaveLength(1);
  });
});

describe("保存できない環境 (FR-301.4 / AC-17)", () => {
  function breakLocalStorage(): void {
    const throwing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    vi.spyOn(window, "localStorage", "get").mockReturnValue(throwing as unknown as Storage);
  }

  it("動作は止まらず、降格の通知は 1 度だけ出る", async () => {
    breakLocalStorage();
    app = mountApp();

    await typeName("水野 蒼");
    expect(stageState()).toBe("ready");
    expect(plateNames()).toHaveLength(1);

    const status = $("#status-region", HTMLParagraphElement);
    expect(status.textContent).toContain("一時的な記録");

    // 2 件目を作っても通知は増えない（同じ文言のまま上書きされない）
    status.textContent = "";
    $("#next-crest-btn", HTMLButtonElement).click();
    await wait(400);
    expect(status.textContent).toBe("");
    expect(plateNames()).toHaveLength(2);
  });
});

describe("書き出し (FR-400 / AC-22)", () => {
  it("成功をステータス領域へ出し、alert を使わない", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    const created: string[] = [];
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (): string => {
        created.push("url");
        return "blob:stub";
      },
      revokeObjectURL: (): void => undefined,
    });

    app = mountApp();
    await typeName("水野 蒼");
    $("#export-svg-btn", HTMLButtonElement).click();
    await wait(20);

    const status = $("#status-region", HTMLParagraphElement);
    expect(status.textContent).toContain("書き出しました");
    expect(status.textContent).toContain(".svg");
    expect(status.dataset["tone"]).toBe("success");
    expect(created).toHaveLength(1);
    expect(alertSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("失敗すると原因つきで残る", async () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (): string => {
        throw new Error("書き出し先を開けません");
      },
      revokeObjectURL: (): void => undefined,
    });

    app = mountApp();
    await typeName("水野 蒼");
    $("#export-svg-btn", HTMLButtonElement).click();
    await wait(20);

    const status = $("#status-region", HTMLParagraphElement);
    expect(status.textContent).toContain("書き出しに失敗しました");
    expect(status.textContent).toContain("書き出し先を開けません");
    expect(status.dataset["tone"]).toBe("error");

    vi.unstubAllGlobals();
  });
});
