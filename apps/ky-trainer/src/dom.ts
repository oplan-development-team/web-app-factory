type Attrs = Record<string, string>;

interface ElementOptions {
  class?: string;
  text?: string;
  attrs?: Attrs;
}

/** 小さな DOM ビルダー。テキストは常に textContent 経由で入れるため XSS の心配がない。 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (options.class) el.className = options.class;
  if (options.text !== undefined) el.textContent = options.text;
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      el.setAttribute(key, value);
    }
  }
  for (const child of children) {
    el.append(child);
  }
  return el;
}

export function clearRoot(root: HTMLElement): void {
  root.replaceChildren();
}
