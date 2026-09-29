export type CopyResult = 'copied' | 'fallback';

/**
 * クリップボードへのコピーを試みる。Clipboard API が使えない/拒否された環境では
 * 'fallback' を返すので、呼び出し側でテキスト選択状態などの代替手段を提示する。
 */
export async function copyToClipboard(text: string): Promise<CopyResult> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
  } catch {
    // フォールバックへ
  }
  return 'fallback';
}
