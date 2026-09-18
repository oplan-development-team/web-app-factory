/**
 * A small bordered confirm dialog matching the poster's Swiss typographic
 * system (native confirm() would break the crafted visual language).
 */
export function confirmDialog(message: string, confirmLabel = 'CONFIRM'): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'gs-dialog-overlay';

    const box = document.createElement('div');
    box.className = 'gs-dialog';

    const msg = document.createElement('p');
    msg.className = 'gs-dialog__message';
    msg.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'gs-dialog__actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'gs-btn gs-btn--ghost';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'CANCEL';

    const okBtn = document.createElement('button');
    okBtn.className = 'gs-btn gs-btn--signal';
    okBtn.type = 'button';
    okBtn.textContent = confirmLabel;

    const cleanup = (result: boolean) => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cleanup(false);
    };

    cancelBtn.addEventListener('click', () => cleanup(false));
    okBtn.addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });
    document.addEventListener('keydown', onKey);

    actions.append(cancelBtn, okBtn);
    box.append(msg, actions);
    overlay.append(box);
    document.body.append(overlay);
    okBtn.focus();
  });
}

export function toast(message: string): void {
  const el = document.createElement('div');
  el.className = 'gs-toast';
  el.textContent = message;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('gs-toast--visible'));
  setTimeout(() => {
    el.classList.remove('gs-toast--visible');
    setTimeout(() => el.remove(), 220);
  }, 2200);
}
