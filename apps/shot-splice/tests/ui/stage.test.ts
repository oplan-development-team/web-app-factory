import { describe, expect, it, vi } from 'vitest';

import { CANVAS_AREA_LIMIT } from '../../src/core/output';
import { computeLayout, noCuts } from '../../src/core/layout';
import { createStage } from '../../src/ui/stage';
import { addShots, initialState, type Shot } from '../../src/ui/store';

function shot(id: string, color = { r: 20, g: 40, b: 60 }): Shot {
  return {
    id,
    name: `${id}.png`,
    source: {} as CanvasImageSource,
    naturalWidth: 1179,
    naturalHeight: 2556,
    averageColor: color,
  };
}

function build() {
  const paint = vi.fn();
  const stage = createStage({ paint });
  document.body.append(stage.element);
  return { stage, paint };
}

const $ = (root: HTMLElement, selector: string) => root.querySelector(selector) as HTMLElement;

const layoutOf = (...heights: readonly number[]) =>
  computeLayout(
    heights.map((height) => ({ width: 1179, height })),
    heights.slice(1).map(() => 200),
    noCuts,
  );

describe('createStage', () => {
  it('explains what to do when nothing is loaded (FR-601)', () => {
    const { stage, paint } = build();
    stage.update(initialState(), null);
    expect(stage.element.dataset.mode).toBe('empty');
    expect($(stage.element, '.stage__placeholder').hasAttribute('hidden')).toBe(false);
    expect(paint).not.toHaveBeenCalled();
  });

  it('asks for a second shot when only one is loaded (FR-602)', () => {
    const { stage } = build();
    const state = addShots(initialState(), [shot('a')]).state;
    stage.update(state, layoutOf(2556));
    expect(stage.element.dataset.mode).toBe('partial');
    const placeholders = stage.element.querySelectorAll('.stage__placeholder');
    expect(placeholders[1]?.hasAttribute('hidden')).toBe(false);
    expect(placeholders[1]?.textContent).toContain('あと1枚');
  });

  it('paints and reports the output size (FR-502)', () => {
    const { stage, paint } = build();
    const state = addShots(initialState(), [shot('a'), shot('b')]).state;
    const layout = layoutOf(2556, 2556);
    stage.update(state, layout);
    expect(paint).toHaveBeenCalledWith(expect.anything(), 1179, layout.height);
    expect($(stage.element, '.stage__size').textContent).toBe(`1,179 × ${layout.height.toLocaleString('en-US')} px`);
    expect($(stage.element, '.stage__overlap').textContent).toBe('2枚 / 重なり計 200px');
  });

  it('tints the wash from the loaded shots', () => {
    const { stage } = build();
    const state = addShots(initialState(), [
      shot('a', { r: 100, g: 0, b: 0 }),
      shot('b', { r: 0, g: 100, b: 0 }),
    ]).state;
    stage.update(state, layoutOf(2556, 2556));
    expect($(stage.element, '.stage__wash').style.backgroundImage).toContain('rgb(50 50 0');
  });

  it('leaves the wash empty with no shots', () => {
    const { stage } = build();
    stage.update(initialState(), null);
    expect($(stage.element, '.stage__wash').style.backgroundImage).toBe('none');
  });

  it('warns as the output approaches the canvas ceiling (FR-505)', () => {
    const { stage } = build();
    const state = addShots(initialState(), [shot('a'), shot('b')]).state;
    const tall = Math.ceil((CANVAS_AREA_LIMIT * 0.9) / 1179);
    stage.update(state, layoutOf(tall, 400));
    const warning = $(stage.element, '.stage__warning');
    expect(warning.hasAttribute('hidden')).toBe(false);
    expect(warning.textContent).toContain('近づいて');
  });

  it('escalates once the ceiling is passed', () => {
    const { stage } = build();
    const state = addShots(initialState(), [shot('a'), shot('b')]).state;
    const tall = Math.ceil((CANVAS_AREA_LIMIT * 1.2) / 1179);
    stage.update(state, layoutOf(tall, 400));
    const warning = $(stage.element, '.stage__warning');
    expect(warning.textContent).toContain('超えています');
  });

  it('stays quiet at a comfortable size', () => {
    const { stage } = build();
    const state = addShots(initialState(), [shot('a'), shot('b')]).state;
    stage.update(state, layoutOf(2556, 2556));
    expect($(stage.element, '.stage__warning').hasAttribute('hidden')).toBe(true);
  });

  it('does not paint a degenerate layout', () => {
    const { stage, paint } = build();
    const state = addShots(initialState(), [shot('a'), shot('b')]).state;
    stage.update(state, computeLayout([], [], noCuts));
    expect(paint).not.toHaveBeenCalled();
    expect($(stage.element, '.stage__size').textContent).toBe('—');
  });
});
