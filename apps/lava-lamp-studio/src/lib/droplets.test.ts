import { describe, it, expect } from 'vitest';
import { createDroplets, stepDroplets, type DropletBounds } from './droplets';
import { ThermalField } from './thermalField';

const bounds: DropletBounds = { minX: 0.1, maxX: 0.9, minY: 0.07, maxY: 0.93 };

describe('createDroplets', () => {
  it('creates the requested count, all within bounds', () => {
    const droplets = createDroplets(6, bounds);
    expect(droplets).toHaveLength(6);
    for (const d of droplets) {
      expect(d.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(d.x).toBeLessThanOrEqual(bounds.maxX);
      expect(d.y).toBeGreaterThanOrEqual(bounds.minY);
      expect(d.y).toBeLessThanOrEqual(bounds.maxY);
      expect(d.r).toBeGreaterThan(0);
    }
  });
});

describe('stepDroplets', () => {
  it('rises toward hot regions (buoyancy) when the field is heated', () => {
    const field = new ThermalField(24, 48);
    for (let i = 0; i < 300; i++) field.step(1 / 30, { heatInput: 1 });

    const droplets = createDroplets(4, bounds).map((d) => ({ ...d, y: 0.8, temp: 0.1 }));
    const startY = droplets.map((d) => d.y);
    for (let i = 0; i < 180; i++) {
      stepDroplets(droplets, field, 1 / 30, bounds, { viscosity: 0.3 });
    }
    const avgStart = startY.reduce((a, b) => a + b, 0) / startY.length;
    const avgEnd = droplets.reduce((a, d) => a + d.y, 0) / droplets.length;
    // y decreases upward; droplets should have moved up on average.
    expect(avgEnd).toBeLessThan(avgStart);
  });

  it('higher viscosity produces less total movement (speed cap + drag) over the same time', () => {
    const field = new ThermalField(24, 48);
    for (let i = 0; i < 300; i++) field.step(1 / 30, { heatInput: 1 });

    const thin = createDroplets(4, bounds).map((d) => ({ ...d, y: 0.8, temp: 0.1 }));
    const thick = thin.map((d) => ({ ...d }));

    // Track total path length travelled (sum of per-step displacement) so a
    // droplet that overshoots and bounces back isn't mistaken for one that
    // barely moved, which a single start/end delta would miss.
    let thinPath = 0;
    let thickPath = 0;
    for (let i = 0; i < 150; i++) {
      const thinBefore = thin.map((d) => d.y);
      const thickBefore = thick.map((d) => d.y);
      stepDroplets(thin, field, 1 / 30, bounds, { viscosity: 0.05 });
      stepDroplets(thick, field, 1 / 30, bounds, { viscosity: 0.95 });
      thin.forEach((d, i) => (thinPath += Math.abs(d.y - thinBefore[i])));
      thick.forEach((d, i) => (thickPath += Math.abs(d.y - thickBefore[i])));
    }

    expect(thinPath).toBeGreaterThan(thickPath);
  });

  it('keeps droplets within bounds (wall/floor/ceiling collisions)', () => {
    const field = new ThermalField(24, 48);
    const droplets = createDroplets(6, bounds);
    for (let i = 0; i < 400; i++) {
      field.step(1 / 30, { heatInput: 0.9 });
      stepDroplets(droplets, field, 1 / 30, bounds, { viscosity: 0.2 });
    }
    for (const d of droplets) {
      expect(d.x).toBeGreaterThanOrEqual(bounds.minX - 1e-6);
      expect(d.x).toBeLessThanOrEqual(bounds.maxX + 1e-6);
      expect(d.y).toBeGreaterThanOrEqual(bounds.minY - 1e-6);
      expect(d.y).toBeLessThanOrEqual(bounds.maxY + 1e-6);
    }
  });
});
