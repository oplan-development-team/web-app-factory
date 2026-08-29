import type { Pendulum, PresetDefinition } from './types';

export const PRESETS: PresetDefinition[] = [
  {
    id: 'lateral-ellipse',
    name: '楕円ラテラル型',
    description: '2振り子が直交軸上で振れる、最も古典的な横振り子式。安定した楕円ローズを描く。',
    periods: 14,
    pendulums: [
      { frequency: 2.01, decay: 0.06, phaseDeg: 0, amplitude: 80, angleDeg: 0 },
      { frequency: 3.0, decay: 0.05, phaseDeg: 90, amplitude: 80, angleDeg: 90 },
    ],
  },
  {
    id: 'rotary',
    name: 'ロータリー型',
    description: '単一の回転振り子(円運動)を模した構成。渦を巻きながら閉じていく軌道。',
    periods: 16,
    pendulums: [
      { frequency: 3, decay: 0.09, phaseDeg: 0, amplitude: 75, angleDeg: 0 },
      { frequency: 3, decay: 0.09, phaseDeg: 90, amplitude: 75, angleDeg: 90 },
    ],
  },
  {
    id: 'spirograph-triad',
    name: 'スパイログラフ・トライアド',
    description: '3振り子を周波数比 2:3:5 で組み合わせ、花弁状のスパイログラフ風軌道を生む。',
    periods: 20,
    pendulums: [
      { frequency: 2, decay: 0.03, phaseDeg: 0, amplitude: 60, angleDeg: 0 },
      { frequency: 3, decay: 0.035, phaseDeg: 45, amplitude: 55, angleDeg: 90 },
      { frequency: 5, decay: 0.04, phaseDeg: 120, amplitude: 40, angleDeg: 30 },
    ],
  },
  {
    id: 'asymmetric-drift',
    name: '非対称ドリフト型',
    description: '減衰率に差をつけ、序盤の暴れと終盤の静かな収束とのコントラストを強調する。',
    periods: 18,
    pendulums: [
      { frequency: 2.5, decay: 0.02, phaseDeg: 10, amplitude: 70, angleDeg: 15 },
      { frequency: 4.2, decay: 0.18, phaseDeg: 200, amplitude: 65, angleDeg: 100 },
      { frequency: 1.3, decay: 0.05, phaseDeg: 300, amplitude: 45, angleDeg: 250 },
    ],
  },
  {
    id: 'clover-resonance',
    name: 'クローバー共鳴型',
    description: '4振り子を単純整数比で共鳴させ、対称性の高いクローバー状のロゼットを描く。',
    periods: 16,
    pendulums: [
      { frequency: 2, decay: 0.045, phaseDeg: 0, amplitude: 55, angleDeg: 0 },
      { frequency: 4, decay: 0.05, phaseDeg: 90, amplitude: 45, angleDeg: 90 },
      { frequency: 2, decay: 0.055, phaseDeg: 180, amplitude: 35, angleDeg: 45 },
      { frequency: 4, decay: 0.06, phaseDeg: 270, amplitude: 30, angleDeg: 135 },
    ],
  },
  {
    id: 'chaos-fireworks',
    name: '混沌の花火',
    description: '5振り子が異なる速度で減衰し、密度の高い花火のような軌跡を残す高複雑度パターン。',
    periods: 22,
    pendulums: [
      { frequency: 3.1, decay: 0.07, phaseDeg: 0, amplitude: 50, angleDeg: 0 },
      { frequency: 5.3, decay: 0.12, phaseDeg: 60, amplitude: 40, angleDeg: 72 },
      { frequency: 7.7, decay: 0.2, phaseDeg: 140, amplitude: 30, angleDeg: 144 },
      { frequency: 2.2, decay: 0.05, phaseDeg: 220, amplitude: 45, angleDeg: 216 },
      { frequency: 9.1, decay: 0.28, phaseDeg: 300, amplitude: 22, angleDeg: 288 },
    ],
  },
];

let idCounter = 0;
export function nextPendulumId(): string {
  idCounter += 1;
  return `p${Date.now().toString(36)}${idCounter}`;
}

export function instantiatePreset(preset: PresetDefinition): { pendulums: Pendulum[]; periods: number } {
  return {
    periods: preset.periods,
    pendulums: preset.pendulums.map((p) => ({ ...p, id: nextPendulumId() })),
  };
}

// 単純な整数比になりやすい周波数候補 (破綻の少ない見た目に緩くバイアスする)。
const NICE_RATIOS = [1, 1.5, 2, 2 / 3, 3, 4 / 3, 0.5, 5 / 3, 5 / 4];
const NICE_ANGLES = [0, 30, 45, 60, 90, 120, 135, 150, 180];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  const item = arr[Math.floor(Math.random() * arr.length)];
  return item as T;
}

/**
 * 完全一様乱数ではなく、収束/発散のバランスや周波数の単純整数比への
 * 寄りやすさに緩くバイアスをかけたランダム生成。「破綻の少ない見た目」を狙う。
 */
export function generateRandomConfig(): { pendulums: Pendulum[]; periods: number } {
  const countWeights = [2, 3, 3, 3, 4, 4, 5];
  const count = pick(countWeights);

  const baseFrequency = rand(1.5, 4.5);
  const pendulums: Pendulum[] = [];

  for (let i = 0; i < count; i++) {
    const useNiceRatio = Math.random() < 0.7;
    const ratio = useNiceRatio ? pick(NICE_RATIOS) : rand(0.4, 3.2);
    const jitter = useNiceRatio ? rand(-0.02, 0.02) : 0;
    const frequency = Math.max(0.2, baseFrequency * ratio + jitter);

    // 2つの一様乱数の平均で極端な値を減らす (中心寄りにバイアス)。
    const decay = (rand(0.01, 0.35) + rand(0.01, 0.35)) / 2;

    const amplitude = rand(28, 95);
    const phaseDeg = rand(0, 360);
    const angleDeg = Math.random() < 0.5 ? pick(NICE_ANGLES) + rand(-4, 4) : rand(0, 360);

    pendulums.push({
      id: nextPendulumId(),
      frequency: Number(frequency.toFixed(3)),
      decay: Number(decay.toFixed(4)),
      phaseDeg: Number(phaseDeg.toFixed(1)),
      amplitude: Number(amplitude.toFixed(1)),
      angleDeg: Number(((angleDeg % 360) + 360 % 360).toFixed(1)),
    });
  }

  const periods = Math.round(rand(12, 26));

  return { pendulums, periods };
}
