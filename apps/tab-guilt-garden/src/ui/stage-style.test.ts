import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { Stage } from '../domain/types';

// The stylesheet is split by concern, so read the whole set rather than one file.
const stylesDir = join(__dirname, '..', 'styles');
const css = readdirSync(stylesDir)
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(join(stylesDir, f), 'utf8'))
  .join('\n');

function token(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m?.[1]) throw new Error(`token --${name} not found in style.css`);
  return m[1];
}

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const parts = [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = parts.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * "I wrote a border" and "a border is visible" are different claims. These
 * guard the second one, so a later palette tweak cannot silently wash a stage
 * out without a test failing.
 */
describe('stage palette contrast (FR-601 / AC-600b)', () => {
  const paper2 = () => token('paper-2');
  const cream = () => token('cream');
  const ink = () => token('ink');

  test.each<[Stage, string, () => string]>([
    ['leaf', 'green', paper2],
    ['bloom', 'green-deep', paper2],
    ['wilt', 'mustard-deep', paper2],
    ['dead', 'gray-dead', () => token('paper-3')],
    ['husk', 'gray-husk', () => token('paper-3')],
    ['fossil', 'stone-fossil', cream],
  ])('%s silhouette is distinguishable from its card', (_stage, fill, bg) => {
    expect(contrastRatio(token(fill), bg())).toBeGreaterThanOrEqual(3);
  });

  test('stage badge text stays legible on every late-decay badge', () => {
    expect(contrastRatio(cream(), token('gray-dead'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(cream(), token('gray-husk'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink(), token('stone-fossil'))).toBeGreaterThanOrEqual(4.5);
  });

  test('late-decay card borders remain visible against the page', () => {
    const page = token('paper');
    for (const t of ['gray-dead', 'gray-husk', 'stone-fossil']) {
      expect(contrastRatio(token(t), page)).toBeGreaterThanOrEqual(1.5);
    }
  });

  test('husk and fossil each get their own card treatment, distinct from dead', () => {
    // Without this, the two new stages would look identical to 枯死 and the
    // long-neglect payoff would be invisible.
    for (const stage of ['husk', 'fossil']) {
      expect(css).toContain(`.plant-card[data-stage='${stage}']`);
    }
    expect(css).toMatch(/\.plant-card\[data-stage='fossil'\][\s\S]*?background: var\(--cream\)/);
  });

  test('every stage has a body fill rule so none falls back to an unstyled colour', () => {
    const stages: Stage[] = ['sprout', 'leaf', 'bloom', 'wilt', 'dead', 'husk', 'fossil'];
    for (const s of stages) {
      expect(css).toContain(`data-stage='${s}'`);
    }
  });
});

describe('motion preferences (FR-602)', () => {
  test('honours prefers-reduced-motion', () => {
    expect(css).toContain('prefers-reduced-motion');
  });
});

describe('stylesheet organisation', () => {
  test('no partial grows past the project file-size limit', () => {
    for (const f of readdirSync(stylesDir).filter((x) => x.endsWith('.css'))) {
      const lines = readFileSync(join(stylesDir, f), 'utf8').split('\n').length;
      expect(lines, `${f} is ${lines} lines`).toBeLessThan(800);
    }
  });

  test('web fonts are not double-loaded via CSS @import', () => {
    // index.html already <link>s the Google Fonts stylesheet; importing it here
    // as well would add a second, later-starting render-blocking request.
    expect(css).not.toContain('@import url(');
  });
});
