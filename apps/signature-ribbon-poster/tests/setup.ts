/**
 * jsdom has no 2D canvas implementation. The rendering layer is written against
 * the narrow `Ctx2D` interface (see `src/render/types.ts`) precisely so it can be
 * driven by a recording fake, but a few DOM-facing modules still call
 * `canvas.getContext("2d")` through an injected factory. Stubbing it here keeps
 * jsdom from printing "Not implemented" noise when a test forgets to inject one.
 */
HTMLCanvasElement.prototype.getContext = (() => null) as HTMLCanvasElement["getContext"];

/**
 * Node 25 ships a native `localStorage` global that shadows the jsdom one on
 * `window`, but it is inert unless the process was started with
 * `--localstorage-file`. Swap in a working in-memory Storage so tests exercise
 * the same code path a browser would.
 */
if (typeof window.localStorage?.setItem !== "function") {
  const entries = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return entries.size;
    },
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, String(value)),
    removeItem: (key) => void entries.delete(key),
    clear: () => entries.clear(),
  };
  Object.defineProperty(window, "localStorage", {
    value: memoryStorage,
    writable: true,
    configurable: true,
  });
}

if (!("PointerEvent" in globalThis)) {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  Object.defineProperty(globalThis, "PointerEvent", {
    value: PointerEventPolyfill,
    writable: true,
    configurable: true,
  });
}

if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => undefined;
  HTMLElement.prototype.releasePointerCapture = () => undefined;
  HTMLElement.prototype.hasPointerCapture = () => false;
}
