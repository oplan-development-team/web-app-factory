import { describe, expect, test } from 'vitest';
import { formatDuration, formatGlimmer, formatRate } from './format';

describe('formatGlimmer', () => {
  test('groups thousands', () => {
    expect(formatGlimmer(12480)).toBe('12,480');
  });

  test('truncates rather than rounding up, so the shown value is always earned', () => {
    expect(formatGlimmer(99.99)).toBe('99');
  });

  test('floors at zero and survives garbage', () => {
    expect(formatGlimmer(-50)).toBe('0');
    expect(formatGlimmer(Number.NaN)).toBe('0');
  });
});

describe('formatRate', () => {
  test('keeps one decimal so upgrades visibly change it', () => {
    expect(formatRate(10.8)).toBe('+10.8 /秒');
  });

  test('shows a plain zero when nothing is accruing', () => {
    expect(formatRate(0)).toBe('+0 /秒');
    expect(formatRate(Number.NaN)).toBe('+0 /秒');
  });
});

describe('formatDuration', () => {
  test('uses seconds under a minute', () => {
    expect(formatDuration(0)).toBe('0秒');
    expect(formatDuration(59_999)).toBe('59秒');
  });

  test('uses whole minutes under an hour', () => {
    expect(formatDuration(60_000)).toBe('1分');
    expect(formatDuration(59 * 60_000)).toBe('59分');
  });

  test('uses hours and minutes above an hour', () => {
    expect(formatDuration(4 * 3600_000 + 12 * 60_000)).toBe('4時間12分');
  });

  test('drops the minutes component when it is zero', () => {
    expect(formatDuration(3 * 3600_000)).toBe('3時間');
  });

  test('switches to days for very long sessions', () => {
    expect(formatDuration(26 * 3600_000)).toBe('1日2時間');
    expect(formatDuration(48 * 3600_000)).toBe('2日');
  });

  test('treats negative and non-finite input as zero', () => {
    expect(formatDuration(-1)).toBe('0秒');
    expect(formatDuration(Number.NaN)).toBe('0秒');
  });
});
