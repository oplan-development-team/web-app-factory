import type { DesignAppearance } from './types';

export interface Preset {
  id: string;
  name: string;
  note: string;
  appearance: DesignAppearance;
}

/**
 * Curated starting points. `ネオン` is deliberately inverted — it looks great and
 * the safety panel will honestly flag it, which is exactly the behaviour the
 * tool should demonstrate.
 */
export const PRESETS: ReadonlyArray<Preset> = [
  {
    id: 'monochrome',
    name: 'モノクローム',
    note: '互換性最優先',
    appearance: {
      margin: 4,
      dotStyle: 'square',
      bodyPaint: { kind: 'solid', color: '#111111' },
      background: { kind: 'solid', color: '#ffffff' },
      eyeInherit: true,
      eyeFrameStyle: 'square',
      eyeFramePaint: { kind: 'solid', color: '#111111' },
      eyeBallStyle: 'square',
      eyeBallPaint: { kind: 'solid', color: '#111111' },
    },
  },
  {
    id: 'ink',
    name: 'インク',
    note: '名刺向け',
    appearance: {
      margin: 4,
      dotStyle: 'fluid',
      bodyPaint: { kind: 'solid', color: '#1a1a1a' },
      background: { kind: 'solid', color: '#fbfaf7' },
      eyeInherit: false,
      eyeFrameStyle: 'rounded',
      eyeFramePaint: { kind: 'solid', color: '#1a1a1a' },
      eyeBallStyle: 'rounded',
      eyeBallPaint: { kind: 'solid', color: '#b8402a' },
    },
  },
  {
    id: 'cobalt',
    name: 'コバルト',
    note: '企業資料向け',
    appearance: {
      margin: 4,
      dotStyle: 'fluid',
      bodyPaint: { kind: 'linear', from: '#1d2b4f', to: '#3a63c2', angle: 135 },
      background: { kind: 'solid', color: '#ffffff' },
      eyeInherit: false,
      eyeFrameStyle: 'leaf',
      eyeFramePaint: { kind: 'solid', color: '#1d2b4f' },
      eyeBallStyle: 'leaf',
      eyeBallPaint: { kind: 'solid', color: '#3a63c2' },
    },
  },
  {
    id: 'sunset',
    name: 'サンセット',
    note: '店舗 POP 向け',
    appearance: {
      margin: 4,
      dotStyle: 'dot',
      bodyPaint: { kind: 'linear', from: '#bf4a0c', to: '#c22160', angle: 135 },
      background: { kind: 'solid', color: '#fff8f2' },
      eyeInherit: false,
      eyeFrameStyle: 'circle',
      eyeFramePaint: { kind: 'solid', color: '#c22160' },
      eyeBallStyle: 'circle',
      eyeBallPaint: { kind: 'solid', color: '#bf4a0c' },
    },
  },
  {
    id: 'forest',
    name: 'フォレスト',
    note: 'カフェ・雑貨向け',
    appearance: {
      margin: 4,
      dotStyle: 'rounded',
      bodyPaint: { kind: 'radial', from: '#2f7d5c', to: '#123f2c' },
      background: { kind: 'solid', color: '#f4f8f2' },
      eyeInherit: false,
      eyeFrameStyle: 'rounded',
      eyeFramePaint: { kind: 'solid', color: '#123f2c' },
      eyeBallStyle: 'circle',
      eyeBallPaint: { kind: 'solid', color: '#2f7d5c' },
    },
  },
  {
    id: 'neon',
    name: 'ネオン',
    note: '反転・要注意',
    appearance: {
      margin: 4,
      dotStyle: 'dot',
      bodyPaint: { kind: 'linear', from: '#5ef2d0', to: '#7aa8ff', angle: 120 },
      background: { kind: 'solid', color: '#0e1116' },
      eyeInherit: false,
      eyeFrameStyle: 'circle',
      eyeFramePaint: { kind: 'solid', color: '#5ef2d0' },
      eyeBallStyle: 'circle',
      eyeBallPaint: { kind: 'solid', color: '#7aa8ff' },
    },
  },
];
