export interface GeoResult {
  lat: number;
  lon: number;
}

export function getCurrentPosition(): Promise<GeoResult> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('このブラウザは位置情報の取得に対応していません'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(new Error(mapGeoError(err))),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  });
}

function mapGeoError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return '位置情報の利用が許可されませんでした';
    case err.POSITION_UNAVAILABLE:
      return '現在地を取得できませんでした';
    case err.TIMEOUT:
      return '取得がタイムアウトしました';
    default:
      return '位置情報の取得に失敗しました';
  }
}

export function formatCoordinate(value: number): string {
  return value.toFixed(4);
}
