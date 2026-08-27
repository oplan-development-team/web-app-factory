import { beforeEach, describe, expect, it } from 'vitest';
import { setCanvasFactory } from '../../src/core/ctx2d';
import { mulberry32 } from '../../src/core/random';
import {
  TONE,
  arcSpine,
  insetArea,
  leafOutline,
  lerpPoint,
  paintGround,
  paintOrgan,
  ribbonOutline,
  strokeOrgan,
  waveLeafOutline,
  wobbleSpine,
} from '../../src/specimens/shared';
import { FakeCtx, fakeCanvasFactory, grayValueOf } from '../fakes/fakeCtx';

beforeEach(() => {
  setCanvasFactory(fakeCanvasFactory());
});

describe('地の露光面', () => {
  it('暗部で塗りつぶし、低解像度のムラを拡大して重ねる', () => {
    const ctx = new FakeCtx(1200, 1600);
    paintGround(ctx, 1200, 1600, 5);

    const base = ctx.calls.find((c) => c.op === 'fillRect');
    expect(grayValueOf(base?.fillStyle ?? '')).toBe(TONE.groundBase);

    const draw = ctx.calls.find((c) => c.op === 'drawImage');
    // 拡大元は低解像度、拡大先はプレート全面
    expect(draw?.args[0]).toBeLessThan(200);
    expect(draw?.args.slice(2)).toEqual([0, 0, 1200, 1600]);
  });

  it('プレート解像度が上がっても画素ループを回さない（描画回数が一定）', () => {
    const small = new FakeCtx(200, 260);
    const large = new FakeCtx(3600, 4800);
    paintGround(small, 200, 260, 1);
    paintGround(large, 3600, 4800, 1);
    expect(large.calls.length).toBe(small.calls.length);
  });

  it('地は暗部の帯に収まる（FR-122.1）', () => {
    const ctx = new FakeCtx(400, 400);
    paintGround(ctx, 400, 400, 3);
    for (const color of ctx.usedColors()) {
      const v = grayValueOf(color);
      if (v === null) continue;
      expect(v).toBeGreaterThanOrEqual(TONE.groundBase - TONE.groundSwing);
      expect(v).toBeLessThanOrEqual(TONE.groundBase + TONE.groundSwing);
    }
  });
});

describe('半影つきの塗り', () => {
  const square = (ctx: FakeCtx): void => {
    ctx.moveTo(10, 10);
    ctx.lineTo(90, 10);
    ctx.lineTo(90, 90);
    ctx.lineTo(10, 90);
    ctx.closePath();
  };

  it('外側のストロークを重ねてから塗る', () => {
    const ctx = new FakeCtx(100, 100);
    paintOrgan(ctx, (c) => square(c as FakeCtx), TONE.blade, 4);
    const strokes = ctx.calls.filter((c) => c.op === 'stroke');
    const fills = ctx.calls.filter((c) => c.op === 'fill');
    expect(strokes).toHaveLength(3);
    expect(fills).toHaveLength(1);
    // 半影は低不透明度、本体は不透明
    expect(strokes.every((s) => s.globalAlpha < 0.5)).toBe(true);
    expect(fills[0]?.globalAlpha).toBe(1);
  });

  it('外側ほど太いストロークになる', () => {
    const ctx = new FakeCtx(100, 100);
    paintOrgan(ctx, (c) => square(c as FakeCtx), TONE.blade, 6);
    const widths = ctx.calls.filter((c) => c.op === 'stroke').map((c) => c.lineWidth);
    expect(widths[0]).toBeGreaterThan(widths[1] as number);
    expect(widths[1]).toBeGreaterThan(widths[2] as number);
  });

  it('半影 0 では塗りだけになる', () => {
    const ctx = new FakeCtx(100, 100);
    paintOrgan(ctx, (c) => square(c as FakeCtx), TONE.blade, 0);
    expect(ctx.calls.filter((c) => c.op === 'stroke')).toHaveLength(0);
    expect(ctx.calls.filter((c) => c.op === 'fill')).toHaveLength(1);
  });

  it('描画回数は形の複雑さに比例しない', () => {
    const simple = new FakeCtx(100, 100);
    const complex = new FakeCtx(100, 100);
    paintOrgan(simple, (c) => square(c as FakeCtx), TONE.blade, 4);
    paintOrgan(
      complex,
      (c) => {
        c.moveTo(0, 0);
        for (let i = 0; i < 500; i++) c.lineTo(i % 100, (i * 7) % 100);
        c.closePath();
      },
      TONE.blade,
      4,
    );
    const count = (ctx: FakeCtx): number => ctx.calls.filter((c) => c.op === 'stroke' || c.op === 'fill').length;
    expect(count(complex)).toBe(count(simple));
  });

  it('状態を呼び出し元へ戻す', () => {
    const ctx = new FakeCtx(100, 100);
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 7;
    paintOrgan(ctx, (c) => square(c as FakeCtx), TONE.blade, 4);
    expect(ctx.globalAlpha).toBe(0.5);
    expect(ctx.lineWidth).toBe(7);
  });

  it('strokeOrgan は最後に不透明な本線を引く', () => {
    const ctx = new FakeCtx(100, 100);
    strokeOrgan(
      ctx,
      (c) => {
        c.moveTo(0, 50);
        c.lineTo(100, 50);
      },
      TONE.rib,
      2,
      3,
    );
    const strokes = ctx.calls.filter((c) => c.op === 'stroke');
    expect(strokes).toHaveLength(4);
    expect(strokes.at(-1)?.globalAlpha).toBe(1);
    expect(strokes.at(-1)?.lineWidth).toBe(2);
  });
});

