/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, svgBlob, svgToPngBlob } from "../../src/lib/exportImage";

/**
 * PNG 化そのもの（Canvas の描画結果）はブラウザでしか確かめられないため
 * E2E に任せ、ここでは jsdom で通せる経路 — Blob の組み立て、Object URL の
 * 後始末、失敗時の扱い — を見る。
 */

interface FakeImage {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
}

/** src を代入したら成否のどちらかへ倒れる Image の身代わりを入れる */
function stubImage(outcome: "load" | "error"): FakeImage[] {
  const made: FakeImage[] = [];
  class StubImage implements FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    #src = "";
    constructor() {
      made.push(this);
    }
    get src(): string {
      return this.#src;
    }
    set src(value: string) {
      this.#src = value;
      queueMicrotask(() => {
        if (outcome === "load") this.onload?.();
        else this.onerror?.();
      });
    }
  }
  vi.stubGlobal("Image", StubImage);
  return made;
}

function stubObjectUrl(): { created: number; revoked: number } {
  const counts = { created: 0, revoked: 0 };
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: () => {
      counts.created += 1;
      return "blob:stub";
    },
    revokeObjectURL: () => {
      counts.revoked += 1;
    },
  });
  return counts;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("svgBlob", () => {
  it("SVG の MIME 型を持つ Blob になる", () => {
    const blob = svgBlob("<svg/>");
    expect(blob.type).toBe("image/svg+xml;charset=utf-8");
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe("downloadBlob (FR-400.5)", () => {
  it("ファイル名つきで押し出し、Object URL を解放する", () => {
    vi.useFakeTimers();
    const counts = stubObjectUrl();

    downloadBlob(svgBlob("<svg/>"), "kamon-蝶-蒼-1.svg");

    // クリック後にアンカーが残らない
    expect(document.querySelectorAll("a")).toHaveLength(0);
    expect(counts.created).toBe(1);

    expect(counts.revoked).toBe(0);
    vi.advanceTimersByTime(2500);
    expect(counts.revoked).toBe(1);
  });
});

describe("svgToPngBlob (FR-400.2)", () => {
  it("Canvas を用意できなければ理由つきで失敗する", async () => {
    stubObjectUrl();
    stubImage("load");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    await expect(svgToPngBlob("<svg/>", "#fbf7ec")).rejects.toThrow(
      "Canvas を初期化できませんでした",
    );
  });

  it("紋を読み込めなければ理由つきで失敗する", async () => {
    stubObjectUrl();
    stubImage("error");

    await expect(svgToPngBlob("<svg/>", "#fbf7ec")).rejects.toThrow(
      "紋の読み込みに失敗しました",
    );
  });

  it("失敗しても Object URL を残さない", async () => {
    const counts = stubObjectUrl();
    stubImage("error");

    await expect(svgToPngBlob("<svg/>", "#fbf7ec")).rejects.toThrow();
    expect(counts.revoked).toBe(counts.created);
  });

  it("地色を敷いてから紋を載せ、指定寸法で書き出す", async () => {
    stubObjectUrl();
    stubImage("load");

    const calls: string[] = [];
    const context = {
      set fillStyle(value: string) {
        calls.push(`fillStyle=${value}`);
      },
      fillRect: (...args: number[]) => calls.push(`fillRect(${args.join(",")})`),
      drawImage: (_img: unknown, ...args: number[]) => calls.push(`drawImage(${args.join(",")})`),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => {
      cb(new Blob(["png"], { type: "image/png" }));
    });

    const blob = await svgToPngBlob("<svg/>", "#1b2a4a", 600);
    expect(blob.type).toBe("image/png");
    // 透過にせず、必ず地色が先に塗られる
    expect(calls).toEqual([
      "fillStyle=#1b2a4a",
      "fillRect(0,0,600,600)",
      "drawImage(0,0,600,600)",
    ]);
  });

  it("Blob を作れなければ失敗として扱う", async () => {
    stubObjectUrl();
    stubImage("load");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: () => undefined,
      drawImage: () => undefined,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => cb(null));

    await expect(svgToPngBlob("<svg/>", "#fbf7ec")).rejects.toThrow("PNG への変換に失敗しました");
  });
});
