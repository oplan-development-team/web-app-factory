import { describe, expect, it } from 'vitest';
import { computeDropRenderParams, evaluateInkAt, ringProfile, WASHI_BG } from '../ink';
import type { DropRecord } from '../types';

describe('ringProfile', () => {
  it('peaks at the ring radius and decays with distance from it', () => {
    const atRadius = ringProfile(0.1, 0.1, 0.02);
    const offRadius = ringProfile(0.2, 0.1, 0.02);
    expect(atRadius).toBeCloseTo(1, 5);
    expect(offRadius).toBeLessThan(atRadius);
  });
});

describe('computeDropRenderParams', () => {
  it('nests successive same-spot drops with growing radii', () => {
    const drops: DropRecord[] = [
      { x: 0.5, y: 0.5, ink: 'shu', seq: 0 },
      { x: 0.5, y: 0.5, ink: 'dousa', seq: 1 },
      { x: 0.5, y: 0.5, ink: 'ai', seq: 2 },
    ];
    const params = computeDropRenderParams(drops);
    expect(params[1].radius).toBeGreaterThan(params[0].radius);
    expect(params[2].radius).toBeGreaterThan(params[1].radius);
  });

  it('does not nest drops placed far apart', () => {
    const drops: DropRecord[] = [
      { x: 0.1, y: 0.1, ink: 'shu', seq: 0 },
      { x: 0.9, y: 0.9, ink: 'ai', seq: 1 },
    ];
    const params = computeDropRenderParams(drops);
    expect(params[0].radius).toBeCloseTo(params[1].radius, 1);
  });
});

describe('evaluateInkAt', () => {
  it('returns the background color where no drop reaches', () => {
    const drops: DropRecord[] = [{ x: 0.5, y: 0.5, ink: 'shu', seq: 0 }];
    const params = computeDropRenderParams(drops);
    const color = evaluateInkAt(0.02, 0.02, drops, params);
    expect(color[0]).toBeCloseTo(WASHI_BG[0], 0);
    expect(color[1]).toBeCloseTo(WASHI_BG[1], 0);
    expect(color[2]).toBeCloseTo(WASHI_BG[2], 0);
  });

  it('paints the ink color on the drop ring itself', () => {
    const drops: DropRecord[] = [{ x: 0.5, y: 0.5, ink: 'shu', seq: 0 }];
    const params = computeDropRenderParams(drops);
    const [r, , b] = evaluateInkAt(0.5 + params[0].radius, 0.5, drops, params);
    // Shu (vermilion) is warm: red channel should dominate over blue.
    expect(r).toBeGreaterThan(b);
  });

  it('lets a later dousa drop clear an earlier ink ring at the same spot', () => {
    const inkOnly: DropRecord[] = [{ x: 0.5, y: 0.5, ink: 'shu', seq: 0 }];
    const inkParams = computeDropRenderParams(inkOnly);
    const beforeColor = evaluateInkAt(0.5 + inkParams[0].radius, 0.5, inkOnly, inkParams);

    const withDousa: DropRecord[] = [
      { x: 0.5, y: 0.5, ink: 'shu', seq: 0 },
      { x: 0.5, y: 0.5, ink: 'dousa', seq: 1 },
    ];
    const dousaParams = computeDropRenderParams(withDousa);
    // Sample at the *first* ring's radius, which the dousa ring (wider, further
    // out) should still be actively clearing toward background.
    const afterColor = evaluateInkAt(0.5 + inkParams[0].radius, 0.5, withDousa, dousaParams);

    const beforeDistFromBg = Math.hypot(
      beforeColor[0] - WASHI_BG[0],
      beforeColor[1] - WASHI_BG[1],
      beforeColor[2] - WASHI_BG[2]
    );
    const afterDistFromBg = Math.hypot(
      afterColor[0] - WASHI_BG[0],
      afterColor[1] - WASHI_BG[1],
      afterColor[2] - WASHI_BG[2]
    );
    expect(afterDistFromBg).toBeLessThan(beforeDistFromBg);
  });
});
