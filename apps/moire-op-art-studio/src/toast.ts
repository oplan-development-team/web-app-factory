let hideTimer: number | undefined;

export function showToast(message: string, tone: 'default' | 'error' = 'default'): void {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('toast--error', tone === 'error');
  el.hidden = false;
  el.classList.remove('toast--visible');
  // force reflow so the animation restarts on repeated toasts
  void el.offsetWidth;
  el.classList.add('toast--visible');

  if (hideTimer) window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    el.classList.remove('toast--visible');
    window.setTimeout(() => {
      el.hidden = true;
    }, 200);
  }, 2600);
}
