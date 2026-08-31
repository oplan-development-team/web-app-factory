import { describe, expect, test } from 'vitest';
import { createMemoryStorage } from './setup';

describe('test environment', () => {
  test('provides a functional localStorage despite the Node 25 native shim', () => {
    expect(typeof localStorage.setItem).toBe('function');
    localStorage.setItem('probe', 'value');
    expect(localStorage.getItem('probe')).toBe('value');
  });

  test('clears storage between tests', () => {
    expect(localStorage.getItem('probe')).toBeNull();
  });

  test('memory storage implements the Storage contract used by the app', () => {
    const s = createMemoryStorage();
    expect(s.getItem('missing')).toBeNull();
    s.setItem('a', '1');
    s.setItem('b', '2');
    expect(s.length).toBe(2);
    expect(s.key(0)).toBe('a');
    expect(s.getItem('a')).toBe('1');
    s.removeItem('a');
    expect(s.getItem('a')).toBeNull();
    s.clear();
    expect(s.length).toBe(0);
  });
});
