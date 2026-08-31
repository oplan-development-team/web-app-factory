let root: HTMLElement | null = null;

function getRoot(): HTMLElement {
  if (!root) {
    root = document.getElementById('toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      document.body.appendChild(root);
    }
  }
  return root;
}

export function showToast(message: string, tone: 'success' | 'error' = 'success'): void {
  const el = document.createElement('div');
  el.className = tone === 'error' ? 'toast toast--error' : 'toast';
  el.textContent = message;
  el.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  getRoot().appendChild(el);
  window.setTimeout(() => {
    el.remove();
  }, 3000);
}
