import { nextLayerId, type BlendMode, type Layer, type PatternType, type StudioState } from './types';

export interface Preset {
  id: string;
  name: string;
  description: string;
  build: () => StudioState;
}

function layer(
  type: PatternType,
  rotation: number,
  spacing: number,
  thickness: number,
  opacity: number,
  color: string,
  blendMode: BlendMode = 'source-over',
  blendOverride = false,
  kinetic = false
): Layer {
  return { id: nextLayerId(), type, rotation, spacing, thickness, opacity, color, blendOverride, blendMode, kinetic };
}

export const PRESETS: Preset[] = [
  {
    id: 'riley-stripes',
    name: 'RILEY STRIPES',
    description: '平行線 × 平行線の微小回転差',
    build: () => ({
      layers: [
        layer('lines', 0, 10, 4, 1, '#111111'),
        layer('lines', 4, 10, 4, 1, '#111111', 'source-over', false, true),
      ],
      globalBlendMode: 'difference',
      kineticPlaying: false,
      kineticSpeed: 8,
    }),
  },
  {
    id: 'fine-grid',
    name: 'FINE GRID',
    description: 'ドット × ドットの密グリッド',
    build: () => ({
      layers: [
        layer('dots', 0, 14, 3, 1, '#111111'),
        layer('dots', 15, 14, 3, 1, '#111111', 'source-over', false, true),
      ],
      globalBlendMode: 'multiply',
      kineticPlaying: false,
      kineticSpeed: 10,
    }),
  },
  {
    id: 'concentric-waves',
    name: 'CONCENTRIC WAVES',
    description: '同心円 × 同心円のオフセット干渉',
    build: () => ({
      layers: [
        layer('circles', 0, 18, 3, 1, '#111111'),
        layer('circles', 35, 18, 3, 1, '#111111', 'source-over', false, true),
      ],
      globalBlendMode: 'multiply',
      kineticPlaying: false,
      kineticSpeed: 14,
    }),
  },
  {
    id: 'diagonal-interference',
    name: 'DIAGONAL INTERFERENCE',
    description: '線 × ドットの異種レイヤー干渉、赤アクセント',
    build: () => ({
      layers: [
        layer('lines', 20, 9, 3, 1, '#111111'),
        layer('dots', 0, 16, 3, 0.9, '#E10600', 'source-over', false, true),
      ],
      globalBlendMode: 'exclusion',
      kineticPlaying: false,
      kineticSpeed: 12,
    }),
  },
  {
    id: 'triple-weave',
    name: 'TRIPLE WEAVE',
    description: '線・ドット・同心円の三層構成',
    build: () => ({
      layers: [
        layer('lines', 0, 12, 2.5, 0.85, '#111111'),
        layer('dots', 30, 20, 2.5, 0.85, '#111111', 'source-over', false, true),
        layer('circles', 10, 22, 2.5, 0.85, '#111111', 'source-over', false, true),
      ],
      globalBlendMode: 'difference',
      kineticPlaying: false,
      kineticSpeed: 9,
    }),
  },
];
