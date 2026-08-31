/**
 * A tiny neo-brutalist confirm dialog, since the native browser confirm()
 * would look completely out of place against the rest of the UI.
 */
export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Optional opt-in checkbox, e.g. "also wipe the lifetime record". */
  toggleLabel?: string;
  toggleHint?: string;
}

export interface ConfirmResult {
  confirmed: boolean;
  /** State of the optional toggle. Always false when no toggle was offered. */
  toggled: boolean;
}

export function confirmModal(opts: ConfirmOptions): Promise<ConfirmResult> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const box = document.createElement('div');
    box.className = 'modal-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');

    const title = document.createElement('p');
    title.className = 'modal-title';
    title.textContent = opts.title;

    const body = document.createElement('p');
    body.className = 'modal-body';
    body.textContent = opts.body;

    box.append(title, body);

    let toggleInput: HTMLInputElement | null = null;
    if (opts.toggleLabel) {
      const wrap = document.createElement('label');
      wrap.className = 'modal-toggle';

      toggleInput = document.createElement('input');
      toggleInput.type = 'checkbox';
      toggleInput.className = 'modal-toggle-input';

      const text = document.createElement('span');
      text.className = 'modal-toggle-text';
      text.textContent = opts.toggleLabel;

      wrap.append(toggleInput, text);
      box.append(wrap);

      if (opts.toggleHint) {
        const hint = document.createElement('p');
        hint.className = 'modal-toggle-hint';
        hint.textContent = opts.toggleHint;
        box.append(hint);
      }
    }

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.type = 'button';
    cancelBtn.textContent = opts.cancelLabel;

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-danger';
    confirmBtn.type = 'button';
    confirmBtn.textContent = opts.confirmLabel;

    const finish = (confirmed: boolean) => {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve({ confirmed, toggled: confirmed && Boolean(toggleInput?.checked) });
    };

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
    };

    cancelBtn.addEventListener('click', () => finish(false));
    confirmBtn.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });
    document.addEventListener('keydown', onKeydown);

    actions.append(cancelBtn, confirmBtn);
    box.append(actions);
    overlay.append(box);
    document.body.append(overlay);
    confirmBtn.focus();
  });
}
