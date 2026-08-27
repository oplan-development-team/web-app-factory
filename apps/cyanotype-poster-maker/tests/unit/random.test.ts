import { describe, expect, it } from 'vitest';
import { fbm2D, jitter, mulberry32, pick, randFloat, randInt, valueNoise2D } from '../../src/core/random';

describe('mulberry32', () => {
  it('同一シードは同一の列を返す', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 64 }, () => a());
    const seqB = Array.from({ length: 64 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('シードが違えば列も違う', () => {
    const a = Array.from({ length: 16 }, mulberry32(1));
    const b = Array.from({ length: 16 }, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it('常に [0, 1) に収まる', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 5000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('負のシードでも例外なく回る', () => {
    const rng = mulberry32(-99);
    expect(Number.isFinite(rng())).toBe(true);
  });
});

describe('派生ヘルパ', () => {
  it('randFloat が範囲に収まる', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 1000; i++) {
      const v = randFloat(rng, -2, 5);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(5);
    }
  });

  it('randInt が両端を含む整数を返す', () => {
    const rng = mulberry32(11);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = randInt(rng, 2, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  it('randInt は min === max のとき常にその値', () => {
    const rng = mulberry32(1);
    expect(randInt(rng, 4, 4)).toBe(4);
  });

  it('pick は候補内から選ぶ', () => {
    const rng = mulberry32(5);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 200; i++) {
      expect(items).toContain(pick(rng, items));
    }
  });

  it('pick は空配列で例外', () => {
    expect(() => pick(mulberry32(1), [])).toThrow('候補が空です');
  });

  it('jitter は ±amount に収まる', () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 500; i++) {
      expect(Math.abs(jitter(rng, 3))).toBeLessThanOrEqual(3);
    }
  });
});

describe('value noise / fbm', () => {
  it('同一座標・同一シードは同一値', () => {
    expect(valueNoise2D(1.25, 4.5, 42)).toBe(valueNoise2D(1.25, 4.5, 42));
    expect(fbm2D(0.3, 0.7, 42)).toBe(fbm2D(0.3, 0.7, 42));
  });

  it('0..1 に収まる', () => {
    for (let i = 0; i < 400; i++) {
      const v = fbm2D(i * 0.37, i * 0.11, 8);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('連続している（近い座標は近い値）', () => {
    const a = valueNoise2D(3.0, 3.0, 1);
    const b = valueNoise2D(3.001, 3.0, 1);
    expect(Math.abs(a - b)).toBeLessThan(0.01);
  });

  it('離れた座標では値が変化する', () => {
    const samples = new Set<number>();
    for (let i = 0; i < 50; i++) samples.add(valueNoise2D(i * 3.7, i * 2.1, 1));
    expect(samples.size).toBeGreaterThan(40);
  });
});
