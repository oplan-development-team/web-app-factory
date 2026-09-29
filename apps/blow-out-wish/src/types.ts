export type Screen =
  | 'onboarding'
  | 'calibrating'
  | 'mic-error'
  | 'mode-select'
  | 'game'
  | 'wish'
  | 'timeup';

export type MicErrorKind = 'denied' | 'device' | 'unknown';

export type SoloCount = 1 | 3 | 5 | 8;

export interface SoloConfig {
  kind: 'solo';
  count: SoloCount;
}

export interface ChallengeConfig {
  kind: 'challenge';
}

export type ModeConfig = SoloConfig | ChallengeConfig;

export interface CalibrationResult {
  noiseFloor: number;
  threshold: number;
}
