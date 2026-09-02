import { TEMPLATES } from './templates.ts';
import { PALETTES } from './palettes.ts';
import type { CoverState } from './types.ts';

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function randInt(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

/** Mutates the parts of state that "ランダマイズ" is scoped to: template,
 * palette, and (in photo mode) the crop/angle sliders. Text inputs and the
 * uploaded photo itself are left untouched, per the concept's requirement
 * that randomize is for exploring layout variations, not resetting content. */
export function randomizeState(state: CoverState): void {
  state.templateId = pick(TEMPLATES).id;
  state.paletteId = pick(PALETTES).id;
  state.transform.angle = randInt(-26, 26);
  state.transform.cropX = randInt(-60, 60);
  state.transform.cropY = randInt(-60, 60);
  state.transform.zoom = randInt(100, 180);
}
