import { describe, expect, it, vi } from 'vitest';

import { createBandCard } from '../../src/ui/band-card';
import {
  addShots,
  applyBandDetection,
  initialState,
  updateBands,
  type AppState,
  type Shot,
} from '../../src/ui/store';

function shot(id: string): Shot {
  return {
    id,
    name: `${id}.png`,
    source: {} as CanvasImageSource,
    naturalWidth: 100,
    naturalHeight: 400,
    averageColor: { r: 0, g: 0, b: 0 },
  };
}

function build() {
  const callbacks = {
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onTrimEnds: vi.fn(),
    onAdopt: vi.fn(),
  };
  const card = createBandCard(callbacks);
  document.body.append(card.element);
  return { card, callbacks };
}

function detected(header: number, footer: number): AppState {
  const state = addShots(initialState(), [shot('a'), shot('b')]).state;
  return applyBandDetection(state, { headerPx: header, footerPx: footer });
}

const $ = (root: HTMLElement, selector: string) => root.querySelector(selector) as HTMLElement;

describe('createBandCard', () => {
  it('waits for a second shot before claiming anything', () => {
    const { card } = build();
    card.update(initialState());
    expect($(card.element, '.band__summary').textContent).toContain('2枚以上');
    expect(card.element.hasAttribute('data-empty')).toBe(true);
  });

  it('states what it found in pixels (FR-204)', () => {
    const { card } = build();
    card.update(detected(88, 132));
    const text = $(card.element, '.band__summary').textContent ?? '';
    expect(text).toContain('上端 88px');
    expect(text).toContain('下端 132px');
  });

  it('says so when nothing is shared', () => {
    const { card } = build();
    card.update(detected(0, 0));
    expect($(card.element, '.band__summary').textContent).toContain('見つかりませんでした');
  });

  it('mirrors the applied values into the number fields', () => {
    const { card } = build();
    card.update(detected(88, 132));
    const inputs = card.element.querySelectorAll<HTMLInputElement>('.stepper__input');
    expect(inputs[0]?.value).toBe('88');
    expect(inputs[1]?.value).toBe('132');
  });

  it('can be switched off entirely', () => {
    const { card, callbacks } = build();
    card.update(detected(88, 132));
    const toggle = $(card.element, '.switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    toggle.click();
    expect(callbacks.onToggle).toHaveBeenCalledWith(false);
  });

  it('disables the fields while the cut is switched off', () => {
    const { card } = build();
    card.update(updateBands(detected(88, 132), { enabled: false }));
    const inputs = card.element.querySelectorAll<HTMLInputElement>('.stepper__input');
    expect(inputs[0]?.disabled).toBe(true);
    expect($(card.element, '.band__body').hasAttribute('data-disabled')).toBe(true);
  });

  it('reports a hand-typed value', () => {
    const { card, callbacks } = build();
    card.update(detected(88, 132));
    const input = card.element.querySelectorAll<HTMLInputElement>('.stepper__input')[0] as HTMLInputElement;
    input.value = '40';
    input.dispatchEvent(new Event('change'));
    expect(callbacks.onEdit).toHaveBeenCalledWith({ headerPx: 40 });
  });

  it('nudges by one pixel per press', () => {
    const { card, callbacks } = build();
    card.update(detected(88, 132));
    const buttons = card.element.querySelectorAll<HTMLButtonElement>('.stepper__btn');
    buttons[1]?.click();
    expect(callbacks.onEdit).toHaveBeenCalledWith({ headerPx: 89 });
    // The field now reads 89, so the next press steps down from there.
    buttons[0]?.click();
    expect(callbacks.onEdit).toHaveBeenLastCalledWith({ headerPx: 88 });
  });

  it('never nudges below zero', () => {
    const { card, callbacks } = build();
    card.update(detected(0, 0));
    const buttons = card.element.querySelectorAll<HTMLButtonElement>('.stepper__btn');
    buttons[0]?.click();
    expect(callbacks.onEdit).toHaveBeenCalledWith({ headerPx: 0 });
  });

  it('offers the both-ends variant', () => {
    const { card, callbacks } = build();
    card.update(detected(88, 132));
    const checkbox = $(card.element, '.checkbox__input') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    expect(callbacks.onTrimEnds).toHaveBeenCalledWith(true);
  });

  it('flags a hand-adjusted value and offers to restore the detection (FR-207)', () => {
    const { card, callbacks } = build();
    let state = detected(88, 132);
    expect($(card.element, '.band__drift')).toBeTruthy();
    card.update(state);
    expect($(card.element, '.band__drift').hasAttribute('hidden')).toBe(true);

    state = updateBands(state, { headerPx: 40, manuallyEdited: true });
    card.update(state);
    const drift = $(card.element, '.band__drift');
    expect(drift.hasAttribute('hidden')).toBe(false);
    expect(drift.textContent).toContain('上端 88px');

    $(card.element, '.band__adopt').click();
    expect(callbacks.onAdopt).toHaveBeenCalled();
  });

  it('does not fight the user while a field has focus', () => {
    const { card } = build();
    card.update(detected(88, 132));
    const input = card.element.querySelectorAll<HTMLInputElement>('.stepper__input')[0] as HTMLInputElement;
    input.focus();
    input.value = '12';
    card.update(detected(88, 132));
    expect(input.value).toBe('12');
  });
});
