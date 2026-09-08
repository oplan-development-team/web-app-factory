import { el } from './dom';

export interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
  tone?: 'default' | 'error';
}

let container: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (!container) {
    container = el('div', { class: 'toast-stack', role: 'status', 'aria-live': 'polite' });
    document.body.append(container);
  }
  return container;
}

export function showToast(opts: ToastOptions) {
  const stack = getContainer();
  const toast = el('div', { class: `toast ${opts.tone === 'error' ? 'toast--error' : ''}` }, [
    el('span', { class: 'toast__message' }, [opts.message]),
  ]);
  if (opts.actionLabel && opts.onAction) {
    const btn = el('button', { class: 'toast__action', type: 'button' }, [opts.actionLabel]);
    btn.addEventListener('click', () => {
      opts.onAction?.();
      dismiss();
    });
    toast.append(btn);
  }
  const closeBtn = el('button', { class: 'toast__close', type: 'button', 'aria-label': '閉じる' }, ['×']);
  closeBtn.addEventListener('click', () => dismiss());
  toast.append(closeBtn);

  stack.append(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  let dismissed = false;
  const timer = window.setTimeout(dismiss, opts.duration ?? 4200);
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    window.clearTimeout(timer);
    toast.classList.remove('toast--visible');
    toast.classList.add('toast--leaving');
    window.setTimeout(() => toast.remove(), 260);
  }
}
