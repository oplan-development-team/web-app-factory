import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./style.css";
import { App } from "./ui/app.ts";

// ブートストラップのみ。配線は ui/app.ts が持つ（カバレッジ除外対象）。
new App({ root: document });
