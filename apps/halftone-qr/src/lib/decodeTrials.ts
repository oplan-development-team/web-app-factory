import { gridToLuminance, type LuminanceImage } from './render';
import { SCAN_CONDITIONS, type ScanRequest, type ScanTrial } from './scan';

/**
 * 生成物を実際にデコードして読み取り可能性を判定する中身（SPEC FR-008）。
 *
 * Worker とは分離してある。`self` に触れないので Node 上のテストから
 * そのまま呼べて、パイプライン全体（QR → ハーフトーン → デコード）を
 * 通しで検証できる。
 *
 * 判定器に ZXing を使う理由: jsQR は判定器として信用できない。過去に
 * 「解像度を上げるほどデコード率が下がる」という、実スキャン特性としては
 * あり得ない逆転挙動を示した実績がある。
 */

type ZXing = typeof import('@zxing/library');

let zxingPromise: Promise<ZXing> | null = null;

/**
 * ZXing は動的 import する。初期バンドルに含めると読み込みが重くなるうえ、
 * 判定は画像が入るまで一度も走らない（SPEC NFR-003.1）。
 */
export function loadZXing(): Promise<ZXing> {
  zxingPromise ??= import('@zxing/library');
  return zxingPromise;
}

/** 最近傍で整数倍に拡大する。カメラが各サブモジュールを scale px で捉えた状態 */
export function upscale(image: LuminanceImage, scale: number): LuminanceImage {
  if (scale <= 1) return image;
  const size = image.size * scale;
  const data = new Uint8ClampedArray(size * size);
  for (let y = 0; y < size; y += 1) {
    const sourceRow = ((y / scale) | 0) * image.size;
    const targetRow = y * size;
    for (let x = 0; x < size; x += 1) {
      data[targetRow + x] = image.data[sourceRow + ((x / scale) | 0)];
    }
  }
  return { data, size };
}

/** 分離型の箱ぼかし 1 パス。端は最近傍でクランプする */
function boxBlurPass(
  data: Uint8ClampedArray,
  size: number,
  radius: number,
): Uint8ClampedArray {
  const window = radius * 2 + 1;
  const horizontal = new Uint8ClampedArray(data.length);

  for (let y = 0; y < size; y += 1) {
    const row = y * size;
    for (let x = 0; x < size; x += 1) {
      let sum = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        const sx = Math.min(size - 1, Math.max(0, x + offset));
        sum += data[row + sx];
      }
      horizontal[row + x] = sum / window;
    }
  }

  const vertical = new Uint8ClampedArray(data.length);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let sum = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        const sy = Math.min(size - 1, Math.max(0, y + offset));
        sum += horizontal[sy * size + x];
      }
      vertical[y * size + x] = sum / window;
    }
  }

  return vertical;
}

/** 箱ぼかしを 2 回掛けてガウシアンを近似する（レンズのボケに近い形になる） */
export function blur(image: LuminanceImage, radius: number): LuminanceImage {
  if (radius <= 0) return image;
  const once = boxBlurPass(image.data, image.size, radius);
  return { data: boxBlurPass(once, image.size, radius), size: image.size };
}

/** 1 条件ぶんのデコードを試みる。成功かつ内容一致のときだけ true */
export async function decodeOnce(image: LuminanceImage, expected: string): Promise<boolean> {
  const { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } = await loadZXing();
  const reader = new QRCodeReader();
  try {
    const source = new RGBLuminanceSource(image.data, image.size, image.size);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    // TRY_HARDER は付けない。実機より甘い判定になると「良好」と出したものが
    // 現場で読めない事故につながるため、判定は保守側に倒しておく。
    return reader.decode(bitmap).getText() === expected;
  } catch {
    return false;
  } finally {
    reader.reset();
  }
}

export async function runTrials(request: ScanRequest): Promise<ScanTrial[]> {
  const base = gridToLuminance(request.grid, request.moduleCount);
  const expected = request.text.trim();
  const trials: ScanTrial[] = [];

  for (const condition of SCAN_CONDITIONS) {
    const rendered = blur(upscale(base, condition.scale), condition.blur);
    trials.push({ ...condition, ok: await decodeOnce(rendered, expected) });
  }

  return trials;
}
