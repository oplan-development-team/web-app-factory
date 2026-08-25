/**
 * ステータス領域（FR-400.4 / FR-603）。
 *
 * 書き出し・保存・降格通知の結果をすべてここへ集約する。`window.alert` は使わない。
 * 成功表示は 3.2 秒で自動的に消える（FR-501.3）が、失敗表示は残す。
 * 原因を読み終える前に消えては、次にすべきことが分からなくなるため。
 */

export const SUCCESS_TIMEOUT_MS = 3200;

export type StatusTone = "info" | "success" | "error";

export interface StatusRegion {
  /** 進行中・完了などの通知。`success` は一定時間で自動的に消える */
  announce(message: string, tone?: StatusTone): void;
  clear(): void;
}

export function createStatusRegion(
  element: HTMLElement,
  timeoutMs: number = SUCCESS_TIMEOUT_MS,
): StatusRegion {
  let timer: number | undefined;

  const cancel = (): void => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };

  const clear = (): void => {
    cancel();
    element.textContent = "";
    element.dataset["tone"] = "info";
  };

  return {
    announce(message: string, tone: StatusTone = "info") {
      cancel();
      element.textContent = message;
      element.dataset["tone"] = tone;
      if (tone === "success") {
        timer = window.setTimeout(clear, timeoutMs);
      }
    },
    clear,
  };
}