describe('形の語彙', () => {
  it('lerpPoint が中点を返す', () => {
    expect(lerpPoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({ x: 5, y: 10 });
  });

  it('ribbonOutline は閉じたパスを組む', () => {
    const ctx = new FakeCtx(100, 100);
    ctx.beginPath();
    ribbonOutline(ctx, [{ x: 10, y: 90 }, { x: 10, y: 50 }, { x: 10, y: 10 }], () => 4);
    ctx.fill();
    expect(ctx.ops()).toContain('closePath');
    const bounds = ctx.paintedBounds[0];
    expect(bounds?.minX).toBeCloseTo(6);
    expect(bounds?.maxX).toBeCloseTo(14);
  });

  it('ribbonOutline は点が足りなければ何もしない', () => {
    const ctx = new FakeCtx(100, 100);
    ribbonOutline(ctx, [{ x: 0, y: 0 }], () => 3);
    expect(ctx.calls).toHaveLength(0);
  });

  it('leafOutline は基部と先端を結ぶ範囲に収まる', () => {
    const ctx = new FakeCtx(200, 200);
    ctx.beginPath();
    leafOutline(ctx, { x: 100, y: 180 }, { x: 100, y: 20 }, 30, 0.4);
    ctx.fill();
    const b = ctx.paintedBounds[0];
    expect(b?.minY).toBeLessThanOrEqual(20);
    expect(b?.maxY).toBeGreaterThanOrEqual(180 - 1);
  });

  it('waveLeafOutline は縁が波打つ（幅が一定でない）', () => {
    const ctx = new FakeCtx(200, 200);
    ctx.beginPath();
    waveLeafOutline(ctx, { x: 100, y: 190 }, { x: 100, y: 10 }, 30, 5, 0.35);
    ctx.fill();
    const xs = ctx.calls.filter((c) => c.op === 'lineTo').map((c) => c.args[0] as number);
    const distinct = new Set(xs.map((x) => Math.round(x)));
    expect(distinct.size).toBeGreaterThan(5);
  });

  it('arcSpine は両端を通り、中間が反る', () => {
    const spine = arcSpine({ x: 0, y: 100 }, { x: 0, y: 0 }, 20, 8);
    expect(spine[0]).toEqual({ x: 0, y: 100 });
    expect(spine.at(-1)?.y).toBeCloseTo(0);
    expect(Math.abs(spine[4]?.x ?? 0)).toBeGreaterThan(10);
  });

  it('wobbleSpine はシードで変わるが決定的', () => {
    const build = (seed: number): string =>
      JSON.stringify(wobbleSpine({ x: 0, y: 100 }, { x: 0, y: 0 }, 10, 8, mulberry32(seed), 6));
    expect(build(1)).toBe(build(1));
    expect(build(1)).not.toBe(build(2));
  });

  it('wobbleSpine の基部は動かない', () => {
    const spine = wobbleSpine({ x: 50, y: 100 }, { x: 50, y: 0 }, 0, 10, mulberry32(4), 20);
    expect(spine[0]?.x).toBeCloseTo(50);
  });

  it('insetArea が余白を確保する', () => {
    const area = insetArea(1000, 500, 0.1);
    expect(area).toEqual({ x: 100, y: 50, w: 800, h: 400 });
  });
});
