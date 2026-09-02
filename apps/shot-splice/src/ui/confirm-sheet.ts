import { el, setText, toggleAttr } from './dom';

export interface ConfirmRequest {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
}

export interface ConfirmSheet {
  readonly element: HTMLElement;
  open(request: ConfirmRequest): void;
  close(): void;
}

/**
 * A destructive-action confirmation, styled as the same bottom sheet used
 * throughout the app (see `createSeamSheet`) rather than the browser's native
 * `confirm()` — so the one moment that asks "are you sure?" doesn't look and
 * behave like it came from a different application.
 */
export function createConfirmSheet(): ConfirmSheet {
  let onConfirm: (() => void) | null = null;

  const title = el('h2', { class: 'sheet__title' });
  const message = el('p', { class: 'confirm__message' });

  const cancel = el('button', {
    class: 'btn btn--ghost',
    type: 'button',
    text: 'キャンセル',
    on: { click: () => close() },
  });

  const confirm = el('button', {
    class: 'btn btn--danger',
    type: 'button',
    on: {
      click: () => {
        const fn = onConfirm;
        close();
        fn?.();
      },
    },
  });

  const panel = el('div', { class: 'sheet__panel confirm__panel' }, [
    el('div', { class: 'sheet__head' }, [title]),
    message,
    el('div', { class: 'sheet__row confirm__actions' }, [cancel, confirm]),
  ]);

  const scrim = el('div', { class: 'sheet__scrim', on: { click: () => close() } });
  const element = el('div', {
    class: 'sheet',
    attrs: { role: 'alertdialog', 'aria-modal': 'true', hidden: true },
  });
  element.append(scrim, panel);

  function close(): void {
    onConfirm = null;
    toggleAttr(element, 'hidden', true);
  }

  function open(request: ConfirmRequest): void {
    onConfirm = request.onConfirm;
    setText(title, request.title);
    setText(message, request.message);
    setText(confirm, request.confirmLabel);
    element.setAttribute('aria-label', request.title);
    toggleAttr(element, 'hidden', false);
  }

  return { element, open, close };
}
