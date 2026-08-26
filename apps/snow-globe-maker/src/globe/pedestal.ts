export type PedestalMaterial = 'gold' | 'silver' | 'rosewood';

export interface PedestalDef {
  label: string;
  stops: [number, string][];
  plaqueBg: string;
  plaqueText: string;
}

export const PEDESTAL_MATERIALS: Record<PedestalMaterial, PedestalDef> = {
  gold: {
    label: 'ゴールド',
    stops: [
      [0, '#f1ddab'],
      [0.45, '#ad8a54'],
      [1, '#6f4e22'],
    ],
    plaqueBg: '#2c2113',
    plaqueText: '#e9cb84',
  },
  silver: {
    label: 'シルバー',
    stops: [
      [0, '#f2f3f5'],
      [0.45, '#b7bbc0'],
      [1, '#71757b'],
    ],
    plaqueBg: '#222426',
    plaqueText: '#e7e9eb',
  },
  rosewood: {
    label: 'ローズウッド',
    stops: [
      [0, '#a9614e'],
      [0.45, '#6e2f24'],
      [1, '#2c110c'],
    ],
    plaqueBg: '#1c0d09',
    plaqueText: '#e9c9a8',
  },
};
