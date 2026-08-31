/**
 * Node 25 exposes a native `localStorage` global, but without `--localstorage-file`
 * it is present yet non-functional (`setItem` is not a function). Worse, in the
 * vitest jsdom environment it shadows the working jsdom implementation.
 *
 * The production code guards against this with feature detection (see
 * infra/storage.ts), but tests that exercise the *happy* persistence path still
 * need a real Storage. Install an in-memory one whenever the ambient global
 * turns out to be unusable.
 */
function isUsable(candidate: unknown): candidate is Storage {
  if (!candidate || typeof candidate !== 'object') return false;
  const s = candidate as Partial<Storage>;
  if (typeof s.setItem !== 'function' || typeof s.getItem !== 'function') return false;
  try {
    const probe = '__tgg_probe__';
    s.setItem(probe, '1');
    s.removeItem?.(probe);
    return true;
  } catch {
    return false;
  }
}

export function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => {
      map.clear();
    },
  } as Storage;
}

if (!isUsable(globalThis.localStorage)) {
  const memory = createMemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: memory,
    configurable: true,
    writable: true,
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: memory,
      configurable: true,
      writable: true,
    });
  }
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});
