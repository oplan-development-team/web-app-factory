import { describe, expect, test } from 'vitest';
import { pickRandomSpecies, SPECIES_LABEL, SPECIES_LIST, speciesSvg } from './species';

describe('species catalogue', () => {
  test('every species has a Japanese label', () => {
    for (const s of SPECIES_LIST) {
      expect(SPECIES_LABEL[s]?.length).toBeGreaterThan(0);
    }
  });

  test('pickRandomSpecies only ever returns a known species', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(SPECIES_LIST).toContain(pickRandomSpecies());
    }
  });
});

describe('speciesSvg', () => {
  test.each(SPECIES_LIST)('%s renders svg with the CSS class hooks', (species) => {
    const svg = speciesSvg(species);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 100 100"');
    // Stage-driven recolouring is done in CSS via these hooks, so losing them
    // would silently break every stage colour.
    expect(svg).toContain('plant-stem');
    expect(svg).toContain('plant-body');
    expect(svg).toContain('plant-accent');
  });

  test('marks decorative art as hidden from assistive tech (FR-602)', () => {
    for (const s of SPECIES_LIST) {
      expect(speciesSvg(s)).toContain('aria-hidden="true"');
    }
  });

  test('uses only angular primitives, no curves (FR-600)', () => {
    for (const s of SPECIES_LIST) {
      const svg = speciesSvg(s);
      expect(svg).not.toContain('<circle');
      expect(svg).not.toContain('<ellipse');
      expect(svg).not.toContain('Gradient');
    }
  });

  test('parses as valid markup in the DOM', () => {
    const host = document.createElement('div');
    for (const s of SPECIES_LIST) {
      host.innerHTML = speciesSvg(s);
      expect(host.querySelector('svg')).not.toBeNull();
    }
  });
});
