import { seededRng } from './prng.ts';

export type ScriptMode = 'EN' | 'JA';

export interface BanknoteState {
  country: string;
  currency: string;
  year: string;
  portraitSeed: string;
  denomination: number;
  script: ScriptMode;
}

const EN_NUMERAL_WORDS: Record<number, string> = {
  1: 'One',
  5: 'Five',
  10: 'Ten',
  20: 'Twenty',
  50: 'Fifty',
  100: 'One Hundred',
  500: 'Five Hundred',
  1000: 'One Thousand',
};

// Traditional daiji-style formal numerals, as used on engraved certificates
// and old banknotes, for a simple (non-exhaustive) JA template.
const JA_NUMERAL_WORDS: Record<number, string> = {
  1: '壱',
  5: '伍',
  10: '拾',
  20: '弐拾',
  50: '伍拾',
  100: '百',
  500: '伍百',
  1000: '千',
};

export function denominationWords(denomination: number, script: ScriptMode): string {
  const table = script === 'JA' ? JA_NUMERAL_WORDS : EN_NUMERAL_WORDS;
  return table[denomination] ?? String(denomination);
}

export function denominationSpelledText(state: BanknoteState): string {
  const words = denominationWords(state.denomination, state.script);
  const currency = state.currency.trim() || (state.script === 'JA' ? '通貨' : 'Currency');
  return state.script === 'JA' ? `${words} ${currency}` : `${words} ${currency}`;
}

export function issuingBankName(state: BanknoteState): string {
  const country = state.country.trim() || (state.script === 'JA' ? '無名国' : 'Nowhere');
  return state.script === 'JA'
    ? `${country}中央銀行`
    : `THE CENTRAL BANK OF ${country.toUpperCase()}`;
}

/** Deterministic 2-letter + 7-digit serial, styled like a plate/sheet serial. */
export function serialNumber(state: BanknoteState): string {
  const rng = seededRng(
    `${state.country}|${state.currency}|${state.denomination}|${state.portraitSeed}|${state.year}`,
    'serial'
  );
  const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // omit I/O to avoid digit confusion
  const l1 = LETTERS[rng.int(0, LETTERS.length - 1)];
  const l2 = LETTERS[rng.int(0, LETTERS.length - 1)];
  let digits = '';
  for (let i = 0; i < 7; i++) digits += String(rng.int(0, 9));
  return `${l1}${l2} ${digits}`;
}

export function randomPlausibleYear(rng: { int: (a: number, b: number) => number }): string {
  return String(rng.int(1911, 2087));
}
