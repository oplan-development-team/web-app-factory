import { describe, expect, it } from 'vitest';
import { requestOrientationPermission } from './permission';

describe('requestOrientationPermission', () => {
  it('resolves to granted when the underlying promise resolves to "granted"', async () => {
    const outcome = await requestOrientationPermission(() => Promise.resolve('granted'));
    expect(outcome).toBe('granted');
  });

  it('resolves to denied when the underlying promise resolves to "denied"', async () => {
    const outcome = await requestOrientationPermission(() => Promise.resolve('denied'));
    expect(outcome).toBe('denied');
  });

  it('resolves to denied for any non-"granted" resolution value', async () => {
    const outcome = await requestOrientationPermission(() => Promise.resolve('prompt'));
    expect(outcome).toBe('denied');
  });

  it('resolves to denied (not a rejection) when the promise rejects', async () => {
    const outcome = await requestOrientationPermission(() => Promise.reject(new Error('no')));
    expect(outcome).toBe('denied');
  });

  it('resolves to denied (not a throw) when the call throws synchronously', async () => {
    const outcome = await requestOrientationPermission(() => {
      throw new Error('boom');
    });
    expect(outcome).toBe('denied');
  });
});
