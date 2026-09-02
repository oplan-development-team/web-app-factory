import { requireHtml } from "./dom.ts";

export type ScreenName = "standby" | "reveal" | "collection";

/**
 * 3 画面の表示切替（FR-3xx / FR-4xx / FR-5xx）。
 *
 * 表示は `hidden` 属性ではなく `data-active` で行う。
 * `hidden` は `display` を持つクラスに簡単に負けるため、
 * 「CSS は書いたのに常時見えている」という壊れ方をしやすい。
 */
export class ScreenManager {
  private readonly screens: Map<ScreenName, HTMLElement>;
  private readonly liveRegion: HTMLElement;
  private current: ScreenName = "standby";

  constructor(root: ParentNode) {
    this.screens = new Map([
      ["standby", requireHtml(root, '[data-screen="standby"]')],
      ["reveal", requireHtml(root, '[data-screen="reveal"]')],
      ["collection", requireHtml(root, '[data-screen="collection"]')],
    ]);
    this.liveRegion = requireHtml(root, "[data-live]");
  }

  get active(): ScreenName {
    return this.current;
  }

  show(name: ScreenName): void {
    for (const [key, element] of this.screens) {
      const isActive = key === name;
      element.dataset["active"] = isActive ? "true" : "false";
      // 非表示の画面はキーボード・支援技術からも外す（NFR-007）
      element.inert = !isActive;
      element.setAttribute("aria-hidden", isActive ? "false" : "true");
    }
    this.current = name;
  }

  /** 状態変化を読み上げ可能にする（FR-050）。 */
  announce(message: string): void {
    this.liveRegion.textContent = message;
  }
}
