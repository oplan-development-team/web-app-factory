/**
 * URLハッシュへの軽量エンコード/デコード。
 * 外部圧縮ライブラリは使わず、UTF-8安全なbase64 + encodeURIComponentのみで完結させる。
 * メッセージはここにしか存在しない（サーバー保存なし）。
 */

export const NEON_COLORS = {
  violet: '#b24bf3',
  cyan: '#34f5e0',
  magenta: '#ff3fa4',
  acid: '#b6ff3f',
} as const;

export type NeonColorKey = keyof typeof NEON_COLORS;

export const NEON_COLOR_LABELS: Record<NeonColorKey, string> = {
  violet: '紫の光',
  cyan: '青緑の光',
  magenta: '赤紫の光',
  acid: '酸の緑光',
};

export const MAX_LENGTH = 280;

export interface Letter {
  text: string;
  color: NeonColorKey;
}

function isNeonColorKey(value: unknown): value is NeonColorKey {
  return typeof value === 'string' && value in NEON_COLORS;
}

function utf8ToBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToUtf8(input: string): string {
  const binary = atob(input);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeLetter(letter: Letter): string {
  const payload = JSON.stringify({ t: letter.text, c: letter.color });
  return encodeURIComponent(utf8ToBase64(payload));
}

/**
 * 壊れた/不正なハッシュはthrowせず常にnullで返す。呼び出し側はnullを
 * 「この手紙は届いていない」状態として扱う。
 */
export function decodeLetter(hash: string): Letter | null {
  if (!hash) return null;
  try {
    const decoded = decodeURIComponent(hash);
    const json = base64ToUtf8(decoded);
    const obj: unknown = JSON.parse(json);
    if (typeof obj !== 'object' || obj === null) return null;
    const t = (obj as Record<string, unknown>).t;
    const c = (obj as Record<string, unknown>).c;
    if (typeof t !== 'string' || !t.trim()) return null;
    if (!isNeonColorKey(c)) return null;
    return { text: t.slice(0, MAX_LENGTH), color: c };
  } catch {
    return null;
  }
}

export function buildShareUrl(letter: Letter): string {
  const encoded = encodeLetter(letter);
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}#${encoded}`;
}
