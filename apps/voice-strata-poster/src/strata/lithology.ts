import type { LithologyBin } from '../types';

/**
 * Pitch (F0) is discretized into named lithology bins rather than a continuous
 * gradient. Boundaries are tuned around the typical speaking-voice range
 * (roughly 70Hz–500Hz) so that six bins each get meaningful coverage.
 * Ordered low -> high pitch.
 */
export const LITHOLOGY_BINS: LithologyBin[] = [
  {
    id: 'basalt',
    name: '玄武岩',
    label: 'BASALT — low drone',
    minHz: -Infinity,
    maxHz: 95,
    color: '#3d4148',
    accent: '#22252a',
  },
  {
    id: 'slate',
    name: '粘板岩',
    label: 'SLATE — low voiced',
    minHz: 95,
    maxHz: 130,
    color: '#2e3654',
    accent: '#1b2036',
  },
  {
    id: 'shale',
    name: '頁岩',
    label: 'SHALE — mid-low',
    minHz: 130,
    maxHz: 175,
    color: '#6b7a8f',
    accent: '#4b5768',
  },
  {
    id: 'sandstone',
    name: '砂岩',
    label: 'SANDSTONE — mid',
    minHz: 175,
    maxHz: 230,
    color: '#b8863a',
    accent: '#8f6626',
  },
  {
    id: 'limestone',
    name: '石灰岩',
    label: 'LIMESTONE — mid-high',
    minHz: 230,
    maxHz: 300,
    color: '#e4d9b8',
    accent: '#c7b787',
  },
  {
    id: 'quartz',
    name: '石英脈',
    label: 'QUARTZ VEIN — high',
    minHz: 300,
    maxHz: Infinity,
    color: '#e8c9c0',
    accent: '#cf9f92',
  },
];

/** Color + boundary style for the silence / unconformity band. */
export const UNCONFORMITY_STYLE = {
  color: '#8a7a64',
  accent: '#5c4a34',
  name: '不整合層',
  label: 'UNCONFORMITY — silence / pause',
};

export function classifyPitch(f0: number): LithologyBin {
  for (const bin of LITHOLOGY_BINS) {
    if (f0 >= bin.minHz && f0 < bin.maxHz) return bin;
  }
  return LITHOLOGY_BINS[LITHOLOGY_BINS.length - 1];
}
