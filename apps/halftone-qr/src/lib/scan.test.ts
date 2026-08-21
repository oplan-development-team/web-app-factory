import { describe, expect, it } from 'vitest';
import {
  SCAN_BLURS,
  SCAN_CONDITIONS,
  SCAN_SCALES,
  adviceFor,
  buildReport,
  gradeFor,
  type ScanTrial,
} from './scan';

function trials(okCount: number, total = 9): ScanTrial[] {
  return Array.from({ length: total }, (_, i) => ({
    scale: 2,
    blur: 0,
    ok: i < okCount,
  }));
}

describe('SCAN_CONDITIONS', () => {
  it('is the full cross product of scales and blurs', () => {
    expect(SCAN_CONDITIONS).toHaveLength(SCAN_SCALES.length * SCAN_BLURS.length);
    expect(SCAN_CONDITIONS).toHaveLength(9);
  });

  it('contains each scale/blur pair exactly once', () => {
    const keys = SCAN_CONDITIONS.map((c) => `${c.scale}:${c.blur}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('gradeFor', () => {
  it('grades a clean sweep as good', () => {
    expect(gradeFor(9, 9)).toBe('good');
  });

  it('grades two thirds or better as fair', () => {
    expect(gradeFor(8, 9)).toBe('fair');
    expect(gradeFor(6, 9)).toBe('fair');
  });

  it('grades a partial pass as unstable', () => {
    expect(gradeFor(5, 9)).toBe('unstable');
    expect(gradeFor(1, 9)).toBe('unstable');
  });

  it('grades a total miss as fail', () => {
    expect(gradeFor(0, 9)).toBe('fail');
  });

  it('treats an empty trial set as fail rather than good', () => {
    expect(gradeFor(0, 0)).toBe('fail');
  });
});

describe('buildReport', () => {
  it('counts passes and derives the grade', () => {
    const report = buildReport(trials(7));
    expect(report.passed).toBe(7);
    expect(report.total).toBe(9);
    expect(report.grade).toBe('fair');
  });

  it('reports a perfect run as good', () => {
    expect(buildReport(trials(9)).grade).toBe('good');
  });
});

describe('adviceFor', () => {
  const base = { qrness: 0.35, protect: 'patterns' as const, contrast: 0 };

  it('offers nothing when the result is already good', () => {
    expect(adviceFor({ ...base, grade: 'good' })).toEqual([]);
  });

  it('suggests raising qrness when there is room', () => {
    const advice = adviceFor({ ...base, grade: 'unstable' });
    expect(advice.join('')).toContain('QR らしさ');
  });

  it('stops suggesting qrness once it is already at the top', () => {
    const advice = adviceFor({ ...base, grade: 'unstable', qrness: 1 });
    expect(advice.join('')).not.toContain('QR らしさ');
  });

  it('stops suggesting protection once it is at maximum', () => {
    const advice = adviceFor({ ...base, grade: 'fail', protect: 'all' });
    expect(advice.join('')).not.toContain('保護');
  });

  it('suggests lowering contrast only when it was raised', () => {
    expect(adviceFor({ ...base, grade: 'unstable', contrast: 40 }).join('')).toContain(
      'コントラスト',
    );
    expect(adviceFor({ ...base, grade: 'unstable', contrast: -40 }).join('')).not.toContain(
      'コントラスト',
    );
  });

  it('always produces at least one suggestion for a failing result', () => {
    expect(adviceFor({ ...base, grade: 'fail' }).length).toBeGreaterThan(0);
  });
});
