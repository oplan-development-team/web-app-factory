import { describe, expect, it } from 'vitest';
import { validateLogoFile } from './logo';
import { LOGO_MAX_BYTES } from './types';

const file = (bytes: number, type: string): File =>
  new File([new Uint8Array(bytes)], 'logo', { type });

describe('validateLogoFile', () => {
  it('accepts a small image', () => {
    expect(validateLogoFile(file(1024, 'image/png'))).toBeNull();
    expect(validateLogoFile(file(1024, 'image/svg+xml'))).toBeNull();
  });

  it('rejects a non-image file', () => {
    expect(validateLogoFile(file(10, 'application/pdf'))).toMatch(/画像ファイル/);
  });

  it('rejects a file over the size limit', () => {
    expect(validateLogoFile(file(LOGO_MAX_BYTES + 1, 'image/png'))).toMatch(/大きすぎます/);
  });

  it('accepts a file exactly at the limit', () => {
    expect(validateLogoFile(file(LOGO_MAX_BYTES, 'image/png'))).toBeNull();
  });
});
