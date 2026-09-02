export function confirmDialog(message: string, confirmLabel = '実行する', cancelLabel = 'やめる'): Promise<boolean> {
  return new Promise((resolve) => {
    const root = document.getElementById('dialog-root');
    if (!root) {
      resolve(window.confirm(message));
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const box = document.createElement('div');
    box.className = 'dialog-box';
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');

    const text = document.createElement('p');
    text.className = 'dialog-box__message';
    text.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'dialog-box__actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--line';
    cancelBtn.textContent = cancelLabel;

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn--accent';
    confirmBtn.textContent = confirmLabel;

    const finish = (result: boolean) => {
      overlay.remove();
      resolve(result);
    };

    cancelBtn.addEventListener('click', () => finish(false));
    confirmBtn.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    box.appendChild(text);
    box.appendChild(actions);
    overlay.appendChild(box);
    root.appendChild(overlay);

    confirmBtn.focus();
  });
}
