/**
 * 検査付きの DOM 取得（NFR-008.2）。
 * 無検査の `as` を使うと、マークアップを変えたときに
 * null を触るまでエラーが表面化せず、原因の遠い場所で落ちる。
 */

export function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  ctor: abstract new () => T,
): T {
  const element = root.querySelector(selector);
  if (element === null) {
    throw new Error(`要素が見つからない: ${selector}`);
  }
  if (!(element instanceof ctor)) {
    throw new Error(`要素の型が想定と違う: ${selector} は ${ctor.name} ではない`);
  }
  return element;
}

export function requireHtml(root: ParentNode, selector: string): HTMLElement {
  return requireElement(root, selector, HTMLElement);
}

export function requireButton(root: ParentNode, selector: string): HTMLButtonElement {
  return requireElement(root, selector, HTMLButtonElement);
}

/** テキストを設定する。`textContent` なので HTML として解釈されない。 */
export function setText(element: Element, text: string): void {
  element.textContent = text;
}
