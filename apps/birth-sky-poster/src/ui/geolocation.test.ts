// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeolocationTimeoutError, requestCurrentPosition } from './geolocation';

type SuccessCallback = (position: GeolocationPosition) => void;
type ErrorCallback = (error: GeolocationPositionError) => void;

let getCurrentPosition: ReturnType<typeof vi.fn>;

function installGeolocation(): void {
  getCurrentPosition = vi.fn();
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  });
}

function removeGeolocation(): void {
  Reflect.deleteProperty(navigator, 'geolocation');
}

function positionError(code: number): GeolocationPositionError {
  return {
    code,
    message: '',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

beforeEach(() => {
  vi.useFakeTimers();
  installGeolocation();
});

afterEach(() => {
  vi.useRealTimers();
  removeGeolocation();
});

describe('requestCurrentPosition', () => {
  it('resolves with the reported coordinates', async () => {
    getCurrentPosition.mockImplementation((onSuccess: SuccessCallback) => {
      onSuccess({ coords: { latitude: 64.1466, longitude: -21.9426 } } as GeolocationPosition);
    });

    await expect(requestCurrentPosition()).resolves.toEqual({
      latitude: 64.1466,
      longitude: -21.9426,
    });
  });

  it('asks for a low-accuracy fix with a bounded acquisition timeout', async () => {
    getCurrentPosition.mockImplementation((onSuccess: SuccessCallback) => {
      onSuccess({ coords: { latitude: 0, longitude: 0 } } as GeolocationPosition);
    });

    await requestCurrentPosition();

    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: false, timeout: 10_000 }),
    );
  });

  it.each([
    [1, /許可されませんでした/],
    [2, /特定できませんでした/],
    [3, /タイムアウト/],
    [99, /取得できませんでした/],
  ])('maps error code %i to a specific message', async (code, pattern) => {
    getCurrentPosition.mockImplementation((_ok: SuccessCallback, onError: ErrorCallback) => {
      onError(positionError(code));
    });

    await expect(requestCurrentPosition()).rejects.toThrow(pattern);
  });

  it('always points the user at manual entry when it fails', async () => {
    getCurrentPosition.mockImplementation((_ok: SuccessCallback, onError: ErrorCallback) => {
      onError(positionError(1));
    });

    await expect(requestCurrentPosition()).rejects.toThrow(/手入力/);
  });

  it('reports an unsupported browser without calling the API', async () => {
    removeGeolocation();

    await expect(requestCurrentPosition()).rejects.toThrow(/対応していません/);
  });

  // Time spent waiting for the permission prompt is excluded from
  // PositionOptions.timeout by spec, so an ignored prompt leaves the request
  // pending forever and the button disabled for the rest of the session.
  it('gives up on its own when neither callback ever fires', async () => {
    getCurrentPosition.mockImplementation(() => {
      /* never settles, as when a permission prompt is left unanswered */
    });

    const pending = requestCurrentPosition();
    const assertion = expect(pending).rejects.toThrow(GeolocationTimeoutError);
    await vi.advanceTimersByTimeAsync(20_000);

    await assertion;
  });

  it('tells the user how to recover from that stall', async () => {
    getCurrentPosition.mockImplementation(() => {});

    const pending = requestCurrentPosition();
    const assertion = expect(pending).rejects.toThrow(/手入力/);
    await vi.advanceTimersByTimeAsync(20_000);

    await assertion;
  });

  it('does not fire the deadline once the request has settled', async () => {
    getCurrentPosition.mockImplementation((onSuccess: SuccessCallback) => {
      onSuccess({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition);
    });

    await expect(requestCurrentPosition()).resolves.toBeDefined();

    // Nothing should reject after the fact; an unhandled rejection here would
    // surface as a test-run failure.
    await vi.advanceTimersByTimeAsync(60_000);
  });

  it('ignores a late callback that arrives after the deadline', async () => {
    let late: SuccessCallback = () => {};
    getCurrentPosition.mockImplementation((onSuccess: SuccessCallback) => {
      late = onSuccess;
    });

    const pending = requestCurrentPosition();
    const assertion = expect(pending).rejects.toThrow(GeolocationTimeoutError);
    await vi.advanceTimersByTimeAsync(20_000);
    late({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition);

    await assertion;
  });
});
