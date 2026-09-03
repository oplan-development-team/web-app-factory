import { describe, expect, it, vi } from 'vitest';

import { createSeamRow } from '../../src/ui/seam-row';
import { createSeamSheet } from '../../src/ui/seam-sheet';
import {
  addShots,
  initialState,
  setActiveSeam,
  setDiffMode,
  updateSeam,
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

function baseState(): AppState {
  const state = addShots(initialState(), [shot('a'), shot('b')]).state;
  return updateSeam(state, 0, { overlapPx: 120, maxOverlapPx: 380, cost: 0, matched: true });
}

const $ = (root: HTMLElement, selector: string) => root.querySelector(selector) as HTMLElement;

describe('createSeamRow', () => {
  it('shows the overlap, grade and delta', () => {
    const row = createSeamRow(0, vi.fn());
    row.update({ overlapPx: 1234, maxOverlapPx: 2000, cost: 0, matched: true, front: 'lower' });
    expect($(row.element, '.seam__value').textContent).toBe('1,234');
    expect($(row.element, '.seam__grade').textContent).toBe('一致');
    expect($(row.element, '.seam__delta').textContent).toBe('Δ0.00');
  });

  it('reads as unmeasured before detection', () => {
    const row = createSeamRow(0, vi.fn());
    row.update({ overlapPx: 0, maxOverlapPx: 0, cost: null, matched: false, front: 'lower' });
    expect($(row.element, '.seam__grade').textContent).toBe('未検出');
    expect($(row.element, '.seam__delta').textContent).toBe('');
    expect(row.element.dataset.grade).toBe('unknown');
  });

  it('moves the tint from amber towards cyan as the cost falls', () => {
    const row = createSeamRow(0, vi.fn());
    row.update({ overlapPx: 10, maxOverlapPx: 100, cost: 40, matched: false, front: 'lower' });
    const drifting = row.element.style.getPropertyValue('--seam-tint');
    expect(drifting).toContain('var(--align) 0%');
    expect(row.element.dataset.grade).toBe('drifting');

    row.update({ overlapPx: 10, maxOverlapPx: 100, cost: 0, matched: true, front: 'lower' });
    expect(row.element.style.getPropertyValue('--seam-tint')).toContain('var(--align) 100%');
    expect($(row.element, '.seam__bar-fill').style.width).toBe('100%');
  });

  it('opens the sheet when tapped', () => {
    const onOpen = vi.fn();
    const row = createSeamRow(2, onOpen);
    row.element.click();
    expect(onOpen).toHaveBeenCalledWith(2);
  });
});

function buildSheet() {
  const callbacks = {
    onOverlap: vi.fn(),
    onFront: vi.fn(),
    onDiff: vi.fn(),
    onRedetect: vi.fn(),
    onClose: vi.fn(),
    paint: vi.fn(() => 0.5),
  };
  const sheet = createSeamSheet(callbacks);
  document.body.append(sheet.element);
  return { sheet, callbacks };
}

describe('createSeamSheet', () => {
  it('stays hidden until a seam is selected', () => {
    const { sheet, callbacks } = buildSheet();
    sheet.update(baseState());
    expect(sheet.element.hasAttribute('hidden')).toBe(true);
    expect(callbacks.paint).not.toHaveBeenCalled();

    sheet.update(setActiveSeam(baseState(), 0));
    expect(sheet.element.hasAttribute('hidden')).toBe(false);
    expect(callbacks.paint).toHaveBeenCalled();
  });

  it('shows the seam number, value, ceiling and grade', () => {
    const { sheet } = buildSheet();
    sheet.update(setActiveSeam(baseState(), 0));
    expect($(sheet.element, '.sheet__title').textContent).toBe('継ぎ目 1');
    expect($(sheet.element, '.sheet__value').textContent).toBe('120');
    expect($(sheet.element, '.sheet__max').textContent).toBe('/ 最大 380px');
    expect($(sheet.element, '.sheet__grade').textContent).toBe('一致・Δ0.00');
  });

  it('steps the overlap by one and by ten (FR-301c)', () => {
    const { sheet, callbacks } = buildSheet();
    sheet.update(setActiveSeam(baseState(), 0));
    const steps = sheet.element.querySelectorAll<HTMLButtonElement>('.sheet__step');
    steps[0]?.click();
    expect(callbacks.onOverlap).toHaveBeenLastCalledWith(0, 110);
    steps[2]?.click();
    expect(callbacks.onOverlap).toHaveBeenLastCalledWith(0, 121);
    steps[3]?.click();
    expect(callbacks.onOverlap).toHaveBeenLastCalledWith(0, 130);
  });

  it('accepts a typed value (FR-301b)', () => {
    const { sheet, callbacks } = buildSheet();
    sheet.update(setActiveSeam(baseState(), 0));
    const input = $(sheet.element, '.sheet__input') as HTMLInputElement;
    input.value = '77';
    input.dispatchEvent(new Event('change'));
    expect(callbacks.onOverlap).toHaveBeenCalledWith(0, 77);
  });

  it('uses arrow keys, ten pixels at a time with shift (FR-301d)', () => {
    const { sheet, callbacks } = buildSheet();
    sheet.update(setActiveSeam(baseState(), 0));
    const input = $(sheet.element, '.sheet__input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
    expect(callbacks.onOverlap).toHaveBeenLastCalledWith(0, 121);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, cancelable: true }),
    );
    expect(callbacks.onOverlap).toHaveBeenLastCalledWith(0, 110);
  });

  it('ignores other keys', () => {
    const { sheet, callbacks } = buildSheet();
    sheet.update(setActiveSeam(baseState(), 0));
    const input = $(sheet.element, '.sheet__input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', cancelable: true }));
    expect(callbacks.onOverlap).not.toHaveBeenCalled();
  });

  it('drags the crop to adjust, pulling up to increase the overlap (FR-301a)', () => {
    const { sheet, callbacks } = buildSheet();
    sheet.update(setActiveSeam(baseState(), 0));
    const loupe = $(sheet.element, '.loupe');
    Object.assign(loupe, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true,
    });

    const send = (type: string, y: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
      Object.assign(event, { pointerId: 1, button: 0, clientX: 0, clientY: y });
      loupe.dispatchEvent(event);
    };

    send('pointerdown', 200);
    send('pointermove', 190);
    // Paint reported a display scale of 0.5, so 10 CSS px is 20 image px.
    expect(callbacks.onOverlap).toHaveBeenLastCalledWith(0, 140);
    send('pointerup', 190);
  });

  it('switches the front layer and the view mode', () => {
    const { sheet, callbacks } = buildSheet();
    sheet.update(setActiveSeam(baseState(), 0));
    const buttons = sheet.element.querySelectorAll<HTMLButtonElement>('.segmented__btn');
    buttons[1]?.click();
    expect(callbacks.onDiff).toHaveBeenCalledWith(true);
    buttons[2]?.click();
    expect(callbacks.onFront).toHaveBeenCalledWith(0, 'upper');
  });

  it('marks the active options', () => {
    const { sheet } = buildSheet();
    sheet.update(setDiffMode(setActiveSeam(baseState(), 0), true));
    const checked = Array.from(
      sheet.element.querySelectorAll<HTMLButtonElement>('.segmented__btn'),
    ).filter((b) => b.getAttribute('aria-checked') === 'true');
    expect(checked.map((b) => b.dataset.value).sort()).toEqual(['diff', 'lower']);
  });

  it('re-detects a single seam (FR-108)', () => {
    const { sheet, callbacks } = buildSheet();
    sheet.update(setActiveSeam(baseState(), 0));
    $(sheet.element, '.btn--ghost').click();
    expect(callbacks.onRedetect).toHaveBeenCalledWith(0);
  });

  it('closes from the button and from the scrim', () => {
    const { sheet, callbacks } = buildSheet();
    sheet.update(setActiveSeam(baseState(), 0));
    $(sheet.element, '.sheet__close').click();
    $(sheet.element, '.sheet__scrim').click();
    expect(callbacks.onClose).toHaveBeenCalledTimes(2);
  });

  it('repaints in difference mode when asked', () => {
    const { sheet, callbacks } = buildSheet();
    sheet.update(setDiffMode(setActiveSeam(baseState(), 0), true));
    expect(callbacks.paint).toHaveBeenLastCalledWith(expect.anything(), 0, true);
  });

  it('does not overwrite the field while it has focus', () => {
    const { sheet } = buildSheet();
    sheet.update(setActiveSeam(baseState(), 0));
    const input = $(sheet.element, '.sheet__input') as HTMLInputElement;
    input.focus();
    input.value = '9';
    sheet.update(setActiveSeam(baseState(), 0));
    expect(input.value).toBe('9');
  });
});
