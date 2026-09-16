export interface OverlayMessageOptions {
  /** Extra CSS class for semantic tinting (e.g. the permission-fallback notice). */
  variant?: 'hint' | 'notice';
  /** How long the message stays fully visible before fading out, in ms. */
  holdMs?: number;
  /** Called once the fade-out transition has finished and the element is removed. */
  onDone?: () => void;
}

const DEFAULT_HOLD_MS = 3200;
const FADE_MS = 900;

/**
 * Shows a short-lived overlay message (operation hint or permission-fallback
 * notice) that fades in, holds, then fades out and removes itself (FR-13).
 * Returns the element in case a caller wants to remove it early.
 */
export function showOverlayMessage(
  container: HTMLElement,
  text: string,
  options: OverlayMessageOptions = {},
): HTMLElement {
  const { variant = 'hint', holdMs = DEFAULT_HOLD_MS, onDone } = options;

  const el = document.createElement('div');
  el.className = `overlay-message overlay-message--${variant}`;
  el.textContent = text;
  el.setAttribute('role', 'status');
  container.appendChild(el);

  // Force a layout flush so the initial (opacity: 0) state is committed
  // before adding the visible class, or the browser may coalesce both
  // states into a single frame and skip the fade-in transition.
  void el.offsetHeight;
  el.classList.add('overlay-message--visible');

  window.setTimeout(() => {
    el.classList.remove('overlay-message--visible');
    window.setTimeout(() => {
      el.remove();
      onDone?.();
    }, FADE_MS);
  }, holdMs);

  return el;
}
