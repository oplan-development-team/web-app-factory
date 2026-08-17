import { describe, expect, it } from 'vitest';
import { buildFileName } from './export';

const AUG_17 = new Date(2026, 7, 17);

describe('buildFileName', () => {
  it('strips the scheme and slugifies the host and path', () => {
    expect(buildFileName('https://example.com/shop', 'svg', AUG_17)).toBe(
      'qr-example-com-shop-20260817.svg',
    );
  });

  it('pads month and day to two digits', () => {
    expect(buildFileName('https://a.co', 'png', new Date(2026, 0, 5))).toBe('qr-a-co-20260105.png');
  });

  it('falls back to a generic slug when nothing ASCII survives', () => {
    expect(buildFileName('こんにちは', 'png', AUG_17)).toBe('qr-code-20260817.png');
  });

  it('falls back to a generic slug for empty input', () => {
    expect(buildFileName('   ', 'svg', AUG_17)).toBe('qr-code-20260817.svg');
  });

  it('caps the slug and never leaves a trailing separator', () => {
    const name = buildFileName('a'.repeat(80), 'png', AUG_17);
    expect(name).toBe(`qr-${'a'.repeat(40)}-20260817.png`);
  });

  it('collapses runs of punctuation into single separators', () => {
    expect(buildFileName('hello___world!!!', 'svg', AUG_17)).toBe('qr-hello-world-20260817.svg');
  });

  it('handles a mailto payload', () => {
    expect(buildFileName('mailto:hi@example.com', 'svg', AUG_17)).toBe(
      'qr-mailto-hi-example-com-20260817.svg',
    );
  });
});
