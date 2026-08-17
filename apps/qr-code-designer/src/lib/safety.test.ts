import { describe, expect, it } from 'vitest';
import { computeLogoMask } from './paths';
import { analyzeSafety } from './safety';
import { DEFAULT_DESIGN, type LogoConfig, type QrDesign } from './types';

const MATRIX_SIZE = 41;

const design = (patch: Partial<QrDesign> = {}): QrDesign => ({
  ...DEFAULT_DESIGN,
  bodyPaint: { kind: 'solid', color: '#000000' },
  background: { kind: 'solid', color: '#ffffff' },
  ...patch,
});

const analyze = (patch: Partial<QrDesign> = {}) => {
  const d = design(patch);
  return analyzeSafety(d, MATRIX_SIZE, computeLogoMask(MATRIX_SIZE, d.logo));
};

const findingIds = (patch: Partial<QrDesign> = {}) =>
  analyze(patch).findings.map((finding) => finding.id);

const levelOf = (id: string, patch: Partial<QrDesign> = {}) =>
  analyze(patch).findings.find((finding) => finding.id === id)?.level;

const logo = (over: Partial<LogoConfig> = {}): LogoConfig => ({
  dataUrl: 'data:image/png;base64,AA',
  name: 'logo.png',
  sizeRatio: 0.2,
  padding: 1,
  frame: 'rounded',
  ...over,
});

describe('analyzeSafety', () => {
  it('passes a plain black-on-white code', () => {
    const report = analyze({ eyeInherit: true });
    expect(report.level).toBe('safe');
    expect(report.contrast).toBeCloseTo(21, 1);
  });

  it('always reports contrast and quiet zone', () => {
    expect(findingIds()).toEqual(expect.arrayContaining(['contrast', 'quiet-zone']));
  });

  it('flags a zero quiet zone as a risk', () => {
    expect(levelOf('quiet-zone', { margin: 0 })).toBe('risk');
    expect(analyze({ margin: 0 }).level).toBe('risk');
  });

  it('flags a narrow quiet zone as a caution', () => {
    expect(levelOf('quiet-zone', { margin: 2 })).toBe('caution');
  });

  it('flags low contrast as a risk', () => {
    expect(levelOf('contrast', { bodyPaint: { kind: 'solid', color: '#999999' } })).toBe('risk');
  });

  it('flags middling contrast as a caution', () => {
    expect(levelOf('contrast', { bodyPaint: { kind: 'solid', color: '#8a8a8a' } })).toBe('caution');
  });

  it('includes the finder patterns in the contrast check', () => {
    // The body is pure black; only the finder centre is washed out.
    const report = analyze({
      eyeInherit: false,
      eyeBallPaint: { kind: 'solid', color: '#cccccc' },
    });
    const contrast = report.findings.find((f) => f.id === 'contrast');
    expect(contrast?.level).toBe('risk');
    expect(contrast?.title).toContain('ファインダー中央');
  });

  it('ignores the finder paints while they inherit the body colour', () => {
    expect(
      levelOf('contrast', {
        eyeInherit: true,
        eyeBallPaint: { kind: 'solid', color: '#cccccc' },
      }),
    ).toBe('safe');
  });

  it('reports the weakest gradient stop, not the average', () => {
    const report = analyze({
      bodyPaint: { kind: 'linear', from: '#000000', to: '#cccccc', angle: 0 },
    });
    expect(report.contrast).toBeLessThan(2);
  });

  it('warns when the code is inverted', () => {
    const ids = findingIds({
      bodyPaint: { kind: 'solid', color: '#ffffff' },
      background: { kind: 'solid', color: '#101010' },
    });
    expect(ids).toContain('inverted');
  });

  it('does not warn about inversion for a normal code', () => {
    expect(findingIds()).not.toContain('inverted');
  });

  it('notes a transparent background without downgrading the verdict', () => {
    const report = analyze({ background: null });
    expect(report.findings.map((f) => f.id)).toContain('transparent');
    expect(report.level).toBe('safe');
  });

  it('only checks logo coverage when a logo is present', () => {
    expect(findingIds()).not.toContain('logo-coverage');
    expect(findingIds({ logo: logo(), ecc: 'H' })).toContain('logo-coverage');
  });

  it('accepts a modest logo at level H', () => {
    expect(levelOf('logo-coverage', { logo: logo({ sizeRatio: 0.15 }), ecc: 'H' })).toBe('safe');
  });

  it('rejects an oversized logo at level L', () => {
    expect(levelOf('logo-coverage', { logo: logo({ sizeRatio: 0.32, padding: 3 }), ecc: 'L' })).toBe(
      'risk',
    );
  });

  it('reports higher coverage for a bigger logo', () => {
    const small = analyze({ logo: logo({ sizeRatio: 0.1 }), ecc: 'H' }).logoCoverage;
    const large = analyze({ logo: logo({ sizeRatio: 0.32 }), ecc: 'H' }).logoCoverage;
    expect(large).toBeGreaterThan(small);
  });

  it('cautions about round dots only at the lowest correction level', () => {
    expect(levelOf('dot-style', { dotStyle: 'dot', ecc: 'L' })).toBe('caution');
    expect(levelOf('dot-style', { dotStyle: 'dot', ecc: 'M' })).toBe('info');
    expect(findingIds({ dotStyle: 'dot', ecc: 'Q' })).not.toContain('dot-style');
    expect(findingIds({ dotStyle: 'square', ecc: 'L' })).not.toContain('dot-style');
  });

  it('keeps the verdict safe when round dots only produce an informational note', () => {
    expect(analyze({ dotStyle: 'dot', ecc: 'M', eyeInherit: true }).level).toBe('safe');
  });

  it('takes the worst finding as the overall verdict', () => {
    const report = analyze({ margin: 0, bodyPaint: { kind: 'solid', color: '#999999' } });
    expect(report.level).toBe('risk');
  });
});
