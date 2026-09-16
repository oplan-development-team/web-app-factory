/**
 * All user-facing copy, kept as pure data/functions so wording differences
 * across the three capability states (FR-7) and the fallback/hint moments
 * are unit-testable without touching the DOM.
 */
import type { CapabilityState } from './capability';

export type InputMode = 'tilt' | 'drag';

export interface OnboardingCopy {
  title: string;
  subtitle: string;
  body: string;
  cta: string;
}

const CTA = 'はじめる';

/**
 * Body copy per capability state. Wording deliberately echoes the phrases
 * required by AC-2 / AC-3 so the "はじめる" flow explains what is about to
 * happen before it happens.
 */
export function getOnboardingCopy(state: CapabilityState): OnboardingCopy {
  const title = '凪の池';
  const subtitle = 'Still Pond';
  switch (state) {
    case 'ios-permission':
      return {
        title,
        subtitle,
        body: '「はじめる」を押すと、端末の傾きセンサー利用の許可を求める画面が表示されます。「許可」を選ぶと、体験がはじまります。',
        cta: CTA,
      };
    case 'sensor':
      return {
        title,
        subtitle,
        body: '端末をそっと傾けると、水面がその動きに応えます。',
        cta: CTA,
      };
    case 'none':
      return {
        title,
        subtitle,
        body: '指先で水面をなぞってください。マウスのドラッグ操作で体験できます。',
        cta: CTA,
      };
  }
}

/** Shown after a denied permission or a requestPermission() failure (AC-6, AC-7). */
export const FALLBACK_MESSAGE =
  '傾きセンサーの利用が許可されなかったため、かわりに指でなぞって水面を揺らせます。';

/** Short post-load operation hint text (FR-13), keyed by the active input mode. */
export function getHintCopy(mode: InputMode): string {
  return mode === 'tilt'
    ? '端末を傾けて、水面をゆらしてみてください。'
    : '指でなぞって、水面をゆらしてみてください。';
}
