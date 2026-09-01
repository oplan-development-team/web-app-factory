import { describe, expect, it } from 'vitest';

import { computeLayout, noCuts } from '../../src/core/layout';
import type { ShotSize } from '../../src/core/types';
import { composeCanvas, seamView, type ShotSource } from '../../src/imaging/compose';
import { type FakeCanvas, fakeFactory, fakeSource } from '../helpers/fake-canvas';

const shotSource = (w: number, h: number): ShotSource => ({
  source: fakeSource(w, h),
  naturalWidth: w,
  naturalHeight: h,
});

const sizes = (...heights: readonly number[]): ShotSize[] =>
  heights.map((height) => ({ width: 100, height }));

describe('composeCanvas', () => {
  it('sizes the canvas from the layout', () => {
    const layout = computeLayout(sizes(400, 400), [100], noCuts);
    const factory = fakeFactory();
    const canvas = composeCanvas([shotSource(100, 400), shotSource(100, 400)], layout, { factory });
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(700);
  });

  it('applies a preview scale to the surface and every draw', () => {
    const layout = computeLayout(sizes(400, 400), [100], noCuts);
    const factory = fakeFactory();
    const canvas = composeCanvas([shotSource(100, 400), shotSource(100, 400)], layout, {
      factory,
      scale: 0.5,
    });
    expect(canvas.width).toBe(50);
    expect(canvas.height).toBe(350);
    const created = factory.created[0];
    expect(created?.calls[0]?.args.slice(4)).toEqual([0, 0, 50, 200]);
    expect(created?.calls[1]?.args.slice(4)).toEqual([0, 150, 50, 200]);
  });

  it('draws each shot once at its layout position', () => {
    const layout = computeLayout(sizes(400, 400, 400), [100, 60], noCuts);
    const factory = fakeFactory();
    composeCanvas([shotSource(100, 400), shotSource(100, 400), shotSource(100, 400)], layout, {
      factory,
    });
    const calls = factory.created[0]?.calls ?? [];
    expect(calls).toHaveLength(3);
    expect(calls.map((c) => c.args[5])).toEqual([0, 300, 640]);
  });

  it('repaints the band when the upper shot should win the seam', () => {
    const layout = computeLayout(sizes(400, 400), [100], noCuts);
    const factory = fakeFactory();
    composeCanvas([shotSource(100, 400), shotSource(100, 400)], layout, {
      factory,
      fronts: ['upper'],
    });
    const calls = factory.created[0]?.calls ?? [];
    expect(calls).toHaveLength(3);
    // Third call re-draws the upper shot's last 100 rows over the seam.
    expect(calls[2]?.args).toEqual([0, 300, 100, 100, 0, 300, 100, 100]);
  });

  it('does not repaint when the lower shot wins', () => {
    const layout = computeLayout(sizes(400, 400), [100], noCuts);
    const factory = fakeFactory();
    composeCanvas([shotSource(100, 400), shotSource(100, 400)], layout, {
      factory,
      fronts: ['lower'],
    });
    expect(factory.created[0]?.calls).toHaveLength(2);
  });

  it('skips the repaint when there is no overlap', () => {
    const layout = computeLayout(sizes(400, 400), [0], noCuts);
    const factory = fakeFactory();
    composeCanvas([shotSource(100, 400), shotSource(100, 400)], layout, {
      factory,
      fronts: ['upper'],
    });
    expect(factory.created[0]?.calls).toHaveLength(2);
  });

  it('translates cuts into source rectangles', () => {
    const layout = computeLayout(sizes(400, 400), [0], { headerPx: 40, footerPx: 20, trimEnds: true });
    const factory = fakeFactory();
    composeCanvas([shotSource(100, 400), shotSource(100, 400)], layout, { factory });
    const first = factory.created[0]?.calls[0];
    expect(first?.args.slice(0, 4)).toEqual([0, 40, 100, 340]);
  });

  it('scales the source rectangle when the shot is wider than the output', () => {
    const layout = computeLayout([{ width: 100, height: 400 }, { width: 100, height: 400 }], [0], noCuts);
    const factory = fakeFactory();
    // A 200x800 source normalised into a 100x400 slot: cuts map at 2x.
    composeCanvas([shotSource(200, 800), shotSource(200, 800)], layout, { factory });
    const first = factory.created[0]?.calls[0];
    expect(first?.args).toEqual([0, 0, 200, 800, 0, 0, 100, 400]);
  });

  it('paints a background when asked', () => {
    const layout = computeLayout(sizes(400, 400), [0], noCuts);
    const factory = fakeFactory();
    composeCanvas([shotSource(100, 400), shotSource(100, 400)], layout, {
      factory,
      background: '#123456',
    });
    expect(factory.created[0]?.fills[0]).toEqual({ style: '#123456', rect: [0, 0, 100, 800] });
  });

  it('tolerates a layout with more slots than sources', () => {
    const layout = computeLayout(sizes(400, 400), [0], noCuts);
    const factory = fakeFactory();
    expect(() => composeCanvas([shotSource(100, 400)], layout, { factory })).not.toThrow();
  });
});

