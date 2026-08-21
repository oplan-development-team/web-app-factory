import qrcode from 'qrcode-generator';
import type { EccLevel, ProtectLevel } from './types';

// qrcode-generator の既定エンコーダは 1 バイト前提で、日本語が化ける。
// パッケージの exports マップから UTF-8 モジュールに到達できないため、
// TextEncoder で置き換える。バイトモード + UTF-8 は現代のリーダーの共通前提（SPEC FR-001.2）。
qrcode.stringToBytes = (value: string): number[] =>
  Array.from(new TextEncoder().encode(value));

/** モジュールの役割。数値は Uint8Array に詰めるためのタグ（SPEC FR-002.5） */
export const Role = {
  Data: 0,
  Finder: 1,
  Separator: 2,
  Timing: 3,
  Alignment: 4,
  Format: 5,
  Version: 6,
} as const;

export type RoleValue = (typeof Role)[keyof typeof Role];

export interface QrMatrix {
  /** 1 辺のモジュール数 (4 * version + 17) */
  size: number;
  version: number;
  /** row-major, 1 = 黒 */
  bits: Uint8Array;
  /** row-major, Role の値 */
  roles: Uint8Array;
}

export type QrResult =
  | { ok: true; matrix: QrMatrix }
  | { ok: false; reason: 'empty' }
  | { ok: false; reason: 'overflow'; message: string }
  | { ok: false; reason: 'unknown'; message: string };

/**
 * 位置合わせパターンの中心座標表（JIS X 0510 / ISO 18004 Annex E）。
 * 添字 = 型番 (version)。型番 1 は位置合わせパターンを持たない。
 */
const ALIGNMENT_CENTERS: readonly (readonly number[])[] = [
  [], // 0: 未使用
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
];

export function alignmentCenters(version: number): readonly number[] {
  return ALIGNMENT_CENTERS[version] ?? [];
}

function inBox(
  row: number,
  col: number,
  top: number,
  left: number,
  height: number,
  width: number,
): boolean {
  return row >= top && row < top + height && col >= left && col < left + width;
}

/**
 * 各モジュールの役割を QR 仕様の座標規則から判定する。
 * qrcode-generator は役割を公開しないため自前で持つ（PLAN §3.1）。
 *
 * 判定の優先順は finder > separator > timing > alignment > version > format > data。
 * timing を format より先に見るのは、形式情報のビット配置が行 6 / 列 6 を
 * 避けて並ぶため、先に timing を確定させないと取り違えるから。
 */
export function classifyRoles(size: number, version: number): Uint8Array {
  const roles = new Uint8Array(size * size);
  const centers = alignmentCenters(version);
  const last = centers.length - 1;

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      roles[row * size + col] = classifyOne(size, version, centers, last, row, col);
    }
  }
  return roles;
}

function classifyOne(
  size: number,
  version: number,
  centers: readonly number[],
  last: number,
  row: number,
  col: number,
): RoleValue {
  // ファインダー: 3 隅の 7x7
  if (
    inBox(row, col, 0, 0, 7, 7) ||
    inBox(row, col, 0, size - 7, 7, 7) ||
    inBox(row, col, size - 7, 0, 7, 7)
  ) {
    return Role.Finder;
  }

  // 分離パターン: ファインダーを囲む幅 1 の帯
  if (
    inBox(row, col, 0, 0, 8, 8) ||
    inBox(row, col, 0, size - 8, 8, 8) ||
    inBox(row, col, size - 8, 0, 8, 8)
  ) {
    return Role.Separator;
  }

  // タイミングパターン: 行 6 / 列 6
  if (row === 6 || col === 6) return Role.Timing;

  // 位置合わせパターン: 中心座標の総当たり 5x5。ファインダーと重なる 3 組は存在しない
  for (let i = 0; i < centers.length; i += 1) {
    for (let j = 0; j < centers.length; j += 1) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === last) ||
        (i === last && j === 0)
      ) {
        continue;
      }
      if (inBox(row, col, centers[i] - 2, centers[j] - 2, 5, 5)) return Role.Alignment;
    }
  }

  // 型番情報: 型番 7 以上で 6x3 と 3x6 の 2 ブロック
  if (version >= 7) {
    if (inBox(row, col, 0, size - 11, 6, 3) || inBox(row, col, size - 11, 0, 3, 6)) {
      return Role.Version;
    }
  }

  // 形式情報: 行 8 の両端と列 8 の両端（暗モジュールを含む）
  if (row === 8 && (col < 9 || col >= size - 8)) return Role.Format;
  if (col === 8 && (row < 9 || row >= size - 8)) return Role.Format;

  return Role.Data;
}

/**
 * 生のモジュール行列を作る。前後の空白を落とすのは、URL に紛れ込んだ改行が
 * 黙って使い物にならないコードを生むのを避けるため。
 */
export function generateMatrix(text: string, ecc: EccLevel): QrResult {
  const payload = text.trim();
  if (payload.length === 0) return { ok: false, reason: 'empty' };

  try {
    const qr = qrcode(0, ecc);
    qr.addData(payload);
    qr.make();

    const size = qr.getModuleCount();
    const version = (size - 17) / 4;
    const bits = new Uint8Array(size * size);
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        bits[row * size + col] = qr.isDark(row, col) ? 1 : 0;
      }
    }

    return { ok: true, matrix: { size, version, bits, roles: classifyRoles(size, version) } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/overflow|too long|code length/i.test(message)) {
      return {
        ok: false,
        reason: 'overflow',
        message: 'テキストが長すぎて、この誤り訂正レベルでは収まりません。',
      };
    }
    return { ok: false, reason: 'unknown', message };
  }
}

const PROTECTED_ROLES: Record<ProtectLevel, ReadonlySet<number>> = {
  none: new Set(),
  patterns: new Set([Role.Finder, Role.Separator, Role.Timing, Role.Alignment]),
  all: new Set([
    Role.Finder,
    Role.Separator,
    Role.Timing,
    Role.Alignment,
    Role.Format,
    Role.Version,
  ]),
};

/**
 * 保護レベルに応じて「3x3 全セルを元モジュール値で塗るモジュール」の
 * マスクを作る（SPEC FR-006.7）。
 */
export function buildProtectMask(matrix: QrMatrix, level: ProtectLevel): Uint8Array {
  const targets = PROTECTED_ROLES[level];
  const mask = new Uint8Array(matrix.size * matrix.size);
  if (targets.size === 0) return mask;
  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = targets.has(matrix.roles[i]) ? 1 : 0;
  }
  return mask;
}
