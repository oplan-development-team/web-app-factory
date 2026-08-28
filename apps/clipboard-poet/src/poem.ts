import type { Fragment, Poem, ToggleState } from './types';
import { freshSeed, mulberry32, shuffle } from './prng';

/** Display cap for one pasted fragment on the raw log — "paper feed limit". */
export const RAW_PRINT_LIMIT = 500;

/** Hard safety cap applied to any single composed line, independent of the
 * trim toggle, so a pathological wall-of-text paste can't blow up layout. */
const HARD_LINE_CAP = 260;

const SHORT_MAX = 10;
const MEDIUM_MAX = 36;

type LengthClass = 'short' | 'medium' | 'long';

interface PoolLine {
  text: string;
  cls: LengthClass;
}

export function truncateForPrint(text: string): { printed: string; truncated: boolean } {
  if (text.length <= RAW_PRINT_LIMIT) return { printed: text, truncated: false };
  return { printed: text.slice(0, RAW_PRINT_LIMIT), truncated: true };
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function capLength(text: string): string {
  if (text.length <= HARD_LINE_CAP) return text;
  return `${text.slice(0, HARD_LINE_CAP)}…`;
}

/** Split a fragment's text into line/phrase units on punctuation (。！？.!?)
 * and pre-existing newlines. */
function splitIntoLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines: string[] = [];
  for (const rough of normalized.split('\n')) {
    const parts = rough.split(/(?<=[。！？.!?])/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) lines.push(trimmed);
    }
  }
  return lines;
}

function classify(line: string): LengthClass {
  if (line.length <= SHORT_MAX) return 'short';
  if (line.length <= MEDIUM_MAX) return 'medium';
  return 'long';
}

/** Cut a random contiguous span out of a long line, with an ellipsis marking
 * whatever got clipped — the "cut out from a bigger source" found-text look. */
function excerptLine(line: string, rand: () => number): string {
  const len = line.length;
  const targetLen = Math.max(12, Math.floor(len * (0.35 + rand() * 0.25)));
  if (targetLen >= len) return line;
  const maxStart = len - targetLen;
  const start = Math.floor(rand() * (maxStart + 1));
  const end = start + targetLen;
  const snippet = line.slice(start, end).trim();
  const prefix = start > 0 ? '…' : '';
  const suffix = end < len ? '…' : '';
  return `${prefix}${snippet}${suffix}`;
}

function buildFragmentLines(fragment: Fragment, toggles: ToggleState, rand: () => number): PoolLine[] {
  const rawLines = toggles.lineBreak ? splitIntoLines(fragment.fullText) : [collapseWhitespace(fragment.fullText)];
  const out: PoolLine[] = [];
  for (const raw of rawLines) {
    const capped = capLength(raw);
    if (!capped) continue;
    const cls = classify(capped);
    const text = toggles.trim && cls === 'long' ? excerptLine(capped, rand) : capped;
    if (text) out.push({ text, cls });
  }
  return out;
}

/** Non-shuffled arrangement: each fragment keeps its own line order and
 * becomes its own stanza, in the order it was pasted. */
function composeOrdered(groups: PoolLine[][]): string[] {
  const lines: string[] = [];
  for (const group of groups) {
    if (!group.length) continue;
    if (lines.length) lines.push('');
    for (const l of group) lines.push(l.text);
  }
  return lines;
}

/** Shuffled arrangement: Fisher-Yates the whole pool, then lay it out as
 * short line -> stanza -> blank, reusing one short line as a refrain that
 * opens and closes the poem when at least two short lines exist. */
function composeShuffled(pool: PoolLine[], rand: () => number): string[] {
  const shuffled = shuffle(pool, rand);
  const shorts = shuffled.filter((l) => l.cls === 'short').map((l) => l.text);
  const rest = shuffled.filter((l) => l.cls !== 'short').map((l) => l.text);

  let refrain: string | null = null;
  if (shorts.length >= 2) {
    const idx = Math.floor(rand() * shorts.length);
    refrain = shorts.splice(idx, 1)[0];
  }

  const lines: string[] = [];
  if (refrain) lines.push(refrain);

  let si = 0;
  let ri = 0;
  while (si < shorts.length || ri < rest.length) {
    const stanza: string[] = [];
    if (si < shorts.length) {
      stanza.push(shorts[si]);
      si++;
    }
    const stanzaCount = ri < rest.length ? 1 + Math.floor(rand() * Math.min(3, rest.length - ri)) : 0;
    for (let k = 0; k < stanzaCount; k++) {
      stanza.push(rest[ri]);
      ri++;
    }
    if (stanza.length) {
      lines.push(...stanza);
      lines.push('');
    }
  }
  if (lines[lines.length - 1] === '') lines.pop();
  if (refrain) lines.push('', refrain);
  return lines;
}

let poemCounter = 0;

/** Re-composes the entire fragment pool into a new found poem. Every call
 * uses a fresh random seed, so the same pool + same toggles yields a
 * different poem each time this is pressed — that re-playability is the
 * point, not an incidental side effect. */
export function generatePoem(fragments: Fragment[], toggles: ToggleState): Poem | null {
  const rand = mulberry32(freshSeed());
  const groups = fragments.map((f) => buildFragmentLines(f, toggles, rand));
  const flatPool = groups.flat();
  if (flatPool.length === 0) return null;

  const lines = toggles.shuffle ? composeShuffled(flatPool, rand) : composeOrdered(groups);
  if (lines.length === 0) return null;

  poemCounter += 1;
  return {
    id: poemCounter,
    lines,
    toggles: { ...toggles },
    createdAt: Date.now(),
  };
}

export function resetPoemCounter(): void {
  poemCounter = 0;
}
