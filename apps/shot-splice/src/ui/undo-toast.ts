import { el, setText, toggleAttr } from './dom';

export interface UndoToastCallbacks {
  readonly onUndo: () => void;
}

export interface UndoToastOptions {
  /** How long the toast stays up before it dismisses itself. */
  readonly durationMs?: number;
}

export interface UndoToast {
  readonly element: HTMLElement;
  /** Shows `message` with an undo action, restarting the auto-dismiss timer. */
  show(message: string): void;
  dismiss(): void;
}

/** A single shot deletion has no confirmation step, so this is the recovery path. */
const DEFAULT_DURATION_MS = 4000;

/**
 * A transient "deleted · undo" notice.
 *
 * Deleting a single shot happens immediately, with no confirmation dialog —
 * that friction is reserved for the destructive "delete everything" action.
 * This toast is what makes the immediate delete safe: it names what was
 * removed and offers a few seconds to reverse it before the timer clears it
 * away on its own.
 */
export function createUndoToast(
  callbacks: UndoToastCallbacks,
  options: UndoToastOptions = {},
): UndoToast {
  const duration = options.durationMs ?? DEFAULT_DURATION_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const message = el('p', { class: 'undo-toast__message' });
  const undo = el('button', {
    class: 'undo-toast__action',
    type: 'button',
    text: '元に戻す',
    on: {
      click: () => {
        dismiss();
        callbacks.onUndo();
      },
    },
  });

  const element = el(
    'div',
    { class: 'undo-toast', attrs: { role: 'status', 'aria-live': 'polite', hidden: true } },
    [message, undo],
  );

  function dismiss(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    toggleAttr(element, 'hidden', true);
  }

  function show(text: string): void {
    if (timer !== null) clearTimeout(timer);
    setText(message, text);
    toggleAttr(element, 'hidden', false);
    timer = setTimeout(dismiss, duration);
  }

  return { element, show, dismiss };
}
