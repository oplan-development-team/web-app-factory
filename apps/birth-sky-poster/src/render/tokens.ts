/**
 * The poster's colour system, defined once in TypeScript.
 *
 * These same values are needed in three places that cannot share a CSS
 * variable: the app stylesheet, the <style> block embedded inside the poster
 * SVG, and the flat fill the PNG rasterizer paints under the artwork. Keeping
 * a single source here prevents the three from drifting apart -- a drift that
 * would show up as a hairline of the wrong paper colour along the edge of an
 * exported print.
 */
export const COLORS = {
  /** Paper ground. */
  paper: '#f1efe7',
  /** Raised paper, used for insets in the app chrome. */
  paperRaised: '#e8e4d8',
  /** Primary ink. */
  ink: '#17160f',
  /** Secondary ink, for labels and annotations. */
  inkMid: '#58564a',
  /** Hairline ink, for faint rules and altitude rings. */
  inkFaint: '#c1bdaf',
  /**
   * The single accent. Reserved for functional roles only -- horizon circle,
   * north needle, primary action, focus, error -- never decoration.
   */
  red: '#bd2a26',
} as const;

export const FONTS = {
  sans: "'Inter Variable', 'Helvetica Neue', Arial, sans-serif",
  mono: "'JetBrains Mono Variable', 'Roboto Mono', ui-monospace, Menlo, Consolas, monospace",
} as const;

/** Emits the shared tokens as CSS custom property declarations. */
export function tokenDeclarations(): string {
  return [
    `--paper: ${COLORS.paper};`,
    `--paper-raised: ${COLORS.paperRaised};`,
    `--ink: ${COLORS.ink};`,
    `--ink-mid: ${COLORS.inkMid};`,
    `--ink-faint: ${COLORS.inkFaint};`,
    `--red: ${COLORS.red};`,
    `--font-sans: ${FONTS.sans};`,
    `--font-mono: ${FONTS.mono};`,
  ].join('\n  ');
}
