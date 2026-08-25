/**
 * テスト実行前の下ごしらえ。
 *
 * この vitest / jsdom の組み合わせでは `window.localStorage` が空のオブジェクトで、
 * `getItem` すら生えていない。アプリ側は「使えない環境ならメモリ保持へ降格する」
 * 実装なので、そのまま走らせると永続化の経路が一切通らないままテストが通ってしまう。
 * ブラウザに近い挙動へ戻すため、最小限の Storage をここで入れておく。
 */

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

function hasWorkingStorage(candidate: unknown): boolean {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof (candidate as Storage).setItem === "function"
  );
}

if (typeof window !== "undefined" && !hasWorkingStorage(window.localStorage)) {
  Object.defineProperty(window, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}
