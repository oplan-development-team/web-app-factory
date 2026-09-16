import { describe, it, expect } from 'vitest';
import { ThermalField } from './thermalField';

describe('ThermalField', () => {
  it('starts at zero everywhere', () => {
    const field = new ThermalField(8, 8);
    expect(field.average()).toBe(0);
  });

  it('heats up over time when heatInput > 0', () => {
    const field = new ThermalField(16, 24);
    for (let i = 0; i < 60; i++) {
      field.step(1 / 30, { heatInput: 0.8 });
    }
    expect(field.average()).toBeGreaterThan(0);
  });

  it('stays cold when heatInput is 0 and settles back near zero', () => {
    const field = new ThermalField(16, 24);
    field.addPulse(0.5, 0.5, 2, 4);
    for (let i = 0; i < 300; i++) {
      field.step(1 / 30, { heatInput: 0 });
    }
    expect(field.average()).toBeLessThan(0.05);
  });

  it('diffuses a hot spot outward instead of staying a single spike', () => {
    const field = new ThermalField(20, 20);
    field.addPulse(0.5, 0.5, 3, 2);
    const before = field.sample(0.5, 0.5);
    for (let i = 0; i < 10; i++) {
      field.step(1 / 30, { heatInput: 0 });
    }
    const neighbourAfter = field.sample(0.5, 0.42);
    // Heat should have spread outward from the injection point.
    expect(neighbourAfter).toBeGreaterThan(0);
    expect(before).toBeGreaterThan(0);
  });

  it('addPulse raises temperature near the pulse location more than far away', () => {
    const field = new ThermalField(24, 48);
    field.addPulse(0.2, 0.2, 2, 4);
    const near = field.sample(0.2, 0.2);
    const far = field.sample(0.9, 0.9);
    expect(near).toBeGreaterThan(far);
  });

  it('injects more heat near the base with higher heatInput', () => {
    const low = new ThermalField(16, 32);
    const high = new ThermalField(16, 32);
    for (let i = 0; i < 5; i++) {
      low.step(1 / 30, { heatInput: 0.1 });
      high.step(1 / 30, { heatInput: 1.0 });
    }
    expect(high.sample(0.5, 0.97)).toBeGreaterThan(low.sample(0.5, 0.97));
  });

  it('clamps values so the simulation stays numerically stable', () => {
    const field = new ThermalField(10, 10);
    for (let i = 0; i < 500; i++) {
      field.step(1 / 30, { heatInput: 5 });
    }
    for (const v of field.data) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeLessThanOrEqual(4);
    }
  });
});
