import { describe, expect, it } from 'vitest';
import {
  createSensorWatchState,
  isValidOrientationReading,
  markValidReadingReceived,
  SENSOR_FALLBACK_TIMEOUT_MS,
  shouldFallBackToDrag,
} from './sensorFallback';

describe('createSensorWatchState', () => {
  it('starts with no reading received', () => {
    expect(createSensorWatchState(1000)).toEqual({ startedAtMs: 1000, receivedValidReading: false });
  });
});

describe('markValidReadingReceived', () => {
  it('flips receivedValidReading to true without mutating the input', () => {
    const original = createSensorWatchState(0);
    const next = markValidReadingReceived(original);
    expect(next.receivedValidReading).toBe(true);
    expect(original.receivedValidReading).toBe(false);
  });
});

describe('isValidOrientationReading', () => {
  it('is valid when beta is a finite number, even if gamma is null', () => {
    expect(isValidOrientationReading(12, null)).toBe(true);
  });

  it('is valid when gamma is a finite number, even if beta is null', () => {
    expect(isValidOrientationReading(null, -8)).toBe(true);
  });

  it('is invalid when both are null', () => {
    expect(isValidOrientationReading(null, null)).toBe(false);
  });

  it('is invalid when both are undefined', () => {
    expect(isValidOrientationReading(undefined, undefined)).toBe(false);
  });

  it('is invalid when both are NaN', () => {
    expect(isValidOrientationReading(NaN, NaN)).toBe(false);
  });

  it('is valid when at least one value is 0 (falsy but a real reading)', () => {
    expect(isValidOrientationReading(0, null)).toBe(true);
    expect(isValidOrientationReading(null, 0)).toBe(true);
  });
});

describe('shouldFallBackToDrag', () => {
  it('is false before the timeout elapses', () => {
    const state = createSensorWatchState(0);
    expect(shouldFallBackToDrag(state, SENSOR_FALLBACK_TIMEOUT_MS - 1)).toBe(false);
  });

  it('is true once the timeout has elapsed with no valid reading', () => {
    const state = createSensorWatchState(0);
    expect(shouldFallBackToDrag(state, SENSOR_FALLBACK_TIMEOUT_MS)).toBe(true);
  });

  it('is true well past the timeout with no valid reading', () => {
    const state = createSensorWatchState(1000);
    expect(shouldFallBackToDrag(state, 1000 + SENSOR_FALLBACK_TIMEOUT_MS + 5000)).toBe(true);
  });

  it('is false once a valid reading has been received, even after the timeout', () => {
    const state = markValidReadingReceived(createSensorWatchState(0));
    expect(shouldFallBackToDrag(state, SENSOR_FALLBACK_TIMEOUT_MS + 10000)).toBe(false);
  });

  it('respects a custom timeout', () => {
    const state = createSensorWatchState(0);
    expect(shouldFallBackToDrag(state, 500, 1000)).toBe(false);
    expect(shouldFallBackToDrag(state, 1000, 1000)).toBe(true);
  });
});
