import { describe, expect, it } from 'vitest';
import { blur, decodeOnce, runTrials, upscale } from './decodeTrials';
import { halftone, subGridSize, upscalePlain } from './halftone';
import { buildProtectMask, generateMatrix, type QrMatrix } from './qr';
import { gridToLuminance } from './render';
import type { ProtectLevel } from './types';

const TEXT = 'https://example.com/halftone-qr';

function matrixOf(text = TEXT): QrMatrix {
  const result = generateMatrix(text, 'H');
  if (!result.ok) throw new Error('fixture matrix failed to build');
  return result.matrix;
}

/** 決定的な擬似乱数画像 */
function seededLuma(length: number, seed = 1): Float32Array {
  const out = new Float32Array(length);
  let state = seed;
  for (let i = 0; i < length; i += 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    out[i] = state / 4294967296;
  }
  return out;
}

/** 中央に暗い円がある、実写に近い低周波の画像 */
function blobLuma(size: number): Float32Array {
  const out = new Float32Array(size * size);
  const centre = (size - 1) / 2;
  const radius = size * 0.34;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - centre, y - centre);
      out[y * size + x] = distance < radius ? 0.12 : 0.93;
    }
  }
  return out;
}

function makeGrid(matrix: QrMatrix, luma: Float32Array | null, qrness: number, protect: ProtectLevel) {
  return halftone({ matrix, protectMask: buildProtectMask(matrix, protect), luma, qrness });
}

describe('upscale', () => {
  it('returns the source untouched at scale 1', () => {
    const image = { data: new Uint8ClampedArray([0, 255, 255, 0]), size: 2 };
    expect(upscale(image, 1)).toBe(image);
  });

  it('replicates each pixel into a scale x scale block', () => {
    const image = { data: new Uint8ClampedArray([0, 255, 255, 0]), size: 2 };
    const scaled = upscale(image, 2);
    expect(scaled.size).toBe(4);
    expect(Array.from(scaled.data.slice(0, 4))).toEqual([0, 0, 255, 255]);
    expect(Array.from(scaled.data.slice(4, 8))).toEqual([0, 0, 255, 255]);
    expect(Array.from(scaled.data.slice(8, 12))).toEqual([255, 255, 0, 0]);
  });
});

describe('blur', () => {
  it('is a no-op at radius 0', () => {
    const image = { data: new Uint8ClampedArray([0, 255, 255, 0]), size: 2 };
    expect(blur(image, 0)).toBe(image);
  });

  it('pulls extremes toward the middle', () => {
    const size = 9;
    const data = new Uint8ClampedArray(size * size).fill(255);
    data[4 * size + 4] = 0;
    const result = blur({ data, size }, 1);
    expect(result.data[4 * size + 4]).toBeGreaterThan(0);
    expect(result.data[4 * size + 5]).toBeLessThan(255);
  });

  it('preserves a uniform field', () => {
    const size = 8;
    const data = new Uint8ClampedArray(size * size).fill(200);
    const result = blur({ data, size }, 2);
    for (const value of result.data) expect(value).toBe(200);
  });
});

describe('decodeOnce — パイプライン全体の実デコード (AC-05)', () => {
  it('reads back a plain QR', async () => {
    const matrix = matrixOf();
    const image = upscale(gridToLuminance(upscalePlain(matrix), matrix.size), 3);
    expect(await decodeOnce(image, TEXT)).toBe(true);
  });

  it('reads back a halftone QR built from a photographic-style image', async () => {
    const matrix = matrixOf();
    const size = subGridSize(matrix.size);
    const grid = makeGrid(matrix, blobLuma(size), 0.35, 'patterns');
    const image = upscale(gridToLuminance(grid, matrix.size), 4);
    expect(await decodeOnce(image, TEXT)).toBe(true);
  });

  it('reads back a halftone QR at the default settings with noise', async () => {
    const matrix = matrixOf();
    const size = subGridSize(matrix.size);
    const grid = makeGrid(matrix, seededLuma(size * size, 17), 0.35, 'patterns');
    const image = upscale(gridToLuminance(grid, matrix.size), 4);
    expect(await decodeOnce(image, TEXT)).toBe(true);
  });

  it('rejects a mismatched expectation', async () => {
    const matrix = matrixOf();
    const image = upscale(gridToLuminance(upscalePlain(matrix), matrix.size), 3);
    expect(await decodeOnce(image, 'https://example.com/different')).toBe(false);
  });

  it('fails on an empty white field rather than reporting success', async () => {
    const size = 120;
    const image = { data: new Uint8ClampedArray(size * size).fill(255), size };
    expect(await decodeOnce(image, TEXT)).toBe(false);
  });
});

describe('runTrials', () => {
  it('returns one result per scan condition', async () => {
    const matrix = matrixOf();
    const grid = makeGrid(matrix, null, 0.35, 'patterns');
    const trials = await runTrials({ id: 1, grid, moduleCount: matrix.size, text: TEXT });
    expect(trials).toHaveLength(9);
  });

  it('passes every condition for an unmodified QR', async () => {
    const matrix = matrixOf();
    const grid = upscalePlain(matrix);
    const trials = await runTrials({ id: 1, grid, moduleCount: matrix.size, text: TEXT });
    expect(trials.filter((t) => t.ok)).toHaveLength(9);
  });

  it('rates the default halftone settings as readable in most conditions', async () => {
    const matrix = matrixOf();
    const size = subGridSize(matrix.size);
    const grid = makeGrid(matrix, blobLuma(size), 0.35, 'patterns');
    const trials = await runTrials({ id: 1, grid, moduleCount: matrix.size, text: TEXT });
    expect(trials.filter((t) => t.ok).length).toBeGreaterThanOrEqual(6);
  });

  it('improves as qrness rises on a hostile noisy image', async () => {
    const matrix = matrixOf();
    const size = subGridSize(matrix.size);
    const noisy = () => seededLuma(size * size, 23);

    const weak = await runTrials({
      id: 1,
      grid: makeGrid(matrix, noisy(), 0, 'none'),
      moduleCount: matrix.size,
      text: TEXT,
    });
    const strong = await runTrials({
      id: 2,
      grid: makeGrid(matrix, noisy(), 0.8, 'patterns'),
      moduleCount: matrix.size,
      text: TEXT,
    });

    expect(strong.filter((t) => t.ok).length).toBeGreaterThan(weak.filter((t) => t.ok).length);
  });

  it('reports failure for content that does not match the request', async () => {
    const matrix = matrixOf();
    const grid = upscalePlain(matrix);
    const trials = await runTrials({
      id: 1,
      grid,
      moduleCount: matrix.size,
      text: 'https://example.com/not-what-was-encoded',
    });
    expect(trials.every((t) => !t.ok)).toBe(true);
  });
});
