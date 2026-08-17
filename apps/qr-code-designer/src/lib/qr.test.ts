import { describe, expect, it } from 'vitest';
import { finderOrigins, generateMatrix, isDark, isInFinder } from './qr';

describe('generateMatrix', () => {
  it('reports empty input rather than throwing', () => {
    expect(generateMatrix('', 'M')).toEqual({ ok: false, reason: 'empty' });
  });

  it('treats whitespace-only input as empty', () => {
    expect(generateMatrix('   \n ', 'M')).toEqual({ ok: false, reason: 'empty' });
  });

  it('produces a square matrix whose size matches its version', () => {
    const result = generateMatrix('https://example.com', 'M');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { size, version, data } = result.matrix;
    expect(size).toBe(4 * version + 17);
    expect(data).toHaveLength(size * size);
  });

  it('always sets the top-left finder corner dark', () => {
    const result = generateMatrix('hello', 'M');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isDark(result.matrix, 0, 0)).toBe(true);
  });

  it('encodes multibyte text as UTF-8, not as one byte per character', () => {
    // 20 kanji are 60 bytes in UTF-8 but would be 20 in a single-byte encoding,
    // so the UTF-8 version number must be strictly larger.
    const kanji = generateMatrix('日'.repeat(20), 'L');
    const ascii = generateMatrix('a'.repeat(20), 'L');
    expect(kanji.ok && ascii.ok).toBe(true);
    if (!kanji.ok || !ascii.ok) return;
    expect(kanji.matrix.version).toBeGreaterThan(ascii.matrix.version);
  });

  it('reports overflow instead of throwing when the payload cannot fit', () => {
    const result = generateMatrix('a'.repeat(5000), 'H');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('overflow');
  });

  it('needs a larger version at H than at L for the same payload', () => {
    const low = generateMatrix('https://example.com/a-fairly-long-path', 'L');
    const high = generateMatrix('https://example.com/a-fairly-long-path', 'H');
    expect(low.ok && high.ok).toBe(true);
    if (!low.ok || !high.ok) return;
    expect(high.matrix.version).toBeGreaterThan(low.matrix.version);
  });
});

describe('isDark', () => {
  it('returns false outside the matrix instead of reading past the buffer', () => {
    const result = generateMatrix('hello', 'M');
    if (!result.ok) throw new Error('unreachable');
    expect(isDark(result.matrix, -1, 0)).toBe(false);
    expect(isDark(result.matrix, 0, result.matrix.size)).toBe(false);
  });
});

describe('finder helpers', () => {
  it('places the three finders at the expected corners', () => {
    expect(finderOrigins(25)).toEqual([
      [0, 0],
      [0, 18],
      [18, 0],
    ]);
  });

  it('covers exactly the 7x7 finder squares', () => {
    expect(isInFinder(25, 6, 6)).toBe(true);
    expect(isInFinder(25, 7, 7)).toBe(false);
    expect(isInFinder(25, 0, 24)).toBe(true);
    expect(isInFinder(25, 24, 24)).toBe(false);
  });
});
