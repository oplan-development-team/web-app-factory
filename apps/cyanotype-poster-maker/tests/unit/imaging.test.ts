import { describe, expect, it } from 'vitest';
import { NEUTRAL_EXPOSURE, contrastFactor, toLuminance } from '../../src/core/grayscale';
import { floydSteinberg } from '../../src/core/dither';
import { coverRect, drawCoverFit } from '../../src/core/coverFit';
import type { ImageDataLike } from '../../src/core/ctx2d';
import { FakeCtx } from '../fakes/fakeCtx';

function imageOf(pixels: Array<[number, number, number]>, width: number): ImageDataLike {
  const height = pixels.length / width;
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b], i) => {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  });
  return { width, height, data };
}

describe('輝度化', () => {
  it('Rec.709 の係数で輝度を出す', () => {
    const img = imageOf(
      [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 255, 255],
      ],
      2,
    );
    const lum = toLuminance(img, 0);
    expect(lum[0]).toBeCloseTo(0.2126 * 255, 1);
    expect(lum[1]).toBeCloseTo(0.7152 * 255, 1);
    expect(lum[2]).toBeCloseTo(0.0722 * 255, 1);
    expect(lum[3]).toBeCloseTo(255, 1);
  });

  it('コントラスト 0 は無変換', () => {
    expect(contrastFactor(0)).toBeCloseTo(1, 6);
  });

  it('コントラストを上げると中間から離れる', () => {
    const img = imageOf(
      [
        [200, 200, 200],
        [60, 60, 60],
      ],
      2,
    );
    const flat = toLuminance(img, 0);
    const punchy = toLuminance(img, 60);
    expect(punchy[0] as number).toBeGreaterThan(flat[0] as number);
    expect(punchy[1] as number).toBeLessThan(flat[1] as number);
  });

  it('コントラストを下げると中間へ寄る', () => {
    const img = imageOf(
      [
        [255, 255, 255],
        [0, 0, 0],
      ],
      2,
    );
    const soft = toLuminance(img, -60);
    expect(soft[0] as number).toBeLessThan(255);
    expect(soft[1] as number).toBeGreaterThan(0);
  });

  it('露光を強めると全体が暗くなる（FR-203.3）', () => {
    const img = imageOf(
      [
        [180, 180, 180],
        [90, 90, 90],
      ],
      2,
    );
    const neutral = toLuminance(img, 0, NEUTRAL_EXPOSURE);
    const longer = toLuminance(img, 0, 195);
    const shorter = toLuminance(img, 0, 60);
    expect(longer[0] as number).toBeLessThan(neutral[0] as number);
    expect(shorter[0] as number).toBeGreaterThan(neutral[0] as number);
  });

  it('露光の既定値は無変換', () => {
    const img = imageOf([[200, 200, 200]], 1);
    expect(toLuminance(img, 0)[0]).toBeCloseTo(toLuminance(img, 0, NEUTRAL_EXPOSURE)[0] as number, 5);
  });

  it('露光を強めても 0..255 を超えない', () => {
    const img = imageOf(
      [
        [0, 0, 0],
        [255, 255, 255],
      ],
      2,
    );
    for (const v of toLuminance(img, 100, 200)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });

  it('範囲外のコントラストは丸められる', () => {
    expect(contrastFactor(500)).toBe(contrastFactor(100));
    expect(contrastFactor(-500)).toBe(contrastFactor(-100));
  });

  it('出力は常に 0..255', () => {
    const img = imageOf(Array.from({ length: 64 }, (_, i) => [i * 4, 255 - i * 3, i] as [number, number, number]), 8);
    for (const v of toLuminance(img, 100)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });
});

describe('Floyd-Steinberg 誤差拡散', () => {
  it('出力は 0 か 1 のみ（AC-10: 中間色を持たない）', () => {
    const lum = Float32Array.from({ length: 64 * 64 }, (_, i) => (i * 37) % 256);
    const bits = floydSteinberg(lum, 64, 64, 128);
    const values = new Set(bits);
    expect([...values].sort()).toEqual([0, 1]);
  });

  it('真っ黒はすべてインク、真っ白はすべて紙', () => {
    const black = floydSteinberg(new Float32Array(256).fill(0), 16, 16, 128);
    const white = floydSteinberg(new Float32Array(256).fill(255), 16, 16, 128);
    expect(black.every((b) => b === 1)).toBe(true);
    expect(white.every((b) => b === 0)).toBe(true);
  });

  it('出力の濃度は入力の明るさに追従し、しきい値ではほとんど動かない', () => {
    // 誤差拡散は、はみ出した誤差を隣へ送って帳尻を合わせる仕組みなので、
    // しきい値をどこへ置いても平均濃度は入力に従う。この性質があるため、
    // 「感光しきい値」は誤差拡散側ではなく露光量として効かせている
    // （grayscale.toLuminance の exposure）。
    const lum = new Float32Array(80 * 80).fill(160);
    const ratio = (t: number): number => floydSteinberg(lum, 80, 80, t).reduce((a: number, b) => a + b, 0) / lum.length;
    const expected = 1 - 160 / 255;
    for (const t of [80, 128, 180]) {
      expect(ratio(t)).toBeCloseTo(expected, 1);
    }
  });

  it('露光で輝度を下げるとインク画素が増える', () => {
    const bright = new Float32Array(60 * 60).fill(180);
    const dark = new Float32Array(60 * 60).fill(90);
    const count = (lum: Float32Array): number => floydSteinberg(lum, 60, 60, 128).reduce((a: number, b) => a + b, 0);
    expect(count(dark)).toBeGreaterThan(count(bright));
  });

  it('中間調のベタは、およそ半分がインクになる', () => {
    const bits = floydSteinberg(new Float32Array(100 * 100).fill(128), 100, 100, 128);
    const ratio = bits.reduce((a: number, b) => a + b, 0) / bits.length;
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it('決定的である', () => {
    const lum = Float32Array.from({ length: 32 * 32 }, (_, i) => (i * 91) % 256);
    expect(Array.from(floydSteinberg(lum, 32, 32, 128))).toEqual(Array.from(floydSteinberg(lum, 32, 32, 128)));
  });

  it('入力の輝度場を破壊しない', () => {
    const lum = Float32Array.from({ length: 16 }, (_, i) => i * 16);
    const copy = Float32Array.from(lum);
    floydSteinberg(lum, 4, 4, 128);
    expect(Array.from(lum)).toEqual(Array.from(copy));
  });

  it('1px 幅・1px 高でも落ちない', () => {
    expect(floydSteinberg(new Float32Array([10]), 1, 1, 128)).toEqual(new Uint8Array([1]));
  });
});

describe('cover 配置', () => {
  it('横長を縦長へ入れると左右が切られる', () => {
    const r = coverRect(400, 200, 100, 200);
    expect(r.sh).toBe(200);
    expect(r.sw).toBe(100);
    expect(r.sx).toBe(150);
    expect(r.sy).toBe(0);
  });

  it('縦長を横長へ入れると上下が切られる', () => {
    const r = coverRect(200, 400, 200, 100);
    expect(r.sw).toBe(200);
    expect(r.sh).toBe(100);
    expect(r.sy).toBe(150);
  });

  it('比が一致するときは全面を使う', () => {
    expect(coverRect(300, 400, 600, 800)).toEqual({ sx: 0, sy: 0, sw: 300, sh: 400 });
  });

  it('不正な寸法でも例外を出さない', () => {
    expect(coverRect(0, 0, 10, 10)).toEqual({ sx: 0, sy: 0, sw: 1, sh: 1 });
  });

  it('drawImage へ切り出し矩形が渡る', () => {
    const ctx = new FakeCtx(100, 200);
    const image = { naturalWidth: 400, naturalHeight: 200, width: 400, height: 200 } as HTMLImageElement;
    drawCoverFit(ctx, image, 100, 200);
    const call = ctx.calls.find((c) => c.op === 'drawImage');
    expect(call?.args.slice(2)).toEqual([150, 0, 100, 200, 0, 0, 100, 200]);
  });

  it('naturalWidth が無い要素でも width へ落ちる', () => {
    const ctx = new FakeCtx(50, 50);
    const image = { width: 100, height: 50 } as HTMLImageElement;
    drawCoverFit(ctx, image, 50, 50);
    const call = ctx.calls.find((c) => c.op === 'drawImage');
    expect(call?.args.slice(2, 6)).toEqual([25, 0, 50, 50]);
  });
});
