/**
 * DOM 取得の検査付きヘルパ（NFR-008.2）。
 *
 * `document.querySelector(...) as HTMLInputElement` のような無検査キャストを置くと、
 * マークアップ側の id を変えたときに型では捕まらず、実行時に null 参照で落ちる。
 * ここで一度だけ検査し、以降は型の付いた要素として扱う。
 */

export function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  ctor: new () => T,
): T {
  const found = root.querySelector(selector);
  if (found === null) {
    throw new Error(`要素が見つかりません: ${selector}`);
  }
  if (!(found instanceof ctor)) {
    throw new Error(`要素の型が想定と違います: ${selector}`);
  }
  return found;
}

/** テキストノードとして安全に差し替える（NFR-007: 入力を innerHTML へ流さない） */
export function setText(element: Element, text: string): void {
  element.textContent = text;
}

/**
 * 自前で組み立てた SVG 文字列だけを流し込む。
 * 渡ってよいのは `render.ts` / `draftGuide.ts` の出力に限る。いずれも数値と
 * 列挙値、`escapeXml` 済みのテキストしか含まないため、ユーザー入力は混入しない。
 */
export function setSvg(element: Element, markup: string): void {
  element.innerHTML = markup;
}

export function setHidden(element: HTMLElement, hidden: boolean): void {
  element.hidden = hidden;
}
