import { hashString, mixSeeds, mulberry32 } from './prng';

export interface LinePricing {
  text: string;
  price: number;
  isSale: boolean;
  originalPrice?: number;
}

/** 実在の値付けらしい端数（下2桁）候補。 */
const NICE_ENDINGS = [0, 8, 18, 28, 38, 48, 58, 78, 80, 88, 90, 98];

function snapToNiceEnding(raw: number): number {
  const hundred = Math.floor(raw / 100) * 100;
  const remainder = raw % 100;
  let closest = NICE_ENDINGS[0];
  let bestDiff = Infinity;
  for (const ending of NICE_ENDINGS) {
    const diff = Math.abs(ending - remainder);
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = ending;
    }
  }
  const price = hundred + closest;
  return price > 0 ? price : 8;
}

/** テキストの文字多様性から、価格帯の傾きを決める「複雑さ」係数（0〜1）。 */
function complexityOf(text: string): number {
  const chars = Array.from(text);
  const uniqueChars = new Set(chars).size;
  return Math.min(1, uniqueChars / Math.max(4, chars.length));
}

function pickTier(rnd: () => number, complexity: number): [number, number] {
  const roll = rnd();
  const lowBoundary = 0.42 - complexity * 0.12;
  const midBoundary = 0.82 - complexity * 0.08;
  if (roll < lowBoundary) return [80, 480];
  if (roll < midBoundary) return [480, 1980];
  return [1280, 4980];
}

/**
 * 1行のテキストから「それっぽい」値段を決定的に算出する。
 * globalSeed が同じであれば、同じテキストには常に同じ値段が付く。
 * globalSeed を変える（＝引き直す）と全体がシャッフルされる。
 */
export function priceForLine(text: string, globalSeed: number): LinePricing {
  const textHash = hashString(text);
  const seed = mixSeeds(textHash, globalSeed);
  const rnd = mulberry32(seed);

  const complexity = complexityOf(text);
  const [min, max] = pickTier(rnd, complexity);
  const raw = min + rnd() * (max - min);
  const price = snapToNiceEnding(Math.round(raw));

  // およそ6行に1行くらいの確率で「本日の特売」演出を混ぜる。
  const saleRoll = rnd();
  const isSale = saleRoll < 0.16;
  if (isSale) {
    const markup = 1.15 + rnd() * 0.35;
    const original = snapToNiceEnding(Math.round(price * markup));
    return {
      text,
      price,
      isSale: true,
      originalPrice: Math.max(original, price + 10),
    };
  }

  return { text, price, isSale: false };
}

export function priceLines(lines: string[], globalSeed: number): LinePricing[] {
  return lines.map((text) => priceForLine(text, globalSeed));
}

export function totalOf(pricedLines: LinePricing[]): number {
  return pricedLines.reduce((sum, line) => sum + line.price, 0);
}

export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}
