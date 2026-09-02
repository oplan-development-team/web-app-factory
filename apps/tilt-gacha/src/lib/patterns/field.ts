import { randRange } from "../rng.ts";
import type { Rng } from "../types.ts";

/**
 * 極（pole）によるベクトル場（FR-111）。
 *
 * bookofshapes の "Flow Poles" のように、複数の中心が場を歪め合うことで
 * 単純な波・同心円が「絡み合った」見え方になる。
 * 層を重ねるだけでは要素が増えるだけで複雑さは増さないので、
 * 各層が同じ場を共有して歪むようにするのがこの仕組みの目的。
 *
 * 純関数のみ。乱数は引数で受け取る（NFR-008.3）。
 */

export interface Pole {
  x: number;
  y: number;
  /** 正で押し出し、負で引き寄せる（放射方向の変位） */
  push: number;
  /** 渦の強さ（接線方向の変位）。符号が回転方向 */
  swirl: number;
  /** 影響の広がり。大きいほどゆるやかに効く */
  radius: number;
}

export interface Vec {
  dx: number;
  dy: number;
}

/** 変位の上限。これを超えると模様が枠外へ流れ出し、型が読めなくなる。 */
const MAX_DISPLACEMENT = 26;

export function makePoles(
  rng: Rng,
  count: number,
  bounds: { min: number; max: number },
): Pole[] {
  const poles: Pole[] = [];
  const span = bounds.max - bounds.min;
  for (let i = 0; i < count; i += 1) {
    poles.push({
      x: bounds.min + randRange(rng, 0.15, 0.85) * span,
      y: bounds.min + randRange(rng, 0.15, 0.85) * span,
      push: randRange(rng, -14, 14),
      swirl: randRange(rng, -16, 16),
      radius: randRange(rng, 0.22, 0.5) * span,
    });
  }
  return poles;
}

/**
 * 点 (x, y) における変位。
 *
 * 減衰は `1 / (1 + (d/r)^2)` を使う。距離 0 で発散しないので、
 * 極の真上に置かれた点でも座標が NaN / Infinity にならない（AC-09 の不変条件）。
 */
export function fieldOffset(poles: readonly Pole[], x: number, y: number): Vec {
  let dx = 0;
  let dy = 0;

  for (const pole of poles) {
    const vx = x - pole.x;
    const vy = y - pole.y;
    const distance = Math.hypot(vx, vy);
    const weight = 1 / (1 + (distance / pole.radius) ** 2);

    if (distance < 1e-6) {
      // 極の中心では方向が定まらない。放射成分は 0 として渦だけを効かせる
      continue;
    }
    const ux = vx / distance;
    const uy = vy / distance;

    dx += pole.push * weight * ux;
    dy += pole.push * weight * uy;
    // 接線方向（法線を 90 度回したもの）が渦をつくる
    dx += pole.swirl * weight * -uy;
    dy += pole.swirl * weight * ux;
  }

  return clampVec(dx, dy);
}

/** 変位を一定の長さに収める。方向は保ったまま大きさだけ抑える。 */
function clampVec(dx: number, dy: number): Vec {
  const length = Math.hypot(dx, dy);
  if (length <= MAX_DISPLACEMENT || length === 0) return { dx, dy };
  const scale = MAX_DISPLACEMENT / length;
  return { dx: dx * scale, dy: dy * scale };
}
