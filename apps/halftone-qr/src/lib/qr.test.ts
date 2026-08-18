import { describe, expect, it } from 'vitest';
import {
  Role,
  alignmentCenters,
  buildProtectMask,
  classifyRoles,
  generateMatrix,
} from './qr';

function countRole(roles: Uint8Array, role: number): number {
  let n = 0;
  for (const value of roles) if (value === role) n += 1;
  return n;
}

function expectOk(text: string, ecc: 'H' | 'Q' | 'M' = 'H') {
  const result = generateMatrix(text, ecc);
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return result.matrix;
}

describe('generateMatrix', () => {
  it('builds a matrix whose size follows 4 * version + 17', () => {
    const matrix = expectOk('https://example.com/halftone-qr');
    expect(matrix.size).toBe(4 * matrix.version + 17);
    expect(matrix.bits).toHaveLength(matrix.size * matrix.size);
    expect(matrix.roles).toHaveLength(matrix.size * matrix.size);
  });

  it('rejects empty and whitespace-only input', () => {
    expect(generateMatrix('', 'H')).toMatchObject({ ok: false, reason: 'empty' });
    expect(generateMatrix('   \n ', 'H')).toMatchObject({ ok: false, reason: 'empty' });
  });

  it('encodes multibyte text as UTF-8 bytes', () => {
    // 日本語 9 文字 = 27 バイト。ASCII 9 文字より確実に大きい型番になる
    const japanese = expectOk('こんにちは世界です');
    const ascii = expectOk('hellowrld');
    expect(japanese.version).toBeGreaterThan(ascii.version);
  });

  it('reports overflow instead of throwing when the payload cannot fit', () => {
    const result = generateMatrix('a'.repeat(20000), 'H');
    expect(result).toMatchObject({ ok: false, reason: 'overflow' });
  });

  it('needs a larger version at H than at M for the same payload', () => {
    const text = 'https://example.com/halftone-qr/sample/path?with=query';
    expect(expectOk(text, 'H').version).toBeGreaterThanOrEqual(expectOk(text, 'M').version);
  });
});

describe('alignmentCenters', () => {
  it('covers versions 1 through 40', () => {
    expect(alignmentCenters(1)).toEqual([]);
    for (let version = 2; version <= 40; version += 1) {
      expect(alignmentCenters(version).length).toBeGreaterThan(0);
    }
    expect(alignmentCenters(41)).toEqual([]);
  });

  it('starts at 6 and ends at size - 7 for every version with alignment patterns', () => {
    for (let version = 2; version <= 40; version += 1) {
      const centers = alignmentCenters(version);
      const size = 4 * version + 17;
      expect(centers[0]).toBe(6);
      expect(centers[centers.length - 1]).toBe(size - 7);
    }
  });

  it('matches the spec table at known versions', () => {
    expect(alignmentCenters(7)).toEqual([6, 22, 38]);
    expect(alignmentCenters(32)).toEqual([6, 34, 60, 86, 112, 138]);
    expect(alignmentCenters(40)).toEqual([6, 30, 58, 86, 114, 142, 170]);
  });
});

describe('classifyRoles', () => {
  it('assigns exactly three 7x7 finder blocks', () => {
    const matrix = expectOk('https://example.com');
    expect(countRole(matrix.roles, Role.Finder)).toBe(3 * 7 * 7);
  });

  it('places finders at the three expected corners', () => {
    const matrix = expectOk('https://example.com');
    const { size, roles } = matrix;
    expect(roles[0]).toBe(Role.Finder);
    expect(roles[size - 1]).toBe(Role.Finder);
    expect(roles[(size - 1) * size]).toBe(Role.Finder);
    // 右下にファインダーは無い
    expect(roles[(size - 1) * size + size - 1]).not.toBe(Role.Finder);
  });

  it('marks the timing rows and columns outside the finder area', () => {
    const matrix = expectOk('https://example.com');
    const { size, roles } = matrix;
    const mid = Math.floor(size / 2);
    expect(roles[6 * size + mid]).toBe(Role.Timing);
    expect(roles[mid * size + 6]).toBe(Role.Timing);
  });

  it('marks the dark module position as format information', () => {
    const matrix = expectOk('https://example.com');
    const { size, roles } = matrix;
    expect(roles[(size - 8) * size + 8]).toBe(Role.Format);
    expect(roles[8 * size + 8]).toBe(Role.Format);
  });

  it('emits version information blocks only from version 7 up', () => {
    for (let version = 1; version <= 12; version += 1) {
      const size = 4 * version + 17;
      const roles = classifyRoles(size, version);
      expect(countRole(roles, Role.Version)).toBe(version >= 7 ? 36 : 0);
    }
  });

  it('never overlaps alignment patterns with the finder corners', () => {
    for (let version = 2; version <= 40; version += 1) {
      const size = 4 * version + 17;
      const roles = classifyRoles(size, version);
      const corners = [
        [0, 0],
        [0, size - 1],
        [size - 1, 0],
      ];
      for (const [row, col] of corners) {
        expect(roles[row * size + col]).toBe(Role.Finder);
      }
    }
  });

  it('assigns a role to every module', () => {
    const known = new Set(Object.values(Role) as number[]);
    for (let version = 1; version <= 40; version += 2) {
      const size = 4 * version + 17;
      const roles = classifyRoles(size, version);
      expect(roles).toHaveLength(size * size);
      for (const role of roles) expect(known.has(role)).toBe(true);
    }
  });

  it('leaves the majority of a large symbol as data', () => {
    const size = 4 * 10 + 17;
    const roles = classifyRoles(size, 10);
    expect(countRole(roles, Role.Data) / (size * size)).toBeGreaterThan(0.8);
  });
});

describe('buildProtectMask', () => {
  it('protects nothing at level none', () => {
    const matrix = expectOk('https://example.com');
    const mask = buildProtectMask(matrix, 'none');
    expect(mask.some((v) => v === 1)).toBe(false);
  });

  it('grows monotonically with the protection level', () => {
    const matrix = expectOk('https://example.com/a/reasonably/long/url/for/version/growth');
    const sum = (mask: Uint8Array) => mask.reduce((acc, v) => acc + v, 0);
    const none = sum(buildProtectMask(matrix, 'none'));
    const patterns = sum(buildProtectMask(matrix, 'patterns'));
    const all = sum(buildProtectMask(matrix, 'all'));
    expect(none).toBe(0);
    expect(patterns).toBeGreaterThan(none);
    expect(all).toBeGreaterThan(patterns);
  });

  it('protects finder modules at level patterns but not data modules', () => {
    const matrix = expectOk('https://example.com');
    const mask = buildProtectMask(matrix, 'patterns');
    const { size, roles } = matrix;
    for (let i = 0; i < mask.length; i += 1) {
      if (roles[i] === Role.Finder) expect(mask[i]).toBe(1);
      if (roles[i] === Role.Data) expect(mask[i]).toBe(0);
    }
    expect(mask[0]).toBe(1);
    expect(size).toBeGreaterThan(0);
  });
});
