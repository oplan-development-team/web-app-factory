import { mixSeeds, mulberry32 } from './prng';
import { LinePricing, priceLines, totalOf } from './pricing';
import { TOTAL_LABELS, RECEIPT_FOOTERS } from './labels';
import { formatTimestamp, receiptNumber } from './barcode';

/** 貼り付けテキストが極端に長い場合の安全上限。壊れて見えるのを防ぐための保険。 */
const MAX_LINES = 120;

const LABEL_SALT = 0x5eed_1abe;
const FOOTER_SALT = 0xf00d_babe;
const BARCODE_SALT = 0xba4c_0de5;

export interface ReceiptData {
  storeName: string;
  lines: LinePricing[];
  total: number;
  totalLabel: string;
  footer: string;
  barcodeSeed: number;
  receiptNo: string;
  timestamp: string;
}

export function parseLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_LINES);
}

function pickFrom<T>(pool: T[], seed: number): T {
  const rnd = mulberry32(seed);
  const index = Math.floor(rnd() * pool.length) % pool.length;
  return pool[index];
}

export function deriveReceipt(
  rawText: string,
  storeName: string,
  seed: number,
): ReceiptData | null {
  const lines = parseLines(rawText);
  if (lines.length === 0) return null;

  const pricedLines = priceLines(lines, seed);
  const total = totalOf(pricedLines);
  const totalLabel = pickFrom(TOTAL_LABELS, mixSeeds(seed, LABEL_SALT));
  const footer = pickFrom(RECEIPT_FOOTERS, mixSeeds(seed, FOOTER_SALT));
  const barcodeSeed = mixSeeds(seed, BARCODE_SALT);
  const receiptNo = receiptNumber(barcodeSeed);
  const timestamp = formatTimestamp(new Date());

  return {
    storeName: storeName.trim() || '無名の店',
    lines: pricedLines,
    total,
    totalLabel,
    footer,
    barcodeSeed,
    receiptNo,
    timestamp,
  };
}
