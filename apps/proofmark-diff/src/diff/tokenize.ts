import type { Token, TokenizeMode } from './types';

type CharClass = 'alnum' | 'space' | 'cjk' | 'other';

const ALNUM_RE = /[A-Za-z0-9]/;
const SPACE_RE = /\s/;
// Hiragana, Katakana, CJK Unified Ideographs, and common Japanese punctuation ranges.
const CJK_RE =
  /[぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;

function classify(char: string): CharClass {
  if (ALNUM_RE.test(char)) return 'alnum';
  if (SPACE_RE.test(char)) return 'space';
  if (CJK_RE.test(char)) return 'cjk';
  return 'other';
}

/**
 * Tokenizes raw text into diff-comparable units.
 *
 * - 'char' mode: one token per character, except that runs of half-width
 *   alphanumerics are merged into a single token (so "2026" or "Vite" diff
 *   as one unit instead of digit-by-digit).
 * - 'word' mode: consecutive characters of the same class (alnum / space /
 *   CJK) are merged into a single token; punctuation and symbols stay
 *   single-character so sentence-level punctuation changes are still visible.
 */
export function tokenize(text: string, mode: TokenizeMode): Token[] {
  const chars = Array.from(text);
  const tokens: Token[] = [];
  let buffer = '';
  let bufferClass: CharClass | null = null;

  const mergeableClasses: CharClass[] =
    mode === 'char' ? ['alnum'] : ['alnum', 'space', 'cjk'];

  const flush = () => {
    if (buffer.length > 0) {
      tokens.push({ text: buffer });
      buffer = '';
      bufferClass = null;
    }
  };

  for (const ch of chars) {
    const cls = classify(ch);
    if (mergeableClasses.includes(cls) && cls === bufferClass) {
      buffer += ch;
      continue;
    }
    flush();
    if (mergeableClasses.includes(cls)) {
      buffer = ch;
      bufferClass = cls;
    } else {
      tokens.push({ text: ch });
    }
  }
  flush();
  return tokens;
}
