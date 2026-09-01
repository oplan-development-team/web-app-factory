import { describe, expect, it } from 'vitest';

import { cropGray, squashWidth } from '../../src/core/gray-scale';
import { averageColor, canvasToGray, imageToGray, luminance } from '../../src/imaging/raster';
import { context2d } from '../../src/imaging/surface';
import { fakeCanvas, fakeFactory, fakeSource } from '../helpers/fake-canvas';
import { noiseImage } from '../helpers/gray-fixtures';

describe('luminance', () => {
  it('uses BT.601 weights', () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(255, 5);
    expect(luminance(0, 0, 0)).toBe(0);
    expect(luminance(255, 0, 0)).toBeCloseTo(76.245, 3);
  });
});

describe('imageToGray', () => {
  it('rasterises at the requested size and reads back luminance', () => {
    const factory = fakeFactory((i) => (i % 4 === 3 ? 255 : 128));
    const gray = imageToGray(fakeSource(400, 800), 100, 200, factory);
    expect(gray.width).toBe(100);
    expect(gray.height).toBe(200);
    expect(gray.data).toHaveLength(100 * 200);
    expect(gray.data[0]).toBe(128);
  });

  it('scales the source into the destination rect in one drawImage call', () => {
    const factory = fakeFactory();
    imageToGray(fakeSource(400, 800), 100, 200, factory);
    const canvas = factory.created[0];
    expect(canvas?.calls).toHaveLength(1);
    expect(canvas?.calls[0]?.args).toEqual([0, 0, 100, 200, 0, 0, 100, 200]);
  });

  it('never produces a zero-sized surface', () => {
    const factory = fakeFactory();
    const gray = imageToGray(fakeSource(10, 10), 0, -5, factory);
    expect(gray.width).toBe(1);
    expect(gray.height).toBe(1);
  });

  it('rounds fractional target sizes', () => {
    const factory = fakeFactory();
    const gray = imageToGray(fakeSource(10, 10), 99.6, 40.2, factory);
    expect(gray.width).toBe(100);
    expect(gray.height).toBe(40);
  });
});

describe('averageColor', () => {
  it('averages the downsampled pixels', () => {
    const factory = fakeFactory((i) => [10, 20, 30, 255][i % 4] as number);
    expect(averageColor(fakeSource(500, 900), factory)).toEqual({ r: 10, g: 20, b: 30 });
  });

  it('samples from a small surface rather than the full image', () => {
    const factory = fakeFactory();
    averageColor(fakeSource(4000, 9000), factory);
    expect(factory.created[0]?.width).toBe(8);
    expect(factory.created[0]?.height).toBe(8);
  });
});

describe('canvasToGray', () => {
  it('converts an existing surface', () => {
    const canvas = fakeCanvas(4, 2, (i) => (i % 4 === 3 ? 255 : 200));
    const gray = canvasToGray(canvas);
    expect(gray.width).toBe(4);
    expect(gray.height).toBe(2);
    expect(Array.from(gray.data)).toEqual([200, 200, 200, 200, 200, 200, 200, 200]);
  });
});

describe('context2d', () => {
  it('throws a readable error when the context is unavailable', () => {
    const broken = { width: 1, height: 1, getContext: () => null };
    expect(() => context2d(broken)).toThrow(/コンテキスト/);
  });
});

describe('cropGray', () => {
  it('removes rows from both edges', () => {
    const source = noiseImage(4, 10, 301);
    const cropped = cropGray(source, 2, 3);
    expect(cropped.height).toBe(5);
    expect(Array.from(cropped.data.slice(0, 4))).toEqual(Array.from(source.data.slice(8, 12)));
  });

  it('returns the same object when nothing is cut', () => {
    const source = noiseImage(4, 10, 302);
    expect(cropGray(source, 0, 0)).toBe(source);
  });

  it('returns an empty image when the cuts consume everything', () => {
    const source = noiseImage(4, 10, 303);
    expect(cropGray(source, 10, 10).height).toBe(0);
    expect(cropGray(source, 999, 0).height).toBe(0);
  });

  it('ignores negative cuts', () => {
    const source = noiseImage(4, 10, 304);
    expect(cropGray(source, -5, -5)).toBe(source);
  });

  it('keeps working with squashWidth', () => {
    const source = noiseImage(40, 10, 305);
    const squashed = squashWidth(cropGray(source, 2, 2), 10);
    expect(squashed.width).toBe(10);
    expect(squashed.height).toBe(6);
  });
});
