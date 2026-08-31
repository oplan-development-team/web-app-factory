import { describe, expect, test } from 'vitest';
import { DISPLAY_TIME_SCALE } from './constants';
import { formatDateTime, formatDuration, formatNeglect } from './format';

describe('formatDuration', () => {
  test('renders seconds under a minute', () => {
    expect(formatDuration(0)).toBe('0秒');
    expect(formatDuration(45_000)).toBe('45秒');
  });

  test('renders minutes and seconds under an hour', () => {
    expect(formatDuration(60_000)).toBe('1分0秒');
    expect(formatDuration(90_000)).toBe('1分30秒');
  });

  test('renders hours and minutes under a day', () => {
    expect(formatDuration(3_600_000)).toBe('1時間0分');
    expect(formatDuration(3_600_000 + 120_000)).toBe('1時間2分');
  });

  test('renders days and hours beyond a day', () => {
    expect(formatDuration(86_400_000)).toBe('1日0時間');
    expect(formatDuration(86_400_000 * 2 + 3_600_000 * 5)).toBe('2日5時間');
  });
});

describe('formatNeglect', () => {
  test('dramatizes real time by DISPLAY_TIME_SCALE (FR-100)', () => {
    // 3 real minutes should read as 3 story hours.
    expect(formatNeglect(3 * 60 * 1000)).toBe('3時間0分');
  });

  test('is exactly formatDuration of the scaled span', () => {
    const real = 12_345;
    expect(formatNeglect(real)).toBe(formatDuration(real * DISPLAY_TIME_SCALE));
  });

  test('treats negative spans as zero rather than emitting a negative label', () => {
    expect(formatNeglect(-5000)).toBe('0秒');
  });
});

describe('formatDateTime', () => {
  test('zero-pads to a stable YYYY/MM/DD HH:MM shape', () => {
    const d = new Date(2026, 0, 5, 9, 7);
    expect(formatDateTime(d.getTime())).toBe('2026/01/05 09:07');
  });
});
