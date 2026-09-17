/**
 * A small custom confirm dialog (styled to match the vault aesthetic)
 * standing in for a native `confirm()` — used before destructive actions
 * like "start over", so a misclick can't silently wipe progress.
 */
export function confirmModal(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    const scrim = document.createElement('div');
    scrim.className = 'modal-scrim';

    const panel = document.createElement('div');
    panel.className = 'modal-panel';
    panel.setAttribute('role', 'alertdialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'modal-title');

    const h = document.createElement('h2');
    h.id = 'modal-title';
    h.className = 'modal-title';
    h.textContent = title;

    const p = document.createElement('p');
    p.className = 'modal-message';
    p.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.textContent = 'キャンセル';

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'btn btn-hazard';
    okBtn.textContent = confirmLabel;

    const close = (result: boolean) => {
      scrim.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    };

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };

    cancelBtn.addEventListener('click', () => close(false));
    okBtn.addEventListener('click', () => close(true));
    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) close(false);
    });
    document.addEventListener('keydown', onKeydown);

    actions.append(cancelBtn, okBtn);
    panel.append(h, p, actions);
    scrim.append(panel);
    document.body.append(scrim);
    okBtn.focus();
  });
}