describe('seamView', () => {
  const shots = [shotSource(100, 400), shotSource(100, 400)];

  it('crops the seam neighbourhood with surrounding context', () => {
    const layout = computeLayout(sizes(400, 400), [100], noCuts);
    const factory = fakeFactory();
    const view = seamView(shots, layout, 0, { factory, contextPx: 50 });
    expect(view).not.toBeNull();
    expect(view?.originY).toBe(250);
    expect(view?.bandY).toBe(50);
    expect(view?.bandHeight).toBe(100);
    expect(view?.canvas.height).toBe(200);
  });

  it('clamps the crop to the top of the composite', () => {
    const layout = computeLayout(sizes(60, 400), [10], noCuts);
    const factory = fakeFactory();
    const view = seamView(shots, layout, 0, { factory, contextPx: 500 });
    expect(view?.originY).toBe(0);
  });

  it('returns null for a seam index that does not exist', () => {
    const layout = computeLayout(sizes(400, 400), [100], noCuts);
    expect(seamView(shots, layout, 5, { factory: fakeFactory() })).toBeNull();
    expect(seamView([], layout, 0, { factory: fakeFactory() })).toBeNull();
  });

  it('writes an absolute difference over the band in diff mode', () => {
    const layout = computeLayout(sizes(400, 400), [100], noCuts);
    // Upper band reads 200, lower band reads 60 -> |200-60| = 140 everywhere.
    let created = 0;
    const factory = fakeFactory();
    const counting = Object.assign(
      (w: number, h: number) => {
        factory(w, h);
        const canvas = factory.created[factory.created.length - 1] as FakeCanvas;
        created += 1;
        if (created === 2) canvas.pixels = new Uint8ClampedArray(w * h * 4).fill(200);
        if (created === 3) canvas.pixels = new Uint8ClampedArray(w * h * 4).fill(60);
        return canvas;
      },
      { created: factory.created },
    );
    const view = seamView(shots, layout, 0, { factory: counting, diff: true, contextPx: 10 });
    const put = factory.created[0]?.puts[0];
    expect(put?.y).toBe(10);
    expect(put?.data.data[0]).toBe(140);
    expect(put?.data.data[3]).toBe(255);
    expect(view?.bandHeight).toBe(100);
  });

  it('skips the difference pass when there is no overlap', () => {
    const layout = computeLayout(sizes(400, 400), [0], noCuts);
    const factory = fakeFactory();
    seamView(shots, layout, 0, { factory, diff: true });
    expect(factory.created[0]?.puts).toHaveLength(0);
  });

  it('honours the front layer choice inside the crop', () => {
    const layout = computeLayout(sizes(400, 400), [100], noCuts);
    const factory = fakeFactory();
    seamView(shots, layout, 0, { factory, contextPx: 50, fronts: ['upper'] });
    const calls = factory.created[0]?.calls ?? [];
    expect(calls[calls.length - 1]?.args.slice(0, 4)).toEqual([0, 300, 100, 100]);
  });

  it('skips shots that fall outside the crop', () => {
    const layout = computeLayout(sizes(400, 400, 400), [100, 100], noCuts);
    const factory = fakeFactory();
    seamView([...shots, shotSource(100, 400)], layout, 0, { factory, contextPx: 20 });
    // Only the two shots forming this seam intersect the crop.
    expect(factory.created[0]?.calls).toHaveLength(2);
  });
});
