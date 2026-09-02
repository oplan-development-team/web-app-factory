import { TILT } from "./constants.ts";
import type { TiltBucket } from "./types.ts";

/** 角度を `[-180, 180)` に正規化する。 */
export function normalizeAngle(deg: number): number {
  return (((deg + 180) % 360) + 360) % 360 - 180;
}

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/**
 * DeviceOrientation の beta / gamma を 4 つの傾き区分に分類する（FR-012）。
 *
 * 判定は「上から順に最初に成立したもの」を返す。順序に意味があり、入れ替えてはならない:
 * 反転しているかどうかを先に確定させないと、さかさまに構えた端末が
 * gamma の大きさだけで「横向き」に化けてしまう。
 *
 * alpha（方位）は使わない。較正が要り屋内で不安定なうえ、
 * 4 区分の分離には beta / gamma だけで足りるため（SPEC 1.3）。
 *
 * @returns 分類できないとき（値が無い・非有限）は null。呼び出し側がランダム割り当てへ倒す。
 */
export function classifyTilt(beta: number | null, gamma: number | null): TiltBucket | null {
  if (beta === null || gamma === null) return null;
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return null;

  const b = normalizeAngle(beta);
  const g = clamp(gamma, -90, 90);

  // 1. 画面が伏せ気味 / 完全に反転している
  if (Math.abs(b) >= TILT.INVERTED_ABS_BETA) return "INVERTED";
  // 2. 水平を越えて奥へ倒れている
  if (b <= TILT.INVERTED_BETA) return "INVERTED";
  // 3. 左右に大きく倒れている
  if (Math.abs(g) >= TILT.LANDSCAPE_ABS_GAMMA) return "LANDSCAPE";
  // 4. まっすぐ立てて構えている
  if (b >= TILT.UPRIGHT_MIN_BETA && Math.abs(g) < TILT.UPRIGHT_MAX_ABS_GAMMA) return "UPRIGHT";
  // 5. 上のいずれでもない中間姿勢。卓上への平置きもここに落ちる（FR-012.2）
  return "DIAGONAL";
}
