/**
 * Generates a small tileable "washi" (Japanese paper) noise texture once,
 * then exposes it as a repeatable canvas pattern so redraws stay cheap.
 */

const TILE_SIZE = 240;
let cachedTile: HTMLCanvasElement | null = null;

function buildTile(): HTMLCanvasElement {
  const tile = document.createElement('canvas');
  tile.width = TILE_SIZE;
  tile.height = TILE_SIZE;
  const ctx = tile.getContext('2d');
  if (!ctx) return tile;

  // base paper tone
  ctx.fillStyle = '#f4ede0';
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // fine speckle grain, warm and cool flecks mixed sparsely like fibrous washi
  // (sized/opacity-boosted so the grain survives the ~2x downscale from the
  // canvas's internal working resolution to its on-screen CSS size)
  const speckleCount = 1600;
  for (let i = 0; i < speckleCount; i++) {
    const x = Math.random() * TILE_SIZE;
    const y = Math.random() * TILE_SIZE;
    const r = Math.random() * 1.1 + 0.35;
    const warm = Math.random() > 0.45;
    const alpha = Math.random() * 0.14 + 0.05;
    ctx.fillStyle = warm ? `rgba(130, 108, 84, ${alpha})` : `rgba(255, 250, 240, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // long soft fibers
  const fiberCount = 22;
  for (let i = 0; i < fiberCount; i++) {
    const x = Math.random() * TILE_SIZE;
    const y = Math.random() * TILE_SIZE;
    const len = Math.random() * 26 + 10;
    const angle = Math.random() * Math.PI;
    ctx.strokeStyle = `rgba(140, 120, 94, ${Math.random() * 0.08 + 0.03})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  return tile;
}

export function getWashiTile(): HTMLCanvasElement {
  if (!cachedTile) cachedTile = buildTile();
  return cachedTile;
}

export function paintWashiBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.fillStyle = '#f4ede0';
  ctx.fillRect(0, 0, width, height);

  const tile = getWashiTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }

  // very subtle vignette toward the mat edges for depth
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75,
  );
  vignette.addColorStop(0, 'rgba(43, 38, 30, 0)');
  vignette.addColorStop(1, 'rgba(43, 38, 30, 0.06)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
