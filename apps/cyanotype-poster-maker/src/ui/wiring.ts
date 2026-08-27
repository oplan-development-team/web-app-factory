import { bindRadioGroup, bindSlider, buildInkSwatches } from './controls';
import type { Elements } from './dom';
import type { AppState, EdgeStyle, LabelFieldKey, LayoutId } from '../types';

export type StatePatch = Partial<AppState>;

export function bindSliders(elements: Elements, apply: (patch: StatePatch) => void): void {
  bindSlider(elements.rangeContrast, elements.outContrast, (contrast) => apply({ contrast }));
  bindSlider(elements.rangeThreshold, elements.outThreshold, (threshold) => apply({ threshold }));
  bindSlider(elements.rangeMottle, elements.outMottle, (mottle) => apply({ mottle }));
  bindSlider(elements.rangeGrain, elements.outGrain, (grain) => apply({ grain }));
  bindSlider(elements.rangeVignette, elements.outVignette, (vignette) => apply({ vignette }));
}

export function bindToggles(apply: (patch: StatePatch) => void): void {
  bindRadioGroup<EdgeStyle>('edgeStyle', (edgeStyle) => apply({ edgeStyle }));
  bindRadioGroup<LayoutId>('layout', (layout) => apply({ layout }));
}

export function bindInkSwatches(elements: Elements, selectedId: string, apply: (id: string) => void): void {
  buildInkSwatches(elements.inkSwatches, selectedId, apply);
}

export function bindLabelForm(elements: Elements, apply: (key: LabelFieldKey, value: string) => void): void {
  const fields: Array<[LabelFieldKey, HTMLInputElement]> = [
    ['title', elements.fieldTitle],
    ['subtitle', elements.fieldSubtitle],
    ['locality', elements.fieldLocality],
    ['lat', elements.fieldLat],
    ['lon', elements.fieldLon],
    ['date', elements.fieldDate],
    ['specimenNo', elements.fieldSpecimenNo],
  ];

  for (const [key, input] of fields) {
    input.addEventListener('input', () => apply(key, input.value));
    // date 入力はピッカー経由だと input が飛ばないブラウザがあるので change も拾う
    input.addEventListener('change', () => apply(key, input.value));
  }
}
