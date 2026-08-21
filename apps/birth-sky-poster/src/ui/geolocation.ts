export interface GeoResult {
  latitude: number;
  longitude: number;
}

/** Wraps navigator.geolocation with Japanese-language error messages. */
export function requestCurrentPosition(): Promise<GeoResult> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('このブラウザは位置情報の取得に対応していません。'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('位置情報の利用が許可されませんでした。緯度・経度を手入力してください。'));
        } else {
          reject(new Error('現在地を取得できませんでした。緯度・経度を手入力してください。'));
        }
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
