import qrcode from 'qrcode-generator';
import type { EccLevel } from './types';

// `qrcode-generator` defaults to a single-byte encoder, which mangles Japanese
// input. Its optional UTF-8 module is not reachable through the package's
// `exports` map, and TextEncoder is a better source of truth anyway: byte mode
// with UTF-8 bytes is what every modern reader assumes.
qrcode.stringToBytes = (value: string): number[] =>
  Array.from(new TextEncoder().encode(value));

export interface QrMatrix {
  /** Module count per side (4 * version + 17). */
  size: number;
  version: number;
  /** Row-major, 1 = dark. */
  data: Uint8Array;
}

export type QrFailure =
  | { reason: 'empty' }
  | { reason: 'overflow'; message: string }
  | { reason: 'unknown'; message: string };

export type QrResult = { ok: true; matrix: QrMatrix } | ({ ok: false } & QrFailure);

export function isDark(matrix: QrMatrix, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row >= matrix.size || col >= matrix.size) return false;
  return matrix.data[row * matrix.size + col] === 1;
}

/**
 * Build the raw module matrix. Leading/trailing whitespace is trimmed because a
 * stray newline pasted alongside a URL silently produces an unusable code.
 */
export function generateMatrix(text: string, ecc: EccLevel): QrResult {
  const payload = text.trim();
  if (payload.length === 0) return { ok: false, reason: 'empty' };

  try {
    const qr = qrcode(0, ecc);
    qr.addData(payload);
    qr.make();

    const size = qr.getModuleCount();
    const data = new Uint8Array(size * size);
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        data[row * size + col] = qr.isDark(row, col) ? 1 : 0;
      }
    }

    return { ok: true, matrix: { size, version: (size - 17) / 4, data } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/overflow/i.test(message)) {
      return {
        ok: false,
        reason: 'overflow',
        message: 'テキストが長すぎて、この誤り訂正レベルでは収まりません。',
      };
    }
    return { ok: false, reason: 'unknown', message };
  }
}

/** The three 7x7 finder patterns, as top-left module coordinates. */
export function finderOrigins(size: number): ReadonlyArray<readonly [number, number]> {
  return [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
}

export function isInFinder(size: number, row: number, col: number): boolean {
  for (const [originRow, originCol] of finderOrigins(size)) {
    if (
      row >= originRow &&
      row < originRow + 7 &&
      col >= originCol &&
      col < originCol + 7
    ) {
      return true;
    }
  }
  return false;
}
