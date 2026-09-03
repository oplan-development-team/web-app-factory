import { dom } from './dom';

type ToastVariant = 'info' | 'success' | 'error';

let hideTimer: number | undefined;

/** filenameなど信頼できない文字列を扱うため textContent のみを使う(innerHTML は使わない)。 */
export function showToast(message: string, variant: ToastVariant = 'info'): void {
  window.clearTimeout(hideTimer);
  dom.toast.textContent = message;
  dom.toast.dataset.variant = variant;
  dom.toast.hidden = false;
  // 同じメッセージが連続しても毎回アニメーションし直すために一度クラスを外して戻す
  dom.toast.style.animation = 'none';
  void dom.toast.offsetWidth;
  dom.toast.style.animation = '';

  hideTimer = window.setTimeout(() => {
    dom.toast.hidden = true;
  }, 3200);
}
