// PNG download helpers, plus an iOS-aware fallback since `<a download>` does
// not reliably save to the camera roll on iOS Safari.

export function buildFileName(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `ephemeral-sparkler-${stamp}.png`;
}

export function downloadPng(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** iOS Safari (and other iOS browsers, all WebKit-based) can't reliably auto-save via `download`. */
export function isIOS(): boolean {
  const ua = window.navigator.userAgent;
  const isAppleTouch = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
  const isIpadOS13Plus = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return isAppleTouch || isIpadOS13Plus;
}
