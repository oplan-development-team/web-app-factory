let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(el: HTMLElement, message: string, tone: 'success' | 'error' = 'success'): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  el.textContent = message;
  el.dataset.tone = tone;
  el.hidden = false;
  el.classList.remove('is-visible');
  // Force reflow so the entrance animation replays on repeated toasts.
  void el.offsetWidth;
  el.classList.add('is-visible');

  hideTimer = setTimeout(() => {
    el.hidden = true;
    el.classList.remove('is-visible');
  }, 2600);
}
