type Child = Node | string | null | undefined | false;

export interface ElProps {
  readonly class?: string;
  readonly text?: string;
  readonly type?: string;
  readonly title?: string;
  readonly html?: string;
  readonly attrs?: Readonly<Record<string, string | number | boolean | null>>;
  readonly on?: Readonly<Record<string, EventListener>>;
}

/** Minimal element builder. Attribute values of `null`/`false` are omitted. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.html !== undefined) node.innerHTML = props.html;
  if (props.title) node.title = props.title;
  if (props.type && 'type' in node) (node as unknown as { type: string }).type = props.type;
  for (const [key, value] of Object.entries(props.attrs ?? {})) {
    if (value === null || value === false) continue;
    node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const [event, handler] of Object.entries(props.on ?? {})) {
    node.addEventListener(event, handler);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Sets an attribute when the value is truthy, removes it otherwise. */
export function toggleAttr(node: Element, name: string, on: boolean): void {
  if (on) node.setAttribute(name, '');
  else node.removeAttribute(name);
}

export function setText(node: Element, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/**
 * Collapses repeated calls into one animation frame.
 *
 * Anything that redraws a canvas goes through this: a pointer drag can emit
 * dozens of moves per frame, and rendering each one would starve the frame it
 * is meant to land in.
 */
export function frameThrottle(fn: () => void): () => void {
  let handle: number | null = null;
  return () => {
    if (handle !== null) return;
    handle = requestAnimationFrame(() => {
      handle = null;
      fn();
    });
  };
}
