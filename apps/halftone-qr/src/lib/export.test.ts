import { describe, expect, it } from 'vitest';
import {
  availablePresets,
  exportFileName,
  formatDimensions,
  isPresetAvailable,
  outputPixels,
  presetPixels,
  resolvePreset,
} from './export';
import { outputSubSize } from './render';
import { EXPORT_PRESETS, MAX_EXPORT_PX } from './types';

describe('outputPixels', () => {
  it('multiplies the quiet-zone-inclusive size by the scale', () => {
    expect(outputPixels(21, 6)).toBe(outputSubSize(21) * 6);
    expect(outputPixels(45, 12)).toBe(outputSubSize(45) * 12);
  });

  it('matches the preset table', () => {
    expect(presetPixels(21, 'standard')).toBe(outputSubSize(21) * 6);
    expect(presetPixels(21, 'high')).toBe(outputSubSize(21) * 12);
    expect(presetPixels(21, 'print')).toBe(outputSubSize(21) * 24);
  });

  it('produces a print-usable size for a typical URL symbol', () => {
    // 型番 6 (N=41) で印刷用 24px/sub なら 3000px 超になる
    expect(presetPixels(41, 'print')).toBeGreaterThan(3000);
  });
});

describe('isPresetAvailable', () => {
  it('allows every preset for a small symbol', () => {
    expect(availablePresets(21)).toEqual(['standard', 'high', 'print']);
  });

  it('rejects presets that would exceed the 8192px cap', () => {
    // 型番 40 (N=177) は印刷用だと 1 万px を超える
    expect(presetPixels(177, 'print')).toBeGreaterThan(MAX_EXPORT_PX);
    expect(isPresetAvailable(177, 'print')).toBe(false);
    expect(availablePresets(177)).not.toContain('print');
  });

  it('keeps at least the standard preset available at the largest version', () => {
    expect(availablePresets(177).length).toBeGreaterThan(0);
    expect(availablePresets(177)).toContain('standard');
  });

  it('agrees with the cap for every version and preset', () => {
    for (let version = 1; version <= 40; version += 1) {
      const moduleCount = 4 * version + 17;
      for (const preset of Object.keys(EXPORT_PRESETS) as Array<keyof typeof EXPORT_PRESETS>) {
        expect(isPresetAvailable(moduleCount, preset)).toBe(
          presetPixels(moduleCount, preset) <= MAX_EXPORT_PX,
        );
      }
    }
  });
});

describe('resolvePreset', () => {
  it('keeps an available preset unchanged', () => {
    expect(resolvePreset(21, 'print')).toBe('print');
  });

  it('falls back to the largest preset that fits', () => {
    const resolved = resolvePreset(177, 'print');
    expect(resolved).not.toBe('print');
    expect(isPresetAvailable(177, resolved)).toBe(true);
  });

  it('never returns a preset that exceeds the cap', () => {
    for (let version = 1; version <= 40; version += 1) {
      const moduleCount = 4 * version + 17;
      for (const preset of ['standard', 'high', 'print'] as const) {
        expect(isPresetAvailable(moduleCount, resolvePreset(moduleCount, preset))).toBe(true);
      }
    }
  });
});

describe('exportFileName', () => {
  it('formats the timestamp with zero padding', () => {
    expect(exportFileName(new Date(2026, 7, 18, 9, 5, 3))).toBe(
      'halftone-qr-20260818-090503.png',
    );
  });

  it('handles a two-digit month and time', () => {
    expect(exportFileName(new Date(2026, 11, 31, 23, 59, 59))).toBe(
      'halftone-qr-20261231-235959.png',
    );
  });
});

describe('formatDimensions', () => {
  it('renders a square dimension label', () => {
    expect(formatDimensions(1044)).toBe('1044 × 1044 px');
  });
});
