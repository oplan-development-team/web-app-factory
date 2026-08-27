import { beforeEach, describe, expect, it } from 'vitest';
import { setCanvasFactory } from '../../src/core/ctx2d';
import {
  TEXTURE_CACHE_LIMIT,
  clearFiberCache,
  fiberCacheSize,
  generateFiberTextureTile,
  getFiberTile,
} from '../../src/core/texture';
import { fakeCanvasFactory } from '../fakes/fakeCtx';

beforeEach(() => {
  setCanvasFactory(fakeCanvasFactory());
  clearFiberCache();
});

describe('繊維テクスチャ', () => {
  it('正方タイルを返す', () => {
    const tile = generateFiberTextureTile(1);
    expect(tile.width).toBe(tile.height);
    expect(tile.width).toBeGreaterThan(0);
  });

  it('同一シードは同一タイル', () => {
    const a = generateFiberTextureTile(42);
    const b = generateFiberTextureTile(42);
    expect(a.width).toBe(b.width);
  });
});

describe('タイルキャッシュ', () => {
  it('同一シードの2回目は同じインスタンスを返す', () => {
    const first = getFiberTile(7);
    const second = getFiberTile(7);
    expect(second).toBe(first);
    expect(fiberCacheSize()).toBe(1);
  });

  it('シードが違えば別インスタンス', () => {
    expect(getFiberTile(1)).not.toBe(getFiberTile(2));
    expect(fiberCacheSize()).toBe(2);
  });

  it('上限を超えて増え続けない（FR-302.2）', () => {
    for (let seed = 0; seed < TEXTURE_CACHE_LIMIT * 3; seed++) getFiberTile(seed);
    expect(fiberCacheSize()).toBe(TEXTURE_CACHE_LIMIT);
  });

  it('最近使ったタイルは追い出されない', () => {
    const keep = getFiberTile(0);
    for (let seed = 1; seed < TEXTURE_CACHE_LIMIT; seed++) {
      getFiberTile(seed);
      getFiberTile(0); // 参照し続ける
    }
    getFiberTile(999);
    expect(getFiberTile(0)).toBe(keep);
  });
});
