import { describe, expect, it } from 'vitest';
import { computeLogoMask } from './paths';
import { PRESETS } from './presets';
import { analyzeSafety } from './safety';
import { DEFAULT_DESIGN, type QrDesign } from './types';

const MATRIX_SIZE = 41;

function report(design: QrDesign) {
  return analyzeSafety(design, MATRIX_SIZE, computeLogoMask(MATRIX_SIZE, design.logo));
}

describe('shipped design defaults', () => {
  it('opens on a design the safety checker rates as safe', () => {
    expect(report(DEFAULT_DESIGN).level).toBe('safe');
  });

  it.each(PRESETS.filter((preset) => preset.id !== 'neon'))(
    'ships preset "$name" at a safe rating',
    (preset) => {
      const design: QrDesign = { ...DEFAULT_DESIGN, ...preset.appearance };
      const result = report(design);
      expect(
        result.findings.filter((finding) => finding.level !== 'safe' && finding.level !== 'info'),
      ).toEqual([]);
      expect(result.level).toBe('safe');
    },
  );

  it('flags the intentionally inverted preset instead of hiding the trade-off', () => {
    const neon = PRESETS.find((preset) => preset.id === 'neon');
    expect(neon).toBeDefined();
    if (!neon) return;

    const result = report({ ...DEFAULT_DESIGN, ...neon.appearance });
    expect(result.findings.map((finding) => finding.id)).toContain('inverted');
    expect(result.level).toBe('caution');
  });

  it('gives every preset a unique id', () => {
    const ids = PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
