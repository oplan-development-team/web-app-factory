import { describe, expect, it } from 'vitest';
import { FALLBACK_MESSAGE, getHintCopy, getOnboardingCopy } from './copy';

describe('getOnboardingCopy', () => {
  it('always includes the "はじめる" call to action regardless of state (AC-15)', () => {
    (['ios-permission', 'sensor', 'none'] as const).forEach((state) => {
      expect(getOnboardingCopy(state).cta).toBe('はじめる');
    });
  });

  it('produces three distinct body texts across the three states (AC-1)', () => {
    const bodies = (['ios-permission', 'sensor', 'none'] as const).map(
      (state) => getOnboardingCopy(state).body,
    );
    expect(new Set(bodies).size).toBe(3);
  });

  it('explains the permission prompt and that granting it starts the experience for ios-permission (AC-2)', () => {
    const { body } = getOnboardingCopy('ios-permission');
    expect(body).toContain('「はじめる」を押すと');
    expect(body).toContain('端末の傾きセンサー利用の許可を求める画面が表示されます');
    expect(body).toContain('許可');
    expect(body).toContain('体験がはじまります');
  });

  it('mentions tilting the device for the sensor state', () => {
    expect(getOnboardingCopy('sensor').body).toContain('傾ける');
  });

  it('explicitly mentions mouse drag operation for the none state (AC-3)', () => {
    expect(getOnboardingCopy('none').body).toContain('マウスのドラッグ操作で体験できます');
  });
});

describe('FALLBACK_MESSAGE', () => {
  it('mentions dragging as the replacement input when permission is unavailable (AC-6, AC-7)', () => {
    expect(FALLBACK_MESSAGE).toContain('指でなぞって');
  });
});

describe('getHintCopy', () => {
  it('returns distinct hints for tilt and drag modes', () => {
    expect(getHintCopy('tilt')).not.toBe(getHintCopy('drag'));
  });

  it('mentions tilting for tilt mode', () => {
    expect(getHintCopy('tilt')).toContain('傾けて');
  });

  it('mentions tracing/dragging for drag mode', () => {
    expect(getHintCopy('drag')).toContain('なぞって');
  });
});
