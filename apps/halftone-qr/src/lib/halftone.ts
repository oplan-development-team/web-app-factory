import type { QrMatrix } from './qr';
import { SUB, clamp } from './types';

/**
 * 非中央サブモジュールに対する「QR らしさ」の効き具合（SPEC FR-006.6）。
 *
 * 斜め 4 隅を弱めているのは、隅が隣接モジュールと視覚的に共有される位置で、
 * ここを固めると画像のディテールが真っ先に失われるため。
 * 上下左右はモジュールの見かけの明暗を決める支配的な位置なので 1.0 のまま効かせる。
 * 中央（[1][1]）はこの表を参照しない（常に固定されるため）。
 */
const SUB_WEIGHT: readonly (readonly number[])[] = [
  [0.55, 1.0, 0.55],
  [1.0, 0, 1.0],
  [0.55, 1.0, 0.55],
];

/**
 * 拡散する誤差の上限。強制ビット（中央・保護）は目標輝度と大きく食い違うことが
 * あり、その誤差をそのまま流すと走査方向に縞状のアーティファクトが伸びる。
 */
const ERROR_CLAMP = 0.55;

/**
 * λ と位置重み w から、実際の引き寄せ量を求める（SPEC FR-006.6）。
 *
 *   mix = λ·w + λ²·(1 - w)
 *
 * 単純な λ·w にすると、λ を最大にしても斜め 4 隅は w=0.55 の分だけ画像に
 * 従い続け、「スライダーを振り切っても元の QR に戻らない」という挙動になる。
 * スライダーの上端は「最も読み取りやすい状態」であってほしいので、
 * 二次項で λ=1 のとき全位置が 1 に到達するようにしている。
 * 途中経過では隅の追従が遅れるため、隅を弱める意図自体は保たれる。
 */
export function mixAmount(lambda: number, weight: number): number {
  return lambda * weight + lambda * lambda * (1 - weight);
}

export interface HalftoneInput {
  matrix: QrMatrix;
  /** モジュール単位の保護マスク（1 = 3x3 全セルを元の値で塗る） */
  protectMask: Uint8Array;
  /** 3N x 3N の輝度配列（1 = 白）。null なら画像なしとして元 QR を 3 倍に拡大する */
  luma: Float32Array | null;
  /** QR らしさ λ (0..1) */
  qrness: number;
}

/** サブモジュールグリッドの 1 辺 */
export function subGridSize(moduleCount: number): number {
  return moduleCount * SUB;
}

/**
 * ハーフトーン QR を生成する（SPEC FR-006）。
 *
 * 戻り値は 3N x 3N の row-major、1 = 黒。
 *
 * 不変条件: 各モジュールの中央サブモジュールは、必ず元 QR のビット値になる。
 * λ・画像の内容・階調設定はこれを変えられない。ここが崩れると
 * 「誤り訂正の対象データが常に正しい」という本手法の前提が失われる。
 */
export function halftone({ matrix, protectMask, luma, qrness }: HalftoneInput): Uint8Array {
  const moduleCount = matrix.size;
  const size = subGridSize(moduleCount);
  const out = new Uint8Array(size * size);
  const error = new Float32Array(size * size);
  const lambda = clamp(qrness, 0, 1);

  for (let y = 0; y < size; y += 1) {
    // 蛇行走査。一方向だけで流すと誤差が斜めに溜まり、虫食い状の筋が出る
    const leftToRight = y % 2 === 0;
    const moduleRow = (y / SUB) | 0;
    const subRow = y % SUB;
    const rowOffset = y * size;

    for (let step = 0; step < size; step += 1) {
      const x = leftToRight ? step : size - 1 - step;
      const index = rowOffset + x;
      const moduleIndex = moduleRow * moduleCount + ((x / SUB) | 0);
      const subCol = x % SUB;

      // 元 QR のモジュール輝度。bits は 1 = 黒なので反転して 1 = 白に揃える
      const moduleLuma = matrix.bits[moduleIndex] === 1 ? 0 : 1;

      const isCenter = subRow === 1 && subCol === 1;
      const isForced = isCenter || protectMask[moduleIndex] === 1;

      let target: number;
      if (isForced) {
        target = moduleLuma;
      } else {
        const source = luma === null ? moduleLuma : luma[index];
        const mix = mixAmount(lambda, SUB_WEIGHT[subRow][subCol]);
        target = source * (1 - mix) + moduleLuma * mix;
      }

      const value = target + error[index];
      // 強制セルは閾値判定を通さない。ここが不変条件の実体（FR-006.2）
      const lit = isForced ? moduleLuma : value >= 0.5 ? 1 : 0;
      out[index] = lit === 1 ? 0 : 1;

      let residual = value - lit;
      if (residual > ERROR_CLAMP) residual = ERROR_CLAMP;
      else if (residual < -ERROR_CLAMP) residual = -ERROR_CLAMP;

      diffuse(error, size, x, y, residual, leftToRight);
    }
  }

  return out;
}

/** Floyd–Steinberg。走査方向が右→左のときは係数を左右反転する（SPEC FR-006.4） */
function diffuse(
  error: Float32Array,
  size: number,
  x: number,
  y: number,
  residual: number,
  leftToRight: boolean,
): void {
  if (residual === 0) return;

  const ahead = leftToRight ? 1 : -1;
  const nextRow = y + 1;

  const forward = x + ahead;
  if (forward >= 0 && forward < size) {
    error[y * size + forward] += (residual * 7) / 16;
  }

  if (nextRow >= size) return;
  const base = nextRow * size;

  const behindBelow = x - ahead;
  if (behindBelow >= 0 && behindBelow < size) {
    error[base + behindBelow] += (residual * 3) / 16;
  }

  error[base + x] += (residual * 5) / 16;

  const aheadBelow = x + ahead;
  if (aheadBelow >= 0 && aheadBelow < size) {
    error[base + aheadBelow] += residual / 16;
  }
}

/** 元 QR をサブモジュール解像度へそのまま拡大する（比較表示用） */
export function upscalePlain(matrix: QrMatrix): Uint8Array {
  const moduleCount = matrix.size;
  const size = subGridSize(moduleCount);
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    const moduleRow = ((y / SUB) | 0) * moduleCount;
    const rowOffset = y * size;
    for (let x = 0; x < size; x += 1) {
      out[rowOffset + x] = matrix.bits[moduleRow + ((x / SUB) | 0)];
    }
  }
  return out;
}

/**
 * 中央サブモジュールが元 QR のビットと一致しているかを全数検証する。
 * テストと開発時の自己点検用（SPEC AC-03）。
 */
export function verifyCenterBits(matrix: QrMatrix, grid: Uint8Array): boolean {
  const moduleCount = matrix.size;
  const size = subGridSize(moduleCount);
  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      const y = row * SUB + 1;
      const x = col * SUB + 1;
      if (grid[y * size + x] !== matrix.bits[row * moduleCount + col]) return false;
    }
  }
  return true;
}
