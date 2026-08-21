import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COLORS, FONTS, tokenDeclarations } from './tokens';

const tokensCss = readFileSync(
  fileURLToPath(new URL('../styles/tokens.css', import.meta.url)),
  'utf8',
);

function cssValue(name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(tokensCss)?.[1]?.trim();
}

describe('token declarations', () => {
  it('emits every colour and font as a custom property', () => {
    const css = tokenDeclarations();

    expect(css).toContain(`--paper: ${COLORS.paper};`);
    expect(css).toContain(`--ink: ${COLORS.ink};`);
    expect(css).toContain(`--red: ${COLORS.red};`);
    expect(css).toContain(`--font-mono: ${FONTS.mono};`);
  });
});

// The app chrome reads its tokens from a stylesheet while the poster SVG and
// the PNG rasterizer read them from TypeScript. If the two drift, an exported
// print picks up a hairline of the wrong paper colour along its edge -- a
// defect that is nearly invisible on screen. Pin them together here.
describe('stylesheet / TypeScript token parity', () => {
  it.each([
    ['paper', COLORS.paper],
    ['paper-raised', COLORS.paperRaised],
    ['ink', COLORS.ink],
    ['ink-mid', COLORS.inkMid],
    ['ink-faint', COLORS.inkFaint],
    ['red', COLORS.red],
  ])('--%s matches COLORS', (name, expected) => {
    expect(cssValue(name)).toBe(expected);
  });

  it.each([
    ['font-sans', FONTS.sans],
    ['font-mono', FONTS.mono],
  ])('--%s matches FONTS', (name, expected) => {
    expect(cssValue(name)).toBe(expected);
  });
});
