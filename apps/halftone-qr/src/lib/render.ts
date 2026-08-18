import { QUIET_MODULES, SUB } from './types';

/** クワイエットゾーンをサブモジュール単位に換算した幅（SPEC FR-009.4） */
export const QUIET_SUB = QUIET_MODULES * SUB;

/** クワイエットゾーンを含む出力の 1 辺（サブモジュール単位） */
export function outputSubSize(moduleCount: number): number {
  return moduleCount * SUB + QUIET_SUB * 2;
}

export interface LuminanceImage {
  /** 1 ピクセル 1 バイト。255 = 白, 0 = 黒 */
  data: Uint8ClampedArray;
  size: number;
}

/**
 * サブモジュールグリッドへクワイエットゾーンを足し、輝度バッファへ展開する。
 *
 * canvas を経由しないので Worker からもそのまま呼べる。ZXing の
 * RGBLuminanceSource は Uint8ClampedArray を輝度として直接受け取るため、
 * この形がそのまま判定器の入力になる。
 */
export function gridToLuminance(grid: Uint8Array, moduleCount: number): LuminanceImage {
  const inner = moduleCount * SUB;
  const size = outputSubSize(moduleCount);
  const data = new Uint8ClampedArray(size * size);
  data.fill(255);

  for (let y = 0; y < inner; y += 1) {
    const sourceRow = y * inner;
    const targetRow = (y + QUIET_SUB) * size + QUIET_SUB;
    for (let x = 0; x < inner; x += 1) {
      if (grid[sourceRow + x] === 1) data[targetRow + x] = 0;
    }
  }

  return { data, size };
}

/** 輝度バッファを RGBA へ広げる（ImageData 用） */
export function luminanceToRgba(image: LuminanceImage): Uint8ClampedArray {
  const { data } = image;
  const rgba = new Uint8ClampedArray(data.length * 4);
  for (let i = 0; i < data.length; i += 1) {
    const value = data[i];
    const offset = i * 4;
    rgba[offset] = value;
    rgba[offset + 1] = value;
    rgba[offset + 2] = value;
    rgba[offset + 3] = 255;
  }
  return rgba;
}

/**
 * 目標の表示ピクセル数に収まる整数倍率を選ぶ。
 * 整数倍でないとサブモジュールの幅が不揃いになり、網点が汚く見える。
 */
export function pxPerSubFor(moduleCount: number, targetPx: number): number {
  return Math.max(1, Math.floor(targetPx / outputSubSize(moduleCount)));
}

/**
 * グリッドを canvas へ描く。
 *
 * 等倍の ImageData を一度だけ作り、それを整数倍で拡大する。
 * サブモジュールごとに fillRect を呼ぶと 3N x 3N 回の描画命令になり、
 * スライダー操作に追従できない。
 */
export function drawGrid(
  canvas: HTMLCanvasElement,
  grid: Uint8Array,
  moduleCount: number,
  pxPerSub: number,
): void {
  const image = gridToLuminance(grid, moduleCount);
  const scale = Math.max(1, Math.floor(pxPerSub));
  const edge = image.size * scale;

  canvas.width = edge;
  canvas.height = edge;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D コンテキストを取得できませんでした');

  const stage = document.createElement('canvas');
  stage.width = image.size;
  stage.height = image.size;
  const stageContext = stage.getContext('2d');
  if (!stageContext) throw new Error('2D コンテキストを取得できませんでした');

  // ImageData のコンストラクタは TypedArray のバッファ型に厳しいので、
  // createImageData で器を作ってから中身を流し込む
  const buffer = stageContext.createImageData(image.size, image.size);
  buffer.data.set(luminanceToRgba(image));
  stageContext.putImageData(buffer, 0, 0);

  context.imageSmoothingEnabled = false;
  context.drawImage(stage, 0, 0, edge, edge);
}
