let root: HTMLElement | null = null;

function getRoot(): HTMLElement {
  if (!root) {
    root = document.getElementById('toast-root');
  }
  if (!root) throw new Error('toast root not found');
  return root;
}

export interface ToastHandle {
  update: (message: string) => void;
  close: () => void;
}

export function showToast(message: string, opts: { duration?: number; tone?: 'default' | 'accent' } = {}): ToastHandle {
  const el = document.createElement('div');
  el.className = `toast${opts.tone === 'accent' ? ' toast--accent' : ''}`;
  el.textContent = message;
  getRoot().appendChild(el);

  requestAnimationFrame(() => {
    el.classList.add('toast--visible');
  });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    el.classList.remove('toast--visible');
    window.setTimeout(() => el.remove(), 260);
  };

  const duration = opts.duration ?? 3200;
  if (duration > 0) {
    window.setTimeout(close, duration);
  }

  return {
    update: (message: string) => {
      el.textContent = message;
    },
    close,
  };
}
