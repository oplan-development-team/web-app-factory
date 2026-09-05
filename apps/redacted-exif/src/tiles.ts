/** Slippy-map (XYZ) tile math for a single-tile, non-interactive preview. */

const TILE_SIZE = 256;
const ZOOM = 15;

export interface TilePlacement {
  url: string;
  /** Marker position in px, relative to the tile image's top-left corner. */
  markerX: number;
  markerY: number;
  z: number;
  x: number;
  y: number;
}

export function locateTile(lat: number, lon: number): TilePlacement {
  const z = ZOOM;
  const n = Math.pow(2, z);
  const pixelX = ((lon + 180) / 360) * n * TILE_SIZE;
  const latRad = (lat * Math.PI) / 180;
  const pixelY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * TILE_SIZE;

  const x = Math.floor(pixelX / TILE_SIZE);
  const y = Math.floor(pixelY / TILE_SIZE);
  const markerX = pixelX - x * TILE_SIZE;
  const markerY = pixelY - y * TILE_SIZE;

  return {
    url: `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    markerX,
    markerY,
    z,
    x,
    y,
  };
}
