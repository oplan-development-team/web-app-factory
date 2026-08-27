/**
 * jsdom 上で実際の起動処理を走らせるための足場。
 *
 * jsdom には Canvas 2D が無いので、`HTMLCanvasElement.getContext` を
 * フェイクへ差し替える。アプリ側は `Ctx2D` にしか依存していないので、
 * これで結線の検証ができる。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setCanvasFactory } from '../../src/core/ctx2d';
import { clearFiberCache } from '../../src/core/texture';
import { FakeCtx, fakeCanvasFactory } from '../fakes/fakeCtx';
import type { AppState } from '../../src/types';

// jsdom 環境では import.meta.url が file: スキームにならないので、
// vitest が渡すプロジェクトルートから解決する
const INDEX_HTML = resolve(process.cwd(), 'index.html');

export interface Harness {
  state: () => AppState;
  contexts: FakeCtx[];
}

function extractBody(html: string): string {
  const match = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  return match?.[1] ?? '';
}

export async function bootHarness(): Promise<Harness> {
  const contexts: FakeCtx[] = [];

  document.body.innerHTML = extractBody(readFileSync(INDEX_HTML, 'utf8')).replace(
    /<script[\s\S]*?<\/script>/gi,
    '',
  );

  setCanvasFactory(fakeCanvasFactory());
  clearFiberCache();

  // 画面上の <canvas> も同じフェイクを返すようにする
  HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement) {
    const ctx = new FakeCtx(this.width || 1, this.height || 1);
    contexts.push(ctx);
    return ctx as unknown as CanvasRenderingContext2D;
  } as HTMLCanvasElement['getContext'];

  if (!('fonts' in document)) {
    Object.defineProperty(document, 'fonts', {
      value: { load: async () => [], ready: Promise.resolve() },
      configurable: true,
    });
  }

  const { bootstrap } = await import('../../src/ui/app');
  bootstrap();

  const api = (window as unknown as { __cyanotype: { state: () => AppState } }).__cyanotype;
  return { state: api.state, contexts };
}

/** rAF ベースの再描画を待つ。変更直後に読むと前フレームの結果を見てしまう。 */
export async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

export function byId<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`要素が見つかりません: #${id}`);
  return found as T;
}

export function fireInput(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
