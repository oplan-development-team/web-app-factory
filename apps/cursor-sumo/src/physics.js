// 円剛体の物理演算（自前実装）。外部ライブラリ不使用。
// 加速度入力 -> 速度蓄積 -> 摩擦減衰、円同士の弾性衝突（等質量・法線速度交換）を担う。

export function vecLen(x, y) {
  return Math.hypot(x, y);
}

export function normalize(x, y) {
  const len = Math.hypot(x, y);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * 力士（円形の可動オブジェクト）。
 */
export class Rikishi {
  constructor({ id, label, side, color, x, y, radius }) {
    this.id = id;
    this.label = label; // "東" | "西"
    this.side = side; // "shu" | "ai"
    this.color = color;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.facing = { x: side === "shu" ? 1 : -1, y: 0 };
    this.lastMoveDir = { x: side === "shu" ? 1 : -1, y: 0 };
    this.dashCooldown = 0; // ms 残り。0ならダッシュ可能
    this.dashCooldownMax = 2000;
    this.dashFlashTimer = 0; // ダッシュ発動直後の見た目演出用
    this.eliminated = false;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.dashCooldown = 0;
    this.dashFlashTimer = 0;
    this.eliminated = false;
  }
}

const ACCEL = 2400; // px/s^2
const MAX_SPEED = 520; // px/s
const FRICTION_COEF = 0.985; // 1フレーム(≒1/60s)あたりの速度保持率
const DASH_IMPULSE = 760; // px/s の速度バースト
const BOUNCE_BOOST = 1.06; // 衝突時のインパルス増幅（打撃感）

/**
 * 入力方向ベクトル（正規化前）から力士に加速度を適用する。
 */
export function applyMovement(rikishi, inputX, inputY, dt) {
  const { x: nx, y: ny } = normalize(inputX, inputY);

  if (nx !== 0 || ny !== 0) {
    rikishi.vx += nx * ACCEL * dt;
    rikishi.vy += ny * ACCEL * dt;
    rikishi.lastMoveDir = { x: nx, y: ny };
    rikishi.facing = { x: nx, y: ny };
  }

  // 摩擦（フレームレート非依存の指数減衰）
  const frictionFactor = Math.pow(FRICTION_COEF, dt * 60);
  rikishi.vx *= frictionFactor;
  rikishi.vy *= frictionFactor;

  // 最高速度制限
  const speed = vecLen(rikishi.vx, rikishi.vy);
  if (speed > MAX_SPEED) {
    const s = MAX_SPEED / speed;
    rikishi.vx *= s;
    rikishi.vy *= s;
  }

  // 極小速度は0に丸める（永久にじわじわ動き続けるのを防ぐ）
  if (vecLen(rikishi.vx, rikishi.vy) < 0.5) {
    rikishi.vx = 0;
    rikishi.vy = 0;
  }

  rikishi.x += rikishi.vx * dt;
  rikishi.y += rikishi.vy * dt;

  if (rikishi.dashCooldown > 0) {
    rikishi.dashCooldown = Math.max(0, rikishi.dashCooldown - dt * 1000);
  }
  if (rikishi.dashFlashTimer > 0) {
    rikishi.dashFlashTimer = Math.max(0, rikishi.dashFlashTimer - dt * 1000);
  }
}

/**
 * 突っ張りダッシュを試みる。クールダウン中なら false。
 * dirX/dirY は現在の入力方向（無ければ直近の移動方向が使われる）。
 */
export function tryDash(rikishi, dirX, dirY) {
  if (rikishi.dashCooldown > 0) return false;

  let { x: nx, y: ny } = normalize(dirX, dirY);
  if (nx === 0 && ny === 0) {
    nx = rikishi.lastMoveDir.x;
    ny = rikishi.lastMoveDir.y;
  }
  if (nx === 0 && ny === 0) {
    nx = rikishi.facing.x;
    ny = rikishi.facing.y;
  }

  rikishi.vx += nx * DASH_IMPULSE;
  rikishi.vy += ny * DASH_IMPULSE;
  rikishi.facing = { x: nx, y: ny };
  rikishi.dashCooldown = rikishi.dashCooldownMax;
  rikishi.dashFlashTimer = 180;
  return true;
}

/**
 * 2つの円の弾性衝突を解決する（等質量、法線方向の速度交換 + 反発インパルス + めり込み分離）。
 * 衝突が発生した場合、衝突の強さ（打撃音の音量に利用）を返す。0なら衝突なし。
 */
export function resolveCollision(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = vecLen(dx, dy);
  const minDist = a.radius + b.radius;

  if (dist >= minDist || dist < 1e-6) return 0;

  const nx = dx / dist;
  const ny = dy / dist;

  // めり込み分離（等分）
  const overlap = minDist - dist;
  a.x -= (nx * overlap) / 2;
  a.y -= (ny * overlap) / 2;
  b.x += (nx * overlap) / 2;
  b.y += (ny * overlap) / 2;

  // 相対速度（法線方向）
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const relNormalSpeed = rvx * nx + rvy * ny;

  // すでに離れつつあるなら速度はいじらない（めり込み解消のみ）
  if (relNormalSpeed > 0) return 0;

  const aN = a.vx * nx + a.vy * ny;
  const bN = b.vx * nx + b.vy * ny;

  // 等質量弾性衝突: 法線成分を交換
  const newAN = bN * BOUNCE_BOOST;
  const newBN = aN * BOUNCE_BOOST;

  a.vx += (newAN - aN) * nx;
  a.vy += (newAN - aN) * ny;
  b.vx += (newBN - bN) * nx;
  b.vy += (newBN - bN) * ny;

  return Math.abs(relNormalSpeed);
}

export const PHYSICS_CONST = {
  ACCEL,
  MAX_SPEED,
  DASH_IMPULSE,
};
