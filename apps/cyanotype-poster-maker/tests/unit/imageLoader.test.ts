import { describe, expect, it } from 'vitest';
import {
  MAX_IMAGE_EDGE,
  MAX_IMAGE_PIXELS,
  checkImageSize,
  isAcceptedImageFile,
} from '../../src/source/imageLoader';

function fileOf(type: string): File {
  return { type } as File;
}

describe('受け入れ形式', () => {
  it('JPEG / PNG を受け入れる', () => {
    expect(isAcceptedImageFile(fileOf('image/jpeg'))).toBe(true);
    expect(isAcceptedImageFile(fileOf('image/png'))).toBe(true);
  });

  it('それ以外は受け付けない（FR-110.2）', () => {
    for (const type of ['image/gif', 'image/webp', 'image/svg+xml', 'application/pdf', 'text/plain', '']) {
      expect(isAcceptedImageFile(fileOf(type)), type).toBe(false);
    }
  });
});

describe('画素数の上限（FR-110.4）', () => {
  it('常識的な寸法は通る', () => {
    expect(checkImageSize(4032, 3024).ok).toBe(true);
    expect(checkImageSize(1, 1).ok).toBe(true);
  });

  it('長辺が上限を超えると拒否する', () => {
    const result = checkImageSize(MAX_IMAGE_EDGE + 1, 10);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('長辺');
  });

  it('長辺ちょうどは通る', () => {
    expect(checkImageSize(MAX_IMAGE_EDGE, 100).ok).toBe(true);
  });

  it('総画素数が上限を超えると拒否する', () => {
    // 各辺は上限内だが、面積で超える組み合わせ
    const edge = Math.ceil(Math.sqrt(MAX_IMAGE_PIXELS)) + 100;
    expect(edge).toBeLessThanOrEqual(MAX_IMAGE_EDGE);
    const result = checkImageSize(edge, edge);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('画素数');
  });

  it('寸法を読み取れない場合も拒否する', () => {
    expect(checkImageSize(0, 0).ok).toBe(false);
    expect(checkImageSize(-1, 100).ok).toBe(false);
  });

  it('拒否メッセージは対処法を含む', () => {
    expect(checkImageSize(MAX_IMAGE_EDGE + 1, 10).message).toContain('縮小');
  });
});
