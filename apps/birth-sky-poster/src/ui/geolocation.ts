export interface GeoResult {
  latitude: number;
  longitude: number;
}

/** Passed to the browser as the acquisition timeout. */
const ACQUISITION_TIMEOUT_MS = 10_000;

/**
 * Our own deadline, applied on top of the browser's.
 *
 * The Geolocation spec excludes time spent waiting for the user to answer the
 * permission prompt from `PositionOptions.timeout`, so a prompt the user
 * ignores leaves the request pending forever and neither callback ever fires.
 * Without this the "use my location" button stays disabled for the rest of the
 * session with no way back. Firefox reproduces it readily.
 */
const OVERALL_DEADLINE_MS = 20_000;

export class GeolocationTimeoutError extends Error {
  constructor() {
    super('現在地の取得に時間がかかっています。ブラウザの許可を確認するか、緯度・経度を手入力してください。');
    this.name = 'GeolocationTimeoutError';
  }
}

/** Wraps navigator.geolocation with Japanese messages and a hard deadline. */
export function requestCurrentPosition(): Promise<GeoResult> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('このブラウザは位置情報の取得に対応していません。緯度・経度を手入力してください。'));
      return;
    }

    let settled = false;
    const deadline = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new GeolocationTimeoutError());
    }, OVERALL_DEADLINE_MS);

    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      run();
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        finish(() =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        );
      },
      (error) => {
        finish(() => reject(new Error(describe(error))));
      },
      {
        enableHighAccuracy: false,
        timeout: ACQUISITION_TIMEOUT_MS,
        maximumAge: 60_000,
      },
    );
  });
}

function describe(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return '位置情報の利用が許可されませんでした。緯度・経度を手入力してください。';
    case error.POSITION_UNAVAILABLE:
      return '現在地を特定できませんでした。緯度・経度を手入力してください。';
    case error.TIMEOUT:
      return '現在地の取得がタイムアウトしました。緯度・経度を手入力してください。';
    default:
      return '現在地を取得できませんでした。緯度・経度を手入力してください。';
  }
}
