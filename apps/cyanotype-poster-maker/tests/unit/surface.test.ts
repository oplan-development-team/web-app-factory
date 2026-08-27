import { beforeEach, describe, expect, it } from 'vitest';
import { setCanvasFactory } from '../../src/core/ctx2d';
import { buildEdgeMask } from '../../src/core/edgeMask';
import { applyPageAge, applyVignette } from '../../src/core/vignette';
import { createMottleSampler, mottledAlpha } from '../../src/core/mottle';
import { FakeCtx, fakeCanvasFactory } from '../fakes/fakeCtx';

beforeEach(() => {
  setCanvasFactory(fakeCanvasFactory());
});

describe('感光域の縁マスク', () => {
  it('直線マスクは余白ゼロの矩形', () => {
    const { canvas, pad } = buildEdgeMask(200, 300, 'straight', 1);
    expect(pad).toBe(0);
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(300);
  });

  it('ラフな縁は外側へ膨らむぶんの余白を持つ', () => {
    const { canvas, pad } = buildEdgeMask(200, 300, 'rough', 1);
    expect(pad).toBeGreaterThan(0);
    expect(canvas.width).toBe(200 + pad * 2);
    expect(canvas.height).toBe(300 + pad * 2);
  });

  it('小さい画像でも余白が最低 10px 確保される', () => {
    expect(buildEdgeMask(20, 20, 'rough', 1).pad).toBe(10);
  });

  it('ラフな縁は直線マスクと異なる形になる（AC-12）', () => {
    const straight = buildEdgeMask(120, 120, 'straight', 5).canvas;
    const rough = buildEdgeMask(120, 120, 'rough', 5).canvas;
    expect(rough.width).not.toBe(straight.width);
  });

  it('同一シードのラフな縁は同一の描画列になる', () => {
    const capture = (seed: number): string => {
      let recorded: FakeCtx | null = null;
      setCanvasFactory((w, h) => {
        const ctx = new FakeCtx(w, h);
        recorded = ctx;
        return { canvas: ctx.canvas, ctx };
      });
      buildEdgeMask(120, 160, 'rough', seed);
      return (recorded as FakeCtx | null)?.signature() ?? '';
    };
    expect(capture(3)).toBe(capture(3));
    expect(capture(3)).not.toBe(capture(4));
    expect(capture(3).length).toBeGreaterThan(100);
  });

  it('欠けは destination-out で食わせる', () => {
    let recorded: FakeCtx | null = null;
    setCanvasFactory((w, h) => {
      const ctx = new FakeCtx(w, h);
      recorded = ctx;
      return { canvas: ctx.canvas, ctx };
    });
    buildEdgeMask(200, 200, 'rough', 9);
    const ctx = recorded as FakeCtx | null;
    expect(ctx).not.toBeNull();
    const bites = ctx?.calls.filter((c) => c.composite === 'destination-out' && c.op === 'fill') ?? [];
    expect(bites.length).toBeGreaterThan(0);
  });
});

describe('周辺減光', () => {
  it('強度 0 では何も描かない', () => {
    const ctx = new FakeCtx(100, 100);
    applyVignette(ctx, 0, 0, 100, 100, '#123a63', 0);
    expect(ctx.calls).toHaveLength(0);
  });

  it('multiply で合成し、状態を戻す', () => {
    const ctx = new FakeCtx(100, 100);
    applyVignette(ctx, 10, 10, 80, 80, '#123a63', 0.5);
    const fill = ctx.calls.find((c) => c.op === 'fillRect');
    expect(fill?.composite).toBe('multiply');
    expect(ctx.ops()).toEqual(['save', 'fillRect', 'restore']);
    expect(ctx.globalCompositeOperation).toBe('source-over');
  });

  it('経年の暗化は常に適用される', () => {
    const ctx = new FakeCtx(100, 100);
    applyPageAge(ctx, 100, 100, '#123a63');
    expect(ctx.calls.find((c) => c.op === 'fillRect')?.args).toEqual([0, 0, 100, 100]);
  });
});

describe('藍液のムラ', () => {
  it('サンプラは 0..1 を返し、決定的', () => {
    const sampler = createMottleSampler(11);
    for (let i = 0; i < 100; i++) {
      const v = sampler(i / 100, (i * 7) / 100);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(sampler(0.3, 0.6)).toBe(createMottleSampler(11)(0.3, 0.6));
  });

  it('シードが違えば場も違う', () => {
    expect(createMottleSampler(1)(0.5, 0.5)).not.toBe(createMottleSampler(2)(0.5, 0.5));
  });

  it('強度 0 では常に不透明', () => {
    expect(mottledAlpha(0, 0)).toBe(1);
    expect(mottledAlpha(1, 0)).toBe(1);
  });

  it('強度を上げると薄い箇所ができる', () => {
    expect(mottledAlpha(0, 1)).toBeLessThan(1);
    expect(mottledAlpha(1, 1)).toBe(1);
  });

  it('常に 0..1 に収まる', () => {
    for (const s of [0, 0.5, 1, 2]) {
      for (const v of [0, 0.25, 0.75, 1]) {
        const a = mottledAlpha(v, s);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
      }
    }
  });
});
