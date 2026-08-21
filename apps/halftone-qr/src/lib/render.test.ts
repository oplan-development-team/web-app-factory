import { describe, expect, it } from 'vitest';
import {
  QUIET_SUB,
  gridToLuminance,
  luminanceToRgba,
  outputSubSize,
  pxPerSubFor,
} from './render';
import { SUB } from './types';

describe('outputSubSize', () => {
  it('adds a 4-module quiet zone on both sides', () => {
    expect(QUIET_SUB).toBe(12);
    expect(outputSubSize(21)).toBe(21 * SUB + 24);
    expect(outputSubSize(45)).toBe(45 * SUB + 24);
  });
});

describe('gridToLuminance', () => {
  const moduleCount = 5;
  const inner = moduleCount * SUB;

  function solidGrid(value: number): Uint8Array {
    return new Uint8Array(inner * inner).fill(value);
  }

  it('produces a square buffer of the expected size', () => {
    const image = gridToLuminance(solidGrid(0), moduleCount);
    expect(image.size).toBe(outputSubSize(moduleCount));
    expect(image.data).toHaveLength(image.size * image.size);
  });

  it('keeps the quiet zone white even when the payload is entirely black', () => {
    const image = gridToLuminance(solidGrid(1), moduleCount);
    const { data, size } = image;

    for (let x = 0; x < size; x += 1) {
      expect(data[x]).toBe(255); // 上端
      expect(data[(size - 1) * size + x]).toBe(255); // 下端
      expect(data[x * size]).toBe(255); // 左端
      expect(data[x * size + size - 1]).toBe(255); // 右端
    }
  });

  it('maps grid value 1 to black and 0 to white', () => {
    const grid = new Uint8Array(inner * inner);
    grid[0] = 1;
    const { data, size } = gridToLuminance(grid, moduleCount);
    expect(data[QUIET_SUB * size + QUIET_SUB]).toBe(0);
    expect(data[QUIET_SUB * size + QUIET_SUB + 1]).toBe(255);
  });

  it('offsets the payload by exactly the quiet zone', () => {
    const grid = new Uint8Array(inner * inner).fill(1);
    const { data, size } = gridToLuminance(grid, moduleCount);
    // クワイエットゾーンの内側 1px 手前は白、内側の先頭は黒
    expect(data[(QUIET_SUB - 1) * size + QUIET_SUB]).toBe(255);
    expect(data[QUIET_SUB * size + QUIET_SUB - 1]).toBe(255);
    expect(data[QUIET_SUB * size + QUIET_SUB]).toBe(0);
    // 反対側も同様
    const end = QUIET_SUB + inner - 1;
    expect(data[end * size + end]).toBe(0);
    expect(data[(end + 1) * size + end]).toBe(255);
  });

  it('counts exactly as many black pixels as set grid cells', () => {
    const grid = new Uint8Array(inner * inner);
    for (let i = 0; i < grid.length; i += 3) grid[i] = 1;
    const expected = grid.reduce((acc: number, v) => acc + v, 0);
    const { data } = gridToLuminance(grid, moduleCount);
    const actual = Array.from(data).filter((v) => v === 0).length;
    expect(actual).toBe(expected);
  });
});

describe('luminanceToRgba', () => {
  it('expands each luminance byte into an opaque grey pixel', () => {
    const rgba = luminanceToRgba({ data: new Uint8ClampedArray([0, 255]), size: 2 });
    expect(Array.from(rgba)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });
});

describe('pxPerSubFor', () => {
  it('picks the largest integer scale that fits the target', () => {
    const moduleCount = 21;
    const sub = outputSubSize(moduleCount); // 87
    expect(pxPerSubFor(moduleCount, sub * 4)).toBe(4);
    expect(pxPerSubFor(moduleCount, sub * 4 + 10)).toBe(4);
  });

  it('never drops below 1', () => {
    expect(pxPerSubFor(177, 10)).toBe(1);
    expect(pxPerSubFor(21, 0)).toBe(1);
  });
});
