import type { RatioPreset, RatioKey, Stone, SandParams } from './types';

export const RATIO_PRESETS: Record<RatioKey, RatioPreset> = {
  horizontal: {
    key: 'horizontal',
    label: '方丈 16:10',
    captionLabel: '方丈の比率　16 : 10',
    width: 1600,
    height: 1000,
  },
  square: {
    key: 'square',
    label: '正方形 1:1',
    captionLabel: '方形の比率　1 : 1',
    width: 1200,
    height: 1200,
  },
  vertical: {
    key: 'vertical',
    label: '縦長ポスター',
    captionLabel: '掛軸の比率　5 : 7',
    width: 1000,
    height: 1400,
  },
};

export const STONE_MAX_COUNT = 20;

/** radius bounds in logical px, relative to the horizontal (1600x1000) preset */
export const STONE_RADIUS_MIN = 26;
export const STONE_RADIUS_MAX = 74;
export const STONE_RADIUS_DEFAULT = 46;

export const DEFAULT_SAND_PARAMS: SandParams = {
  density: 24,
  influence: 150,
  angleDeg: 30,
  amplitude: 0,
  period: 220,
};

let seedCounter = 0;
function makeId(): string {
  seedCounter += 1;
  return `stone-${Date.now().toString(36)}-${seedCounter}`;
}

export function makeStone(x: number, y: number, radius = STONE_RADIUS_DEFAULT): Stone {
  return { id: makeId(), x, y, radius };
}

interface SampleGarden {
  name: string;
  description: string;
  /** stones positioned in normalized 0..1 fractions of the horizontal (16:10) canvas */
  stones: Array<{ fx: number; fy: number; radius: number }>;
}

export const SAMPLE_GARDENS: SampleGarden[] = [
  {
    name: '三尊の庭',
    description: '大・中・小、三石による非対称の組み',
    stones: [
      { fx: 0.28, fy: 0.42, radius: 70 },
      { fx: 0.4, fy: 0.62, radius: 42 },
      { fx: 0.62, fy: 0.3, radius: 30 },
    ],
  },
  {
    name: '五石の庭',
    description: '二・三に分かれた五石、余白を広くとった構成',
    stones: [
      { fx: 0.22, fy: 0.36, radius: 64 },
      { fx: 0.33, fy: 0.55, radius: 34 },
      { fx: 0.66, fy: 0.68, radius: 52 },
      { fx: 0.78, fy: 0.5, radius: 30 },
      { fx: 0.72, fy: 0.82, radius: 26 },
    ],
  },
  {
    name: '七石の庭',
    description: '三・二・二に分かれた七石、龍安寺の石組に着想',
    stones: [
      { fx: 0.16, fy: 0.3, radius: 58 },
      { fx: 0.26, fy: 0.46, radius: 36 },
      { fx: 0.14, fy: 0.58, radius: 28 },
      { fx: 0.48, fy: 0.72, radius: 44 },
      { fx: 0.58, fy: 0.58, radius: 26 },
      { fx: 0.82, fy: 0.32, radius: 50 },
      { fx: 0.88, fy: 0.5, radius: 28 },
    ],
  },
];

export function instantiateSampleGarden(
  sample: SampleGarden,
  canvasWidth: number,
  canvasHeight: number,
): Stone[] {
  // radii were authored against the 1600-wide horizontal preset; scale proportionally
  const scale = canvasWidth / RATIO_PRESETS.horizontal.width;
  return sample.stones.map((s) => makeStone(s.fx * canvasWidth, s.fy * canvasHeight, s.radius * scale));
}
