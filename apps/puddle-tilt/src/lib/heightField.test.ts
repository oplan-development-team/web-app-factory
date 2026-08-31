import { describe, expect, it } from 'vitest';
import { WaveField } from './heightField';

describe('WaveField', () => {
  it('starts perfectly flat', () => {
    const field = new WaveField({ size: 8 });
    expect(Array.from(field.heights).every((h) => h === 0)).toBe(true);
  });

  it('addImpulse raises height near the target point', () => {
    const field = new WaveField({ size: 16 });
    field.addImpulse(0.5, 0.5, 3, 5);
    const n = field.size;
    const centerIdx = Math.round(0.5 * (n - 1)) * n + Math.round(0.5 * (n - 1));
    expect(field.heights[centerIdx]).toBeGreaterThan(0);
  });

  it('impulse energy stays finite and decays after many ripple steps', () => {
    const field = new WaveField({ size: 32 });
    field.addImpulse(0.5, 0.5, 4, 10);

    const initial = field.heights[0]!;
    void initial;

    let maxAbs = 0;
    for (let i = 0; i < 200; i++) {
      field.step(0, 0, 1 / 60);
    }
    for (const h of field.heights) {
      expect(Number.isFinite(h)).toBe(true);
      maxAbs = Math.max(maxAbs, Math.abs(h));
    }
    // Damping should have brought the initial impulse energy down well
    // below its starting magnitude.
    expect(maxAbs).toBeLessThan(10);
  });

  it('tilting toward +x shifts mass toward the high-x wall over time', () => {
    const field = new WaveField({ size: 24, advectionSpeed: 4 });
    field.addImpulse(0.5, 0.5, 3, 6);

    for (let i = 0; i < 120; i++) {
      field.step(1, 0, 1 / 30);
    }

    const n = field.size;
    const midY = Math.floor(n / 2);
    let leftSum = 0;
    let rightSum = 0;
    for (let x = 0; x < n; x++) {
      const idx = midY * n + x;
      const h = field.heights[idx] as number;
      if (x < n / 2) leftSum += Math.abs(h);
      else rightSum += Math.abs(h);
    }
    expect(rightSum).toBeGreaterThan(leftSum);
  });

  it('rejects invalid grid sizes', () => {
    expect(() => new WaveField({ size: 2 })).toThrow();
    expect(() => new WaveField({ size: 8.5 })).toThrow();
  });
});
