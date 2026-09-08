import type { Cut } from './geometry/types';
import { nextId } from './store';

export interface Preset {
  id: string;
  name: string;
  description: string;
  build: () => Cut[];
}

function triangle(edge: 'left' | 'right', u: number, width: number, depth: number): Cut {
  return { id: nextId('t'), kind: 'triangle', placement: 'edge', edge, u, width, depth };
}

function semicircleEdge(edge: 'left' | 'right' | 'arc', u: number, radius: number): Cut {
  return { id: nextId('s'), kind: 'semicircle', placement: 'edge', edge, u, radius };
}

function circleHole(x: number, y: number, radius: number): Cut {
  return { id: nextId('h'), kind: 'semicircle', placement: 'interior', x, y, radius };
}

function triangleHole(x: number, y: number, width: number, rotation = 0): Cut {
  return { id: nextId('th'), kind: 'triangle', placement: 'interior', x, y, width, depth: width, rotation };
}

function wave(edge: 'left' | 'right' | 'arc', uStart: number, uEnd: number, amplitude: number, count: number): Cut {
  return { id: nextId('w'), kind: 'wave', placement: 'edge', edge, uStart, uEnd, amplitude, count };
}

function notch(edge: 'left' | 'right' | 'arc', u: number, size: 'small' | 'medium' | 'large' = 'small'): Cut {
  return { id: nextId('n'), kind: 'notch', placement: 'edge', edge, u, size };
}

export const PRESETS: Preset[] = [
  {
    id: 'simple-star',
    name: '簡素な六花',
    description: '大きな三角の切り込みだけで組む、静かな六角星。',
    build: () => [
      triangle('left', 95, 30, 22),
      triangle('right', 95, 30, 22),
      semicircleEdge('arc', 68, 20),
    ],
  },
  {
    id: 'lace',
    name: 'レースの縁',
    description: '波のスカラップと細かな房飾りで縁取った、繊細な一枚。',
    build: () => [
      wave('left', 40, 220, 5, 6),
      wave('right', 40, 220, 5, 6),
      wave('arc', 18, 118, 6, 5),
      triangleHole(150, 38, 18),
    ],
  },
  {
    id: 'jewels',
    name: '宝石飾り',
    description: '円形の穴を宝石のように内側に散らした一枚。',
    build: () => [
      circleHole(118, 28, 10),
      circleHole(188, 52, 11),
      triangle('left', 55, 18, 14),
      triangle('right', 55, 18, 14),
      semicircleEdge('arc', 92, 20),
    ],
  },
  {
    id: 'traditional',
    name: '伝統の切り紙',
    description: '深い三角の切れ込みが放射状に伸びる、古典的な意匠。',
    build: () => [
      triangle('left', 65, 16, 30),
      triangle('right', 65, 16, 30),
      triangle('left', 175, 20, 18),
      triangle('right', 175, 20, 18),
      semicircleEdge('arc', 66, 24),
    ],
  },
  {
    id: 'fringe',
    name: 'スカラップ・フリンジ',
    description: '外周をスカラップで丸め、房状の細かい切れ込みを連ねる。',
    build: () => [
      wave('arc', 10, 126, 8, 8),
      notch('left', 35), notch('left', 65), notch('left', 95), notch('left', 125), notch('left', 155), notch('left', 185), notch('left', 215), notch('left', 245),
      notch('right', 35), notch('right', 65), notch('right', 95), notch('right', 125), notch('right', 155), notch('right', 185), notch('right', 215), notch('right', 245),
      circleHole(150, 34, 9),
    ],
  },
  {
    id: 'minimal',
    name: 'ミニマル',
    description: '小さな切れ込みを二つだけ添えた、控えめな仕上がり。',
    build: () => [
      triangle('left', 140, 18, 14),
      triangle('right', 140, 18, 14),
    ],
  },
];
