// 振り子1本のパラメータ。統一ベクトルモデル: 角度 angleDeg を持つ寄与ベクトルが
// X/Y に cos/sin 射影され、amplitude * cos|sin(angle) * sin(frequency*t + phase) * exp(-decay*t)
// として合成される。X軸振り子/Y軸振り子という区別はしない。
export interface Pendulum {
  id: string;
  frequency: number; // 角振動数 (rad / t-unit), 0.1 - 12
  decay: number; // 減衰率, 0 - 1.2
  phaseDeg: number; // 位相 (度), 0 - 360
  amplitude: number; // 振幅 (相対単位), 1 - 100
  angleDeg: number; // 寄与ベクトルの角度 (度), 0 - 360
}

export interface TrajectoryPoint {
  x: number;
  y: number;
  speed: number; // ローカル速度 (未正規化)
}

export type PaperType = 'kinari' | 'charcoal' | 'graph';

export interface AppState {
  pendulums: Pendulum[];
  periods: number; // 描画する周期数 (継続時間の代理指標)
  traceSeconds: number; // トレース・アニメーションの実時間 (秒/パス)
  animate: boolean; // true: トレース・アニメーション, false: 即時全描画
  paper: PaperType;
  inkColor: string;
  twoPass: boolean;
  inkColor2: string;
  rdpTolerance: number; // SVG簡略化の許容誤差 (mm)
}

export interface PresetDefinition {
  id: string;
  name: string;
  description: string;
  pendulums: Omit<Pendulum, 'id'>[];
  periods: number;
}
