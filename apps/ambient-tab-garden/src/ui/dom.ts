/** Throws instead of returning null: a missing node is a build error, not a runtime state. */
export function must<T extends Element>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`missing element: ${selector}`);
  return el;
}

/** Writes only when the value actually changed, to avoid pointless layout work. */
export function setText(el: Element, value: string): boolean {
  if (el.textContent === value) return false;
  el.textContent = value;
  return true;
}

/** Restarts a CSS animation that is already applied to the element. */
export function replayAnimation(el: HTMLElement, className: string): void {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}
