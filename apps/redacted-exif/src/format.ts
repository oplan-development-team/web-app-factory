/** Formatting helpers for the parody-official-document chrome. */

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

/** e.g. 個情リ発第2026-0905-7743号 */
export function documentNumber(seed: number): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const serial = pad(seed % 10000, 4);
  return `個情リ発第${y}-${m}${d}-${serial}号`;
}

/** e.g. 受付番号 A-338291 */
export function receiptNumber(seed: number): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const letter = letters[seed % letters.length];
  const num = pad((seed * 7 + 1013) % 1000000, 6);
  return `${letter}-${num}`;
}

export function issueDateJa(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const week = ['日', '月', '火', '水', '木', '金', '土'][now.getDay()];
  return `令和${y - 2018}年${m}月${d}日（${week}）`;
}

export function seededFrom(name: string, size: number): number {
  let h = 2166136261;
  const s = `${name}:${size}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function formatDateTime(d: Date): string {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

export function formatCoord(value: number, isLat: boolean): string {
  const dir = isLat ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  return `${Math.abs(value).toFixed(6)}° ${dir}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}
