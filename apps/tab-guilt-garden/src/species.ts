import type { SpeciesId } from './types';

export const SPECIES_LIST: SpeciesId[] = ['flower', 'cactus', 'mushroom', 'tree'];

export const SPECIES_LABEL: Record<SpeciesId, string> = {
  flower: '花',
  cactus: 'サボテン',
  mushroom: 'きのこ',
  tree: '木',
};

export function pickRandomSpecies(): SpeciesId {
  const i = Math.floor(Math.random() * SPECIES_LIST.length);
  return SPECIES_LIST[i] ?? 'flower';
}

/**
 * Blocky, angular SVG markup per species -- deliberately geometric rather than
 * botanically smooth, so the plant illustrations stay in the same
 * neo-brutalist visual language as the rest of the UI (no curves/gradients).
 * Fill colors are driven entirely by CSS via the `.plant-stem`/`.plant-body`
 * class hooks, so a card's data-stage attribute can recolor it in pure CSS.
 */
export function speciesSvg(species: SpeciesId): string {
  switch (species) {
    case 'flower':
      return `
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <rect class="plant-stem" x="46" y="50" width="8" height="42" />
          <rect class="plant-stem" x="30" y="70" width="16" height="6" transform="rotate(-20 38 73)" />
          <polygon class="plant-body" points="50,10 66,30 50,50 34,30" />
          <polygon class="plant-body" points="50,10 66,30 50,50 34,30" transform="rotate(90 50 30)" />
          <rect class="plant-accent" x="42" y="22" width="16" height="16" />
        </svg>`;
    case 'cactus':
      return `
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <rect class="plant-stem" x="40" y="86" width="20" height="8" />
          <rect class="plant-body" x="38" y="30" width="24" height="56" />
          <rect class="plant-body" x="18" y="46" width="16" height="30" />
          <rect class="plant-body" x="66" y="38" width="16" height="34" />
          <rect class="plant-accent" x="44" y="14" width="12" height="12" />
        </svg>`;
    case 'mushroom':
      return `
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <rect class="plant-stem" x="42" y="52" width="16" height="38" />
          <polygon class="plant-body" points="14,54 50,18 86,54" />
          <rect class="plant-body" x="14" y="46" width="72" height="14" />
          <rect class="plant-accent" x="30" y="30" width="10" height="10" />
          <rect class="plant-accent" x="60" y="34" width="10" height="10" />
        </svg>`;
    case 'tree':
    default:
      return `
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <rect class="plant-stem" x="44" y="58" width="12" height="34" />
          <polygon class="plant-body" points="50,10 78,44 22,44" />
          <polygon class="plant-body" points="50,28 82,64 18,64" />
          <rect class="plant-accent" x="44" y="36" width="12" height="10" />
        </svg>`;
  }
}
