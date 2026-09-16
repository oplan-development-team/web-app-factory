import type { CapabilityState } from '../lib/capability';
import { getOnboardingCopy } from '../lib/copy';

export interface OnboardingHandle {
  element: HTMLElement;
  /** Fades the onboarding screen out and removes it from the layout flow. */
  dismiss: () => void;
}

/**
 * Builds the onboarding screen DOM for the given capability state and wires
 * the "はじめる" button to `onStart`. `onStart` runs synchronously inside the
 * click handler so callers can call `requestPermission()` within the same
 * user-gesture call stack (AC-4).
 */
export function createOnboarding(
  state: CapabilityState,
  onStart: () => void,
): OnboardingHandle {
  const copy = getOnboardingCopy(state);

  const root = document.createElement('section');
  root.className = 'onboarding';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', copy.title);

  const title = document.createElement('h1');
  title.className = 'onboarding__title';
  title.textContent = copy.title;

  const subtitle = document.createElement('p');
  subtitle.className = 'onboarding__subtitle';
  subtitle.textContent = copy.subtitle;

  const divider = document.createElement('div');
  divider.className = 'onboarding__divider';
  divider.setAttribute('aria-hidden', 'true');

  const body = document.createElement('p');
  body.className = 'onboarding__body';
  body.textContent = copy.body;

  const spacer = document.createElement('div');
  spacer.className = 'onboarding__spacer';
  spacer.setAttribute('aria-hidden', 'true');

  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = 'onboarding__cta';
  cta.textContent = copy.cta;
  cta.addEventListener('click', onStart);

  root.append(title, subtitle, divider, body, spacer, cta);

  const dismiss = () => {
    root.setAttribute('hidden', '');
    window.setTimeout(() => root.remove(), 550);
  };

  return { element: root, dismiss };
}
