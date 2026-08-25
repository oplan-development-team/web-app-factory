/**
 * 統合テストの足場。
 *
 * マークアップは実物の `index.html` から切り出して使う。テスト用に組み直すと、
 * 本番の id を変えたときにテストだけが通り続けてしまうため。
 */

import html from "../../index.html?raw";
import { createApp, INPUT_DEBOUNCE_MS, type AppHandle } from "../../src/ui/app";
import { MIN_DRAFT_MS } from "../../src/ui/crestStage";

let cachedBody: string | undefined;

function appMarkup(): string {
  if (cachedBody === undefined) {
    const start = html.indexOf('<div id="app">');
    const end = html.indexOf('<script type="module"');
    if (start < 0 || end < 0) throw new Error("index.html から #app を切り出せません");
    cachedBody = html.slice(start, end);
  }
  return cachedBody;
}

/**
 * 入力のデバウンス 200ms と割り出しの最短表示 260ms を足した時間を固定で待つと、
 * 実行機の負荷次第で足りなくなる（実際に 1/10 程度の頻度で落ちた）。
 * 目的の状態になるまで細かく確かめる。
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SETTLE_TIMEOUT_MS = (INPUT_DEBOUNCE_MS + MIN_DRAFT_MS) * 8;

export async function waitFor(
  predicate: () => boolean,
  label: string,
  timeoutMs = SETTLE_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await wait(10);
  }
  throw new Error(`${timeoutMs}ms 待っても条件を満たしませんでした: ${label}`);
}

/** 紋が立ち上がるまで待つ */
export function waitForReady(): Promise<void> {
  return waitFor(() => stageState() === "ready", "表示面が ready にならない");
}

export function mountApp(): AppHandle {
  document.body.innerHTML = appMarkup();
  return createApp(document);
}

export function $<T extends Element>(selector: string, ctor: new () => T): T {
  const found = document.querySelector(selector);
  if (!(found instanceof ctor)) throw new Error(`見つかりません: ${selector}`);
  return found;
}

export function stageState(): string {
  return $("#crest-stage", HTMLDivElement).dataset["state"] ?? "";
}

export function plateNames(): string[] {
  return [...document.querySelectorAll(".plate-item .plate-name")].map(
    (n) => n.textContent ?? "",
  );
}

export function plateNumbers(): string[] {
  return [...document.querySelectorAll(".plate-item .plate-no")].map((n) => n.textContent ?? "");
}

export function crestPathData(): string[] {
  return [...document.querySelectorAll("#crest-mount path")].map(
    (p) => p.getAttribute("d") ?? "",
  );
}

/** 名前欄へ入力し、紋が立ち上がるまで待つ */
export async function typeName(value: string): Promise<void> {
  const input = $("#input-name", HTMLInputElement);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));

  if (value.trim().length === 0) {
    // 「何も起きない」ことの確認は待つ条件を書けないので、余裕をみて時間で待つ
    await wait((INPUT_DEBOUNCE_MS + MIN_DRAFT_MS) * 3);
    return;
  }
  await waitForReady();
}
