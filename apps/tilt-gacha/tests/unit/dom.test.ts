// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { requireButton, requireElement, requireHtml, setText } from "../../src/ui/dom.ts";

beforeEach(() => {
  document.body.innerHTML = `
    <div id="wrap">
      <button data-go>押す</button>
      <p data-text>元の文</p>
      <svg data-svg></svg>
    </div>`;
});

describe("requireHtml / requireButton", () => {
  it("存在する要素を返す", () => {
    expect(requireHtml(document, "#wrap").id).toBe("wrap");
    expect(requireButton(document, "[data-go]").textContent).toBe("押す");
  });

  it("見つからないセレクタは例外を投げる", () => {
    expect(() => requireHtml(document, "[data-missing]")).toThrow("要素が見つからない");
  });

  it("型が想定と違えば例外を投げる", () => {
    // SVGElement は HTMLElement ではない
    expect(() => requireHtml(document, "[data-svg]")).toThrow("型が想定と違う");
    // button でない要素を requireButton で取ろうとした場合
    expect(() => requireButton(document, "[data-text]")).toThrow("型が想定と違う");
  });

  it("requireElement は指定したコンストラクタで検査する", () => {
    expect(requireElement(document, "[data-go]", HTMLButtonElement).tagName).toBe("BUTTON");
    expect(() => requireElement(document, "[data-text]", HTMLButtonElement)).toThrow();
  });
});

describe("setText", () => {
  it("テキストを置き換える", () => {
    const el = requireHtml(document, "[data-text]");
    setText(el, "新しい文");
    expect(el.textContent).toBe("新しい文");
  });

  it("HTML として解釈しない（XSS 対策）", () => {
    const el = requireHtml(document, "[data-text]");
    setText(el, "<img src=x onerror=alert(1)>");
    expect(el.querySelector("img")).toBeNull();
    expect(el.textContent).toBe("<img src=x onerror=alert(1)>");
  });
});
