import { describe, expect, it } from 'vitest';
import { applyTone, computeDrawRect, rgbaToLuma, validateFile } from './image';

const NO_OFFSET = { zoom: 1, offsetX: 0, offsetY: 0 };

function file(type: string, size: number): File {
  return { type, size, name: 'x' } as File;
}

describe('validateFile', () => {
  it('accepts the supported image types', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']) {
      expect(validateFile(file(type, 1000)).ok).toBe(true);
    }
  });

  it('rejects unsupported types', () => {
    expect(validateFile(file('application/pdf', 1000))).toMatchObject({ ok: false });
    expect(validateFile(file('', 1000))).toMatchObject({ ok: false });
  });

  it('rejects files over 20MB', () => {
    expect(validateFile(file('image/png', 20 * 1024 * 1024 + 1))).toMatchObject({ ok: false });
    expect(validateFile(file('image/png', 20 * 1024 * 1024)).ok).toBe(true);
  });
});

describe('computeDrawRect', () => {
  it('covers the square exactly for a square image at zoom 1', () => {
    const rect = computeDrawRect(400, 400, 120, NO_OFFSET);
    expect(rect).toEqual({ dx: 0, dy: 0, dw: 120, dh: 120 });
  });

  it('overflows the long edge for a wide image, keeping aspect ratio', () => {
    const rect = computeDrawRect(400, 200, 100, NO_OFFSET);
    // 高さ基準で cover するので幅がはみ出す
    expect(rect.dh).toBe(100);
    expect(rect.dw).toBe(200);
    expect(rect.dw / rect.dh).toBeCloseTo(400 / 200);
    expect(rect.dx).toBe(-50);
    expect(rect.dy).toBe(0);
  });

  it('overflows the long edge for a tall image, keeping aspect ratio', () => {
    const rect = computeDrawRect(200, 400, 100, NO_OFFSET);
    expect(rect.dw).toBe(100);
    expect(rect.dh).toBe(200);
    expect(rect.dy).toBe(-50);
  });

  it('scales about the centre when zooming', () => {
    const base = computeDrawRect(400, 400, 100, NO_OFFSET);
    const zoomed = computeDrawRect(400, 400, 100, { ...NO_OFFSET, zoom: 2 });
    expect(zoomed.dw).toBe(base.dw * 2);
    // 中心が動かない
    expect(zoomed.dx + zoomed.dw / 2).toBeCloseTo(base.dx + base.dw / 2);
    expect(zoomed.dy + zoomed.dh / 2).toBeCloseTo(base.dy + base.dh / 2);
  });

  it('always responds to offset, even for a square image at zoom 1', () => {
    // 枠内にしか動けない実装だと正方形・等倍でオフセットが無反応になるので、
    // ここが効いていることが仕様上の要点（FR-004.2）
    const centred = computeDrawRect(400, 400, 100, NO_OFFSET);
    const shifted = computeDrawRect(400, 400, 100, { ...NO_OFFSET, offsetX: 1 });
    expect(shifted.dx - centred.dx).toBe(50);
  });

  it('moves by half the frame at the offset extremes', () => {
    const rect = computeDrawRect(400, 400, 200, { zoom: 1, offsetX: -1, offsetY: 1 });
    expect(rect.dx).toBe(-100);
    expect(rect.dy).toBe(100);
  });

  it('survives degenerate image dimensions', () => {
    const rect = computeDrawRect(0, 0, 100, NO_OFFSET);
    expect(Number.isFinite(rect.dw)).toBe(true);
    expect(rect.dw).toBeGreaterThan(0);
  });
});

describe('rgbaToLuma', () => {
  it('maps white to 1 and black to 0', () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    const luma = rgbaToLuma(rgba);
    expect(luma[0]).toBeCloseTo(1);
    expect(luma[1]).toBeCloseTo(0);
  });

  it('composites transparent pixels onto white rather than black', () => {
    // 素の RGBA を読むと透明部が黒扱いになり、全面が黒背景として量子化される
    const rgba = new Uint8ClampedArray([0, 0, 0, 0]);
    expect(rgbaToLuma(rgba)[0]).toBeCloseTo(1);
  });

  it('blends semi-transparent pixels toward white', () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 128]);
    const value = rgbaToLuma(rgba)[0];
    expect(value).toBeGreaterThan(0.4);
    expect(value).toBeLessThan(0.6);
  });

  it('weights green most heavily (Rec.709)', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]);
    const [red, green, blue] = rgbaToLuma(rgba);
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
    expect(red + green + blue).toBeCloseTo(1, 5);
  });

  it('reuses the provided output buffer', () => {
    const out = new Float32Array(1);
    const rgba = new Uint8ClampedArray([255, 255, 255, 255]);
    expect(rgbaToLuma(rgba, out)).toBe(out);
  });
});

describe('applyTone', () => {
  const neutral = { brightness: 0, contrast: 0, invert: false };

  it('leaves values untouched at neutral settings', () => {
    const luma = Float32Array.from([0, 0.25, 0.5, 0.75, 1]);
    const result = Array.from(applyTone(luma, neutral));
    expect(result).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('raises values with positive brightness', () => {
    const result = applyTone(Float32Array.from([0.5]), { ...neutral, brightness: 20 });
    expect(result[0]).toBeCloseTo(0.7);
  });

  it('pushes values away from the midpoint with positive contrast', () => {
    const result = applyTone(Float32Array.from([0.25, 0.75]), { ...neutral, contrast: 100 });
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(1);
  });

  it('collapses everything to mid grey at minimum contrast', () => {
    const result = applyTone(Float32Array.from([0, 0.5, 1]), { ...neutral, contrast: -100 });
    for (const value of result) expect(value).toBeCloseTo(0.5);
  });

  it('inverts when requested', () => {
    const result = applyTone(Float32Array.from([0, 0.25, 1]), { ...neutral, invert: true });
    expect(result[0]).toBeCloseTo(1);
    expect(result[1]).toBeCloseTo(0.75);
    expect(result[2]).toBeCloseTo(0);
  });

  it('clamps results into 0..1', () => {
    const result = applyTone(Float32Array.from([0, 1]), { ...neutral, brightness: 100, contrast: 100 });
    for (const value of result) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('ignores out-of-range adjustment values instead of producing NaN', () => {
    const result = applyTone(Float32Array.from([0.5]), {
      brightness: 9999,
      contrast: -9999,
      invert: false,
    });
    expect(Number.isNaN(result[0])).toBe(false);
    expect(result[0]).toBeGreaterThanOrEqual(0);
    expect(result[0]).toBeLessThanOrEqual(1);
  });
});
