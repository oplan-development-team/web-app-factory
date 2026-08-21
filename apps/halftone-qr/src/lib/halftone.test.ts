import { describe, expect, it } from 'vitest';
import { halftone, subGridSize, upscalePlain, verifyCenterBits } from './halftone';
import { buildProtectMask, generateMatrix, type QrMatrix } from './qr';
import { SUB, type ProtectLevel } from './types';

function matrixOf(text = 'https://example.com/halftone'): QrMatrix {
  const result = generateMatrix(text, 'H');
  if (!result.ok) throw new Error('fixture matrix failed to build');
  return result.matrix;
}

/** 決定的な擬似乱数（テストを再現可能にする） */
function seededLuma(length: number, seed = 1): Float32Array {
  const out = new Float32Array(length);
  let state = seed;
  for (let i = 0; i < length; i += 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    out[i] = state / 4294967296;
  }
  return out;
}

function gradientLuma(size: number): Float32Array {
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) out[y * size + x] = x / (size - 1);
  }
  return out;
}

function constantLuma(size: number, value: number): Float32Array {
  return new Float32Array(size * size).fill(value);
}

const LEVELS: ProtectLevel[] = ['none', 'patterns', 'all'];

describe('halftone — 中央ビット固定の不変条件 (FR-006.2 / AC-03)', () => {
  const matrix = matrixOf();
  const size = subGridSize(matrix.size);

  it('holds for every combination of qrness and protection level', () => {
    const images = [
      seededLuma(size * size, 7),
      gradientLuma(size),
      constantLuma(size, 0),
      constantLuma(size, 1),
      constantLuma(size, 0.5),
      null,
    ];

    for (const qrness of [0, 0.15, 0.35, 0.5, 0.75, 1]) {
      for (const level of LEVELS) {
        const protectMask = buildProtectMask(matrix, level);
        for (const luma of images) {
          const grid = halftone({ matrix, protectMask, luma, qrness });
          expect(
            verifyCenterBits(matrix, grid),
            `centre bits broke at qrness=${qrness} level=${level}`,
          ).toBe(true);
        }
      }
    }
  });

  it('holds across several QR versions', () => {
    for (const text of ['a', 'https://example.com', 'x'.repeat(300), 'あ'.repeat(120)]) {
      const result = generateMatrix(text, 'H');
      if (!result.ok) continue;
      const current = result.matrix;
      const grid = halftone({
        matrix: current,
        protectMask: buildProtectMask(current, 'patterns'),
        luma: seededLuma(subGridSize(current.size) ** 2, 3),
        qrness: 0.35,
      });
      expect(verifyCenterBits(current, grid)).toBe(true);
    }
  });

  it('detects a broken centre bit', () => {
    // verifyCenterBits 自体が機能していることの確認（テストの偽陽性防止）
    const grid = halftone({
      matrix,
      protectMask: buildProtectMask(matrix, 'none'),
      luma: null,
      qrness: 0,
    });
    // モジュール(1,0)の中央サブモジュール = (y, x) = (1*3+1, 0*3+1)
    const centre = (1 * SUB + 1) * size + (0 * SUB + 1);
    grid[centre] = grid[centre] === 1 ? 0 : 1;
    expect(verifyCenterBits(matrix, grid)).toBe(false);
  });
});

describe('halftone — 出力の形', () => {
  const matrix = matrixOf();
  const size = subGridSize(matrix.size);

  it('returns a 3N x 3N grid of 0/1', () => {
    const grid = halftone({
      matrix,
      protectMask: buildProtectMask(matrix, 'patterns'),
      luma: gradientLuma(size),
      qrness: 0.35,
    });
    expect(grid).toHaveLength(size * size);
    expect(size).toBe(matrix.size * 3);
    for (const value of grid) expect(value === 0 || value === 1).toBe(true);
  });

  it('is deterministic for identical input', () => {
    const args = {
      matrix,
      protectMask: buildProtectMask(matrix, 'patterns'),
      luma: seededLuma(size * size, 11),
      qrness: 0.4,
    };
    const first = halftone({ ...args, luma: seededLuma(size * size, 11) });
    const second = halftone({ ...args, luma: seededLuma(size * size, 11) });
    expect(Array.from(first)).toEqual(Array.from(second));
  });

  it('reproduces the plain QR exactly when no image is supplied', () => {
    const grid = halftone({
      matrix,
      protectMask: buildProtectMask(matrix, 'none'),
      luma: null,
      qrness: 0,
    });
    expect(Array.from(grid)).toEqual(Array.from(upscalePlain(matrix)));
  });
});

