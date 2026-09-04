import { INK_MAP, InkId } from '../types';
import { luminanceOfHex, clamp01 } from '../utils/color';
import { mulberry32 } from '../utils/prng';

export interface PlateInfo {
  ink: InkId;
  hex: string;
  /** 0 = darkest ink / shadow tone-band role ... N-1 = lightest ink / highlight role */
  bandIndex: number;
  angleDeg: number;
  offset: { dx: number; dy: number };
}

/** Default AM screen angles by tone-band role, per the riso convention referenced in the spec. */
const DEFAULT_ANGLES = [0, 15, 45];

const MAX_MISREGISTRATION_PX = 14;

/**
 * Builds one logical "plate" per selected ink, ordered darkest-ink-first.
 * Darker inks are assigned to shadow-leaning tone bands, lighter inks to
 * highlight-leaning bands, with deliberate overlap between adjacent bands so
 * multiply-composited plates create a visible third color where they cross.
 */
export function buildPlates(
  selectedInks: InkId[],
  angleSpread: number,
  misregistrationStrength: number,
  seed: number,
): PlateInfo[] {
  const orderedByDarkness = [...selectedInks].sort(
    (a, b) => luminanceOfHex(INK_MAP[a].hex) - luminanceOfHex(INK_MAP[b].hex),
  );
  const rand = mulberry32(seed);
  const strength = clamp01(misregistrationStrength / 100);

  return orderedByDarkness.map((ink, bandIndex) => {
    const baseAngle = DEFAULT_ANGLES[bandIndex] ?? bandIndex * 20;
    const angleDeg = baseAngle * (angleSpread / 100);
    const dx = (rand() * 2 - 1) * MAX_MISREGISTRATION_PX * strength;
    const dy = (rand() * 2 - 1) * MAX_MISREGISTRATION_PX * strength;
    return {
      ink,
      hex: INK_MAP[ink].hex,
      bandIndex,
      angleDeg,
      offset: { dx, dy },
    };
  });
}
