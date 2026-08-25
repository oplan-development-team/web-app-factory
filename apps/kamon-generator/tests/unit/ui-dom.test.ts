/** @vitest-environment jsdom */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { requireElement, setHidden, setSvg, setText } from "../../src/ui/dom";
import { createStatusRegion } from "../../src/ui/status";

describe("requireElement (NFR-008.2)", () => {
  beforeEach(() => {
    document.body.innerHTML = `<input id="a"><p id="b">x</p>`;
  });

  it("型が一致する要素を返す", () => {
    const input = requireElement(document, "#a", HTMLInputElement);
    expect(input.id).toBe("a");
  });

  it("見つからない場合はセレクタ付きで失敗する", () => {
    expect(() => requireElement(document, "#missing", HTMLInputElement)).toThrow("#missing");
  });

  it("型が違う場合は失敗する", () => {
    expect(() => requireElement(document, "#b", HTMLInputElement)).toThrow("型が想定と違います");
  });
});

describe("setText / setSvg / setHidden", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="t"></div>`;
  });

  it("setText はタグを解釈せずテキストとして入れる (NFR-007)", () => {
    const target = requireElement(document, "#t", HTMLDivElement);
    setText(target, "<img src=x onerror=alert(1)>");
    expect(target.querySelector("img")).toBeNull();
    expect(target.textContent).toContain("onerror");
  });

  it("setSvg は SVG 文字列を要素として展開する", () => {
    const target = requireElement(document, "#t", HTMLDivElement);
    setSvg(target, `<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>`);
    expect(target.querySelector("circle")).not.toBeNull();
  });

  it("setHidden が hidden 属性を切り替える", () => {
    const target = requireElement(document, "#t", HTMLDivElement);
    setHidden(target, true);
    expect(target.hidden).toBe(true);
    setHidden(target, false);
    expect(target.hidden).toBe(false);
  });
});

describe("ステータス領域 (FR-400.4 / FR-501.3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `<p id="s"></p>`;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const region = () =>
    createStatusRegion(requireElement(document, "#s", HTMLParagraphElement), 3200);

  it("文言と調子を反映する", () => {
    region().announce("書き出しました", "success");
    const element = requireElement(document, "#s", HTMLParagraphElement);
    expect(element.textContent).toBe("書き出しました");
    expect(element.dataset["tone"]).toBe("success");
  });

  it("成功表示は時間で消える", () => {
    region().announce("書き出しました", "success");
    vi.advanceTimersByTime(3300);
    expect(requireElement(document, "#s", HTMLParagraphElement).textContent).toBe("");
  });

  it("失敗表示は消えない（次にすべきことを読ませるため）", () => {
    region().announce("書き出しに失敗しました", "error");
    vi.advanceTimersByTime(10_000);
    expect(requireElement(document, "#s", HTMLParagraphElement).textContent).toBe(
      "書き出しに失敗しました",
    );
  });

  it("続けて通知すると前の自動消去は取り消される", () => {
    const r = region();
    r.announce("一件目", "success");
    vi.advanceTimersByTime(3000);
    r.announce("二件目", "error");
    vi.advanceTimersByTime(3000);
    expect(requireElement(document, "#s", HTMLParagraphElement).textContent).toBe("二件目");
  });

  it("clear で空になる", () => {
    const r = region();
    r.announce("なにか", "info");
    r.clear();
    expect(requireElement(document, "#s", HTMLParagraphElement).textContent).toBe("");
  });
});
