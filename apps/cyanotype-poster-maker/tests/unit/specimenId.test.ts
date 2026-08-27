import { describe, expect, it } from 'vitest';
import {
  analyzeFile,
  fallbackDigest,
  formatSpecimenNo,
  hashBytes,
  hashString,
  specimenNoForSeed,
} from '../../src/label/specimenId';

function fakeFile(name: string, size: number, bytes?: Uint8Array, lastModified = 1000): File {
  return {
    name,
    size,
    lastModified,
    slice: () => ({
      arrayBuffer: async (): Promise<ArrayBuffer> => {
        if (!bytes) throw new Error('読めない');
        return bytes.buffer.slice(0) as ArrayBuffer;
      },
    }),
  } as unknown as File;
}

describe('ハッシュ', () => {
  it('同一入力は同一値', () => {
    expect(hashString('cyanotype')).toBe(hashString('cyanotype'));
  });

  it('入力が違えば値も違う', () => {
    expect(hashString('a')).not.toBe(hashString('b'));
  });

  it('サロゲートペアを含む文字列でも落ちない', () => {
    expect(Number.isInteger(hashString('🌿標本𝔸'))).toBe(true);
  });

  it('常に符号なし 32bit に収まる', () => {
    for (const s of ['', 'x', '長い文字列'.repeat(50)]) {
      const h = hashString(s);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('バイト列でも同様', () => {
    const bytes = new Uint8Array([1, 2, 3, 250]);
    expect(hashBytes(bytes)).toBe(hashBytes(new Uint8Array([1, 2, 3, 250])));
    expect(hashBytes(bytes)).not.toBe(hashBytes(new Uint8Array([1, 2, 3, 251])));
  });
});

describe('標本番号の書式', () => {
  it('YYYY.NNNN.X 形式である', () => {
    expect(formatSpecimenNo(123456789, 2026)).toMatch(/^2026\.\d{4}\.[A-Z]$/);
  });

  it('連番部は 1000〜9999 に収まる', () => {
    for (let i = 0; i < 3000; i++) {
      const parts = formatSpecimenNo(i * 7919, 2026).split('.');
      const num = Number(parts[1]);
      expect(num).toBeGreaterThanOrEqual(1000);
      expect(num).toBeLessThanOrEqual(9999);
    }
  });

  it('負の値・巨大な値でも壊れない', () => {
    expect(formatSpecimenNo(-1, 2026)).toMatch(/^2026\.\d{4}\.[A-Z]$/);
    expect(formatSpecimenNo(0xffffffff, 2026)).toMatch(/^2026\.\d{4}\.[A-Z]$/);
  });

  it('年がそのまま先頭に入る', () => {
    expect(formatSpecimenNo(1, 1843).startsWith('1843.')).toBe(true);
  });
});

describe('所蔵標本の採番', () => {
  it('シードごとに決定的', () => {
    expect(specimenNoForSeed(42, 2026)).toBe(specimenNoForSeed(42, 2026));
  });

  it('再抽選（シード変更）で番号が変わる（FR-125.1）', () => {
    const numbers = new Set(Array.from({ length: 40 }, (_, i) => specimenNoForSeed(i, 2026)));
    // 完全な単射までは求めないが、ほとんど衝突しないこと
    expect(numbers.size).toBeGreaterThan(35);
  });
});

describe('ファイルからの採番', () => {
  it('crypto が使えるときは内容から導く', async () => {
    const bytes = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const a = await analyzeFile(fakeFile('a.jpg', 9, bytes), 2026);
    const b = await analyzeFile(fakeFile('a.jpg', 9, bytes), 2026);
    expect(a).toEqual(b);
    expect(a.specimenNo).toMatch(/^2026\.\d{4}\.[A-Z]$/);
  });

  it('内容が違えばシードも違う', async () => {
    const a = await analyzeFile(fakeFile('a.jpg', 4, new Uint8Array([1, 2, 3, 4])), 2026);
    const b = await analyzeFile(fakeFile('a.jpg', 4, new Uint8Array([4, 3, 2, 1])), 2026);
    expect(a.seed).not.toBe(b.seed);
  });

  it('crypto が使えなくても決定的に縮退する（FR-111.1）', async () => {
    // slice().arrayBuffer() が投げる = crypto 経路が使えない状況
    const broken = (): File => fakeFile('photo.jpg', 12345);
    const a = await analyzeFile(broken(), 2026);
    const b = await analyzeFile(broken(), 2026);
    expect(a).toEqual(b);
    expect(a.specimenNo).toMatch(/^2026\.\d{4}\.[A-Z]$/);
    expect(Number.isInteger(a.seed)).toBe(true);
  });

  it('縮退経路でもファイルが違えば値が違う', () => {
    const one = fallbackDigest(fakeFile('one.jpg', 100));
    const two = fallbackDigest(fakeFile('two.jpg', 100));
    const sameNameOtherSize = fallbackDigest(fakeFile('one.jpg', 200));
    expect(one.accession).not.toBe(two.accession);
    expect(one.accession).not.toBe(sameNameOtherSize.accession);
  });

  it('縮退経路でも受入番号とシードは別の値になる', () => {
    const digest = fallbackDigest(fakeFile('x.jpg', 1));
    expect(digest.accession).not.toBe(digest.seed);
  });
});
