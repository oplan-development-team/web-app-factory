export interface GeoResult {
  lat: number;
  lon: number;
}

/**
 * アプリ側の締め切り（FR-404.2）。
 *
 * `PositionOptions.timeout` は**許可プロンプトへの応答待ちを含まない**（仕様どおり）。
 * ユーザーがプロンプトを放置すると成功・失敗どちらのコールバックも呼ばれず、
 * ボタンが無効のまま戻らなくなる。自前の締め切りを別に持つ。
 */
export const RESPONSE_DEADLINE_MS = 12_000;
const POSITION_TIMEOUT_MS = 8_000;

export interface GeolocationLike {
  getCurrentPosition(
    success: (position: GeolocationPosition) => void,
    error: (err: GeolocationPositionError) => void,
    options?: PositionOptions,
  ): void;
}

export function getCurrentPosition(
  geolocation: GeolocationLike | undefined = navigator.geolocation,
  deadlineMs: number = RESPONSE_DEADLINE_MS,
): Promise<GeoResult> {
  if (!geolocation) {
    return Promise.reject(new Error('このブラウザは位置情報の取得に対応していません'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('位置情報の応答がありませんでした。ブラウザの許可を確認してください'));
    }, deadlineMs);

    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };

    geolocation.getCurrentPosition(
      (position) => finish(() => resolve({ lat: position.coords.latitude, lon: position.coords.longitude })),
      (err) => finish(() => reject(new Error(mapGeoError(err)))),
      { enableHighAccuracy: false, timeout: POSITION_TIMEOUT_MS, maximumAge: 60_000 },
    );
  });
}

export function mapGeoError(err: GeolocationPositionError): string {
  switch (err.code) {
    case 1:
      return '位置情報の利用が許可されませんでした';
    case 2:
      return '現在地を取得できませんでした';
    case 3:
      return '取得がタイムアウトしました';
    default:
      return '位置情報の取得に失敗しました';
  }
}
