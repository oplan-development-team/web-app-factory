/**
 * A tiny neo-brutalist confirm dialog, since the native browser confirm()
 * would look completely out of place against the rest of the UI.
 */
export function confirmModal(opts: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const box = document.createElement('div');
    box.className = 'modal-box';

    const title = document.createElement('p');
    title.className = 'modal-title';
    title.textContent = opts.title;

    const body = document.createElement('p');
    body.className = 'modal-body';
    body.textContent = opts.body;

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

    const finish = (result: boolean) => {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
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
    box.append(title, body, actions);
    overlay.append(box);
    document.body.append(overlay);
    confirmBtn.focus();
  });
}
