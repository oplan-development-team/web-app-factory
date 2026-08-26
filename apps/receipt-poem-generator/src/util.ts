let uidCounter = 0;

/** Generates a short, sufficiently-unique id without relying on crypto.randomUUID (Safari/older support). */
export function makeId(): string {
  uidCounter += 1;
  return `item-${Date.now().toString(36)}-${uidCounter}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function formatYen(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  return `¥${Math.round(safe).toLocaleString('ja-JP')}`;
}

export function toDateTimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Formats a datetime-local input value into the museum-caption style stamp used on the receipt. */
export function formatReceiptStamp(dateTimeLocal: string): string {
  const d = new Date(dateTimeLocal);
  if (Number.isNaN(d.getTime())) return '----.--.-- --:--';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Formats the same date for the editorial "Fig." caption under the exhibit. */
export function formatCaptionDate(dateTimeLocal: string): string {
  const d = new Date(dateTimeLocal);
  if (Number.isNaN(d.getTime())) return '----.--.--';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** Simple deterministic string hash (djb2) used to seed pseudo-random but stable decorations. */
export function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
}

/** Tiny mulberry32 PRNG for deterministic pseudo-random sequences (e.g. barcode bar widths). */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateReceiptNo(seed: string): string {
  const h = hashString(seed + String(Date.now()));
  const n = (h % 90000) + 10000;
  return `No. ${n}`;
}