describe('halftone — QR らしさ λ の効き (FR-006.6 / AC-04)', () => {
  const matrix = matrixOf();
  const size = subGridSize(matrix.size);

  /** 元 QR を 3 倍拡大したものとの一致率 */
  function agreementWithPlain(grid: Uint8Array): number {
    const plain = upscalePlain(matrix);
    let same = 0;
    for (let i = 0; i < grid.length; i += 1) if (grid[i] === plain[i]) same += 1;
    return same / grid.length;
  }

  it('moves monotonically toward the plain QR as qrness rises', () => {
    const protectMask = buildProtectMask(matrix, 'none');
    const scores = [0, 0.25, 0.5, 0.75, 1].map((qrness) =>
      agreementWithPlain(
        halftone({ matrix, protectMask, luma: seededLuma(size * size, 5), qrness }),
      ),
    );

    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1] - 0.01);
    }
    expect(scores[scores.length - 1]).toBeGreaterThan(scores[0] + 0.1);
  });

  it('collapses back to the plain QR exactly at qrness = 1', () => {
    // スライダーの上端は「最も読み取りやすい状態」であってほしいので、
    // 斜め 4 隅も含めて完全に元の QR へ戻ることを保証する
    const grid = halftone({
      matrix,
      protectMask: buildProtectMask(matrix, 'none'),
      luma: seededLuma(size * size, 9),
      qrness: 1,
    });
    expect(agreementWithPlain(grid)).toBe(1);
    expect(Array.from(grid)).toEqual(Array.from(upscalePlain(matrix)));
  });

  it('follows the image closely at qrness = 0', () => {
    // 中央以外は画像に従うので、暗い画像なら黒が支配的になる
    const dark = halftone({
      matrix,
      protectMask: buildProtectMask(matrix, 'none'),
      luma: constantLuma(size, 0.05),
      qrness: 0,
    });
    const light = halftone({
      matrix,
      protectMask: buildProtectMask(matrix, 'none'),
      luma: constantLuma(size, 0.95),
      qrness: 0,
    });
    const darkRatio = dark.reduce((acc, v) => acc + v, 0) / dark.length;
    const lightRatio = light.reduce((acc, v) => acc + v, 0) / light.length;
    expect(darkRatio).toBeGreaterThan(0.85);
    expect(lightRatio).toBeLessThan(0.15);
  });
});

describe('halftone — 機能パターンの保護 (FR-006.7)', () => {
  const matrix = matrixOf();
  const size = subGridSize(matrix.size);

  it('renders protected modules as solid 3x3 blocks of the original value', () => {
    const protectMask = buildProtectMask(matrix, 'patterns');
    const grid = halftone({
      matrix,
      protectMask,
      luma: seededLuma(size * size, 13),
      qrness: 0,
    });

    for (let row = 0; row < matrix.size; row += 1) {
      for (let col = 0; col < matrix.size; col += 1) {
        const moduleIndex = row * matrix.size + col;
        if (protectMask[moduleIndex] !== 1) continue;
        const expected = matrix.bits[moduleIndex];
        for (let dy = 0; dy < SUB; dy += 1) {
          for (let dx = 0; dx < SUB; dx += 1) {
            const index = (row * SUB + dy) * size + (col * SUB + dx);
            expect(grid[index]).toBe(expected);
          }
        }
      }
    }
  });

  it('keeps the finder corners intact even with a hostile image', () => {
    const grid = halftone({
      matrix,
      protectMask: buildProtectMask(matrix, 'patterns'),
      luma: constantLuma(size, 1), // 真っ白 = 全部白にしたがる入力
      qrness: 0,
    });
    // 左上ファインダーの外周は黒
    expect(grid[0]).toBe(1);
    expect(grid[1]).toBe(1);
    expect(grid[size]).toBe(1);
  });

  it('leaves data modules free to follow the image at level none', () => {
    const grid = halftone({
      matrix,
      protectMask: buildProtectMask(matrix, 'none'),
      luma: constantLuma(size, 1),
      qrness: 0,
    });
    // 保護なし・真っ白画像なら、中央以外はすべて白になる
    expect(grid[0]).toBe(matrix.bits[0] === 1 ? 0 : 0);
    let darkNonCentre = 0;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (y % SUB === 1 && x % SUB === 1) continue;
        if (grid[y * size + x] === 1) darkNonCentre += 1;
      }
    }
    expect(darkNonCentre).toBe(0);
  });
});

describe('upscalePlain', () => {
  it('expands each module into a 3x3 block', () => {
    const matrix = matrixOf('abc');
    const size = subGridSize(matrix.size);
    const grid = upscalePlain(matrix);
    for (let row = 0; row < matrix.size; row += 1) {
      for (let col = 0; col < matrix.size; col += 1) {
        const expected = matrix.bits[row * matrix.size + col];
        for (let dy = 0; dy < SUB; dy += 1) {
          for (let dx = 0; dx < SUB; dx += 1) {
            expect(grid[(row * SUB + dy) * size + (col * SUB + dx)]).toBe(expected);
          }
        }
      }
    }
  });
});
