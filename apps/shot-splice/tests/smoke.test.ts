import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('runs in a DOM environment', () => {
    expect(typeof document).toBe('object');
  });
});
