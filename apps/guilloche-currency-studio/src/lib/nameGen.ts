import type { Rng } from './prng.ts';

// Procedural pseudo-word generation for "plausible-looking" fictional country
// and portrait-motif names. Entirely self-contained (no wordlists fetched
// from anywhere) — small curated syllable pools recombined via the seeded
// PRNG so the same seed always yields the same name.

const ONSETS = [
  'B', 'Br', 'C', 'Ch', 'D', 'Dr', 'F', 'G', 'Gr', 'H', 'J', 'K', 'Kr', 'L',
  'M', 'N', 'P', 'Pr', 'R', 'S', 'Sh', 'St', 'T', 'Th', 'Tr', 'V', 'Vel', 'Z',
];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'ai', 'au', 'ei', 'io'];
const MEDIALS = ['r', 'l', 'n', 'm', 'nd', 'rd', 'ss', 'th', 'v', 'z', 'sk'];
const CODAS = ['a', 'e', 'ia', 'o', 'on', 'an', 'ar', 'us', 'is', 'ora', 'ande'];

const COUNTRY_SUFFIXES = ['', '', '', ' Republic', ' Federation', ' Union', ' Commonwealth'];

function syllable(rng: Rng, capital: boolean): string {
  const onset = rng.pick(ONSETS);
  const vowel = rng.pick(VOWELS);
  const s = onset + vowel;
  return capital ? s : s.toLowerCase();
}

/** A pseudo place-name, e.g. "Velmorandia", "Sorenthal". */
export function proceduralCountryName(rng: Rng): string {
  const syllables = rng.int(2, 3);
  let name = syllable(rng, true);
  for (let i = 1; i < syllables; i++) {
    name += (rng.chance(0.4) ? rng.pick(MEDIALS) : '') + syllable(rng, false);
  }
  if (rng.chance(0.5)) name += rng.pick(CODAS);
  name = name.charAt(0).toUpperCase() + name.slice(1);
  if (rng.chance(0.3)) name += rng.pick(COUNTRY_SUFFIXES);
  return name;
}

/** A pseudo full name for the "portrait motif" seed field's placeholder. */
export function proceduralPersonName(rng: Rng): string {
  const first = syllable(rng, true) + syllable(rng, false) + (rng.chance(0.5) ? rng.pick(CODAS) : '');
  const last = syllable(rng, true) + rng.pick(MEDIALS) + syllable(rng, false);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${cap(first)} ${cap(last)}`;
}

const CURRENCY_WORDS = [
  'Solari', 'Drenn', 'Korav', 'Marka', 'Escudo', 'Talent', 'Riven', 'Ducat',
  'Crown', 'Averil', 'Lyre', 'Denar', 'Florin', 'Kestrel', 'Obol', 'Sela',
  'Thaler', 'Vantor', 'Orin', 'Ceris', 'Marlow', 'Palude', 'Insigne', 'Verdan',
];

/** A pseudo currency-unit word, e.g. "Solari", "Kestrel". */
export function proceduralCurrencyName(rng: Rng): string {
  return rng.pick(CURRENCY_WORDS);
}
