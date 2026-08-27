import { describe, expect, it } from 'vitest';
import { clamp, clamp01, createCanvas, gray, hexToRgb, hexToRgba, setCanvasFactory } from '../../src/core/ctx2d';
import { FakeCtx, fakeCanvasFactory, grayValueOf } from '../fakes/fakeCtx';

describe('色ユーティリティ', () => {
  it('16進色を成分へ分解する', () => {
    expect(hexToRgb('#123a63')).toEqual({ r: 18, g: 58, b: 99 });
  });

  it('先頭の # が無くても解釈する', () => {
    expect(hexToRgb('ffffff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('rgba 文字列を組み立てる', () => {
    expect(hexToRgba('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
  });

  it('グレー値は 0-255 に丸められる', () => {
    expect(gray(300)).toBe('rgb(255, 255, 255)');
    expect(gray(-20)).toBe('rgb(0, 0, 0)');
    expect(gray(128.4)).toBe('rgb(128, 128, 128)');
  });

  it('clamp / clamp01 が範囲を守る', () => {
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(-1)).toBe(0);
    expect(clamp(5, 0, 3)).toBe(3);
  });
});

describe('キャンバス生成の注入口', () => {
  it('差し替えたファクトリが使われる', () => {
    setCanvasFactory(fakeCanvasFactory());
    const { ctx, canvas } = createCanvas(120, 80);
    expect(canvas.width).toBe(120);
    expect(canvas.height).toBe(80);
    expect(ctx).toBeInstanceOf(FakeCtx);
  });

  it('0 以下の寸法でも 1px 以上になる', () => {
    setCanvasFactory(fakeCanvasFactory());
    const { canvas } = createCanvas(0, -5);
    expect(canvas.width).toBe(1);
    expect(canvas.height).toBe(1);
  });
});

describe('フェイク context', () => {
  it('measureText はフォントサイズに比例する', () => {
    const ctx = new FakeCtx(100, 100);
    ctx.font = '20px serif';
    const wide = ctx.measureText('abcd').width;
    ctx.font = '10px serif';
    const narrow = ctx.measureText('abcd').width;
    expect(wide).toBeCloseTo(narrow * 2);
  });

  it('save / restore で状態が巻き戻る', () => {
    const ctx = new FakeCtx(10, 10);
    ctx.fillStyle = '#111111';
    ctx.save();
    ctx.fillStyle = '#222222';
    expect(ctx.fillStyle).toBe('#222222');
    ctx.restore();
    expect(ctx.fillStyle).toBe('#111111');
  });

  it('塗りに使われた色を集められる', () => {
    const ctx = new FakeCtx(10, 10);
    ctx.fillStyle = gray(40);
    ctx.fillRect(0, 0, 10, 10);
    ctx.fillStyle = gray(220);
    ctx.beginPath();
    ctx.moveTo(1, 1);
    ctx.lineTo(5, 5);
    ctx.fill();
    expect(ctx.usedColors().map(grayValueOf).sort((a, b) => Number(a) - Number(b))).toEqual([40, 220]);
  });

  it('パスの外接範囲を記録する', () => {
    const ctx = new FakeCtx(100, 100);
    ctx.beginPath();
    ctx.moveTo(10, 20);
    ctx.lineTo(60, 80);
    ctx.fill();
    expect(ctx.paintedBounds[0]).toMatchObject({ minX: 10, minY: 20, maxX: 60, maxY: 80 });
  });

  it('同じ操作列からは同じ署名が出る', () => {
    const build = (): FakeCtx => {
      const ctx = new FakeCtx(50, 50);
      ctx.fillStyle = gray(10);
      ctx.fillRect(0, 0, 50, 50);
      return ctx;
    };
    expect(build().signature()).toBe(build().signature());
  });
});
