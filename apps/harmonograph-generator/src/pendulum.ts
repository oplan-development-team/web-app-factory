import type { Pendulum, TrajectoryPoint } from './types';

const SAMPLES_PER_PERIOD = 140;
const MIN_SAMPLES = 240;
const MAX_SAMPLES = 6000;

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * 全振り子の寄与を合成し、ペン先の軌跡 (x(t), y(t)) をサンプリングする。
 * 各振り子 i の寄与は amplitude_i * exp(-decay_i * t) * sin(frequency_i * t + phase_i) という
 * スカラー量であり、それが角度 angle_i を持つ単位ベクトルに乗って X/Y へ射影される
 * (X軸振り子/Y軸振り子という分離はしない統一モデル)。
 *
 * 実機の振り子運動を単純化した減衰正弦波合成モデルであり、支点摩擦・空気抵抗等を
 * 含む厳密な物理演算 (ラグランジュ方程式ベース) ではない。
 */
export function simulateTrajectory(
  pendulums: Pendulum[],
  periods: number,
): TrajectoryPoint[] {
  const totalT = periods * Math.PI * 2;
  const samples = Math.min(
    MAX_SAMPLES,
    Math.max(MIN_SAMPLES, Math.round(periods * SAMPLES_PER_PERIOD)),
  );
  const dt = totalT / samples;

  const rawX = new Float64Array(samples + 1);
  const rawY = new Float64Array(samples + 1);

  const cosAngles = pendulums.map((p) => Math.cos(deg2rad(p.angleDeg)));
  const sinAngles = pendulums.map((p) => Math.sin(deg2rad(p.angleDeg)));
  const phaseRads = pendulums.map((p) => deg2rad(p.phaseDeg));

  for (let i = 0; i <= samples; i++) {
    const t = i * dt;
    let x = 0;
    let y = 0;
    for (let j = 0; j < pendulums.length; j++) {
      const p = pendulums[j];
      if (!p) continue;
      const contribution =
        p.amplitude * Math.exp(-p.decay * t) * Math.sin(p.frequency * t + (phaseRads[j] ?? 0));
      x += contribution * (cosAngles[j] ?? 0);
      y += contribution * (sinAngles[j] ?? 0);
    }
    rawX[i] = x;
    rawY[i] = y;
  }

  // ローカル速度を中心差分で近似する (インクだまり表現の元データ)。
  const points: TrajectoryPoint[] = new Array(samples + 1);
  for (let i = 0; i <= samples; i++) {
    let vx: number;
    let vy: number;
    if (i === 0) {
      vx = ((rawX[1] ?? 0) - (rawX[0] ?? 0)) / dt;
      vy = ((rawY[1] ?? 0) - (rawY[0] ?? 0)) / dt;
    } else if (i === samples) {
      vx = ((rawX[samples] ?? 0) - (rawX[samples - 1] ?? 0)) / dt;
      vy = ((rawY[samples] ?? 0) - (rawY[samples - 1] ?? 0)) / dt;
    } else {
      vx = ((rawX[i + 1] ?? 0) - (rawX[i - 1] ?? 0)) / (2 * dt);
      vy = ((rawY[i + 1] ?? 0) - (rawY[i - 1] ?? 0)) / (2 * dt);
    }
    points[i] = { x: rawX[i] ?? 0, y: rawY[i] ?? 0, speed: Math.hypot(vx, vy) };
  }

  return points;
}

/**
 * 2パスモード用に、振り子構成を「わずかにずらした」版を生成する。
 * 実機の2色ペン切替 (1回目と2回目でわずかに機構が狂う) を模す決定論的な detune。
 */
export function detuneForSecondPass(pendulums: Pendulum[]): Pendulum[] {
  return pendulums.map((p) => ({
    ...p,
    id: `${p.id}-pass2`,
    frequency: p.frequency * 1.006,
    phaseDeg: p.phaseDeg + 4.5,
    decay: p.decay * 1.03,
    angleDeg: p.angleDeg + 2,
  }));
}

export interface ScaledGeometry {
  points: TrajectoryPoint[];
  /** 正規化された 0-1 の速度 (パーセンタイルでクランプ済み) */
  normSpeeds: Float64Array;
}

/**
 * 軌跡を紙面サイズに合わせて中央寄せ・自動スケーリングし、速度を正規化する。
 * paperSizeMm x marginRatio の内接矩形に収まるようにする。
 */
export function fitTrajectoryToPaper(
  points: TrajectoryPoint[],
  paperSizeMm: number,
  marginRatio = 0.86,
): ScaledGeometry {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const width = Math.max(maxX - minX, 1e-6);
  const height = Math.max(maxY - minY, 1e-6);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const targetSize = paperSizeMm * marginRatio;
  const scale = targetSize / Math.max(width, height);

  const scaled: TrajectoryPoint[] = points.map((p) => ({
    x: (p.x - cx) * scale + paperSizeMm / 2,
    y: (p.y - cy) * scale + paperSizeMm / 2,
    speed: p.speed,
  }));

  // パーセンタイルクランプで外れ値 (t=0 付近の急峻な立ち上がり等) を抑えてから正規化する。
  const speeds = points.map((p) => p.speed).sort((a, b) => a - b);
  const pct = (q: number): number => {
    const idx = Math.min(speeds.length - 1, Math.max(0, Math.floor(q * (speeds.length - 1))));
    return speeds[idx] ?? 0;
  };
  const lo = pct(0.04);
  const hi = Math.max(pct(0.92), lo + 1e-6);

  const normSpeeds = new Float64Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const s = points[i]?.speed ?? 0;
    const clamped = Math.min(hi, Math.max(lo, s));
    normSpeeds[i] = (clamped - lo) / (hi - lo);
  }

  return { points: scaled, normSpeeds };
}
