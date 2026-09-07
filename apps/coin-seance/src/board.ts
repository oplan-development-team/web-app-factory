import type { Zone } from './types';

export const VIRTUAL_W = 1200;
export const VIRTUAL_H = 780;

// 五十音（を・ん含む 46 文字）。歴史的仮名（ゐ・ゑ）は割愛し、
// 現代の伝統的こっくりさん盤に準じた並びにしている。
const GOJUON = [
  'あ', 'い', 'う', 'え', 'お',
  'か', 'き', 'く', 'け', 'こ',
  'さ', 'し', 'す', 'せ', 'そ',
  'た', 'ち', 'つ', 'て', 'と',
  'な', 'に', 'ぬ', 'ね', 'の',
  'は', 'ひ', 'ふ', 'へ', 'ほ',
  'ま', 'み', 'む', 'め', 'も',
  'や', 'ゆ', 'よ',
  'ら', 'り', 'る', 'れ', 'ろ',
  'わ', 'を',
  'ん',
];

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const TORII_ZONE_ID = 'torii';
export const SAYONARA_ZONE_ID = 'sayonara';

/** 盤面の全ゾーンを仮想座標系（VIRTUAL_W x VIRTUAL_H）上に配置する。 */
export function buildZones(): Zone[] {
  const zones: Zone[] = [];

  // 鳥居（中央上部・玉の待機/帰還位置でもある）
  zones.push({ id: TORII_ZONE_ID, type: 'torii', label: '鳥居', x: VIRTUAL_W / 2, y: 96, radius: 46 });

  // さようなら（鳥居の少し下、五十音の弧の内側）
  zones.push({ id: SAYONARA_ZONE_ID, type: 'sayonara', label: 'さようなら', x: VIRTUAL_W / 2, y: 196, radius: 40 });

  // はい / いいえ（鳥居を挟む形で左右上部）
  zones.push({ id: 'hai', type: 'hai', label: 'はい', x: 150, y: 150, radius: 42 });
  zones.push({ id: 'iie', type: 'iie', label: 'いいえ', x: VIRTUAL_W - 150, y: 150, radius: 42 });

  // 五十音の弧（虹のように上方へ膨らむアーチ状配列）
  // 円の中心をキャンバス下方に置き、上側の弧（頂点270°を通る側）だけを使う。
  // 197°→-17°へ「減少方向」で補間すると弧が円の底(90°=真下)を通って
  // キャンバス外に落ちるため、必ず 270°(真上)を通る増加方向で補間する。
  // 46字を1本の弧に詰めると文字同士が重なるため、奇数インデックスをわずかに
  // 内側へずらすジグザグ配置にして、実質的な文字間隔を稼いでいる。
  const arcCenterX = VIRTUAL_W / 2;
  const arcRadius = 583;
  const arcCenterY = 883;
  const startAngleDeg = 206.8;
  const endAngleDeg = 333.2;
  const zigzagInset = 26;
  const n = GOJUON.length;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const angleDeg = startAngleDeg + (endAngleDeg - startAngleDeg) * t;
    const angle = (angleDeg * Math.PI) / 180;
    const r = arcRadius - (i % 2 === 1 ? zigzagInset : 0);
    const x = arcCenterX + Math.cos(angle) * r;
    const y = arcCenterY + Math.sin(angle) * r;
    zones.push({ id: `kana-${i}`, type: 'kana', label: GOJUON[i]!, x, y, radius: 19 });
  }

  // 数字の列（弧の下、盤面下部）
  const digitY = 640;
  const digitMarginX = 130;
  const digitSpan = VIRTUAL_W - digitMarginX * 2;
  DIGITS.forEach((d, i) => {
    const x = digitMarginX + (digitSpan * i) / (DIGITS.length - 1);
    zones.push({ id: `digit-${d}`, type: 'digit', label: d, x, y: digitY, radius: 26 });
  });

  return zones;
}

/** キャンバスの実サイズに対して、仮想座標系をレターボックスでフィットさせる変換。 */
export class BoardTransform {
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  displayW = 0;
  displayH = 0;

  resize(displayW: number, displayH: number): void {
    this.displayW = displayW;
    this.displayH = displayH;
    this.scale = Math.min(displayW / VIRTUAL_W, displayH / VIRTUAL_H);
    this.offsetX = (displayW - VIRTUAL_W * this.scale) / 2;
    this.offsetY = (displayH - VIRTUAL_H * this.scale) / 2;
  }

  toPixel(vx: number, vy: number): { x: number; y: number } {
    return { x: this.offsetX + vx * this.scale, y: this.offsetY + vy * this.scale };
  }

  toVirtual(px: number, py: number): { x: number; y: number } {
    return { x: (px - this.offsetX) / this.scale, y: (py - this.offsetY) / this.scale };
  }

  /** 現在のスケールにおける、指定した仮想半径の画面上の直径(px) */
  onScreenDiameter(virtualRadius: number): number {
    return virtualRadius * 2 * this.scale;
  }
}

export function findZoneById(zones: Zone[], id: string): Zone | undefined {
  return zones.find((z) => z.id === id);
}
