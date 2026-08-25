/**
 * 起動口。配線は `ui/app.ts` が持つ。
 * ここで組み立てに失敗した場合だけ、画面に理由を残す（白紙のまま止めない）。
 */

import "./style.css";
import { createApp } from "./ui/app";

try {
  createApp(document);
} catch (error: unknown) {
  const reason = error instanceof Error ? error.message : "原因不明のエラー";
  const banner = document.createElement("p");
  banner.setAttribute("role", "alert");
  banner.className = "boot-error";
  banner.textContent = `家紋帳を開けませんでした（${reason}）。ページを再読み込みしてください。`;
  document.body.prepend(banner);
}
