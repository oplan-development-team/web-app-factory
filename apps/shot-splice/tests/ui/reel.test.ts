import { describe, expect, it, vi } from 'vitest';

import { longPressDrag } from '../../src/ui/pointer';
import { createReel } from '../../src/ui/reel';
import { addShots, initialState, type Shot } from '../../src/ui/store';
import { el } from '../../src/ui/dom';
import { domFakeFactory } from '../helpers/fake-canvas';

function shot(id: string, width = 1179, height = 2556): Shot {
  return {
    id,
    name: `${id}.png`,
    source: {} as CanvasImageSource,
    naturalWidth: width,
    naturalHeight: height,
    averageColor: { r: 0, g: 0, b: 0 },
  };
}

function stateWith(...ids: readonly string[]) {
  return addShots(initialState(), ids.map((id) => shot(id))).state;
}

function build(callbacks: Partial<Parameters<typeof createReel>[0]> = {}) {
  const onMove = vi.fn();
  const onRemove = vi.fn();
  const reel = createReel(
    {
      onMove,
      onRemove,
      renderSeam: (i) => el('div', { class: 'seam', attrs: { 'data-i': i } }),
      ...callbacks,
    },
    { factory: domFakeFactory(), pixelRatio: 1 },
  );
  document.body.append(reel.element);
  return { reel, onMove, onRemove };
}

describe('createReel', () => {
  it('weaves seam connectors between consecutive shots', () => {
    const { reel } = build();
    reel.update(stateWith('a', 'b', 'c'));
    const kinds = Array.from(reel.element.children).map((node) => node.className);
    expect(kinds).toEqual(['reel__shot', 'reel__seam', 'reel__shot', 'reel__seam', 'reel__shot']);
  });

  it('renders no seam for a single shot', () => {
    const { reel } = build();
    reel.update(stateWith('only'));
    expect(reel.element.querySelectorAll('.reel__seam')).toHaveLength(0);
  });

  it('shows the position, name and pixel size of each shot', () => {
    const { reel } = build();
    reel.update(stateWith('a'));
    expect(reel.element.querySelector('.reel__index')?.textContent).toBe('01');
    expect(reel.element.querySelector('.reel__name')?.textContent).toBe('a.png');
    expect(reel.element.querySelector('.reel__dims')?.textContent).toBe('1,179 × 2,556');
  });

  it('disables the move buttons at the ends of the reel', () => {
    const { reel } = build();
    reel.update(stateWith('a', 'b', 'c'));
    const rows = reel.element.querySelectorAll('.reel__shot');
    const buttonsOf = (row: Element) => row.querySelectorAll<HTMLButtonElement>('.reel__controls button');
    expect(buttonsOf(rows[0] as Element)[0]?.disabled).toBe(true);
    expect(buttonsOf(rows[0] as Element)[1]?.disabled).toBe(false);
    expect(buttonsOf(rows[2] as Element)[1]?.disabled).toBe(true);
  });

  it('reports move and remove intents', () => {
    const { reel, onMove, onRemove } = build();
    reel.update(stateWith('a', 'b'));
    const buttons = reel.element.querySelectorAll<HTMLButtonElement>('.reel__shot .reel__controls button');
    buttons[1]?.click();
    expect(onMove).toHaveBeenCalledWith(0, 1);
    buttons[2]?.click();
    expect(onRemove).toHaveBeenCalledWith('a');
  });

  it('rebuilds only when the shot order changes', () => {
    const { reel } = build();
    const state = stateWith('a', 'b');
    reel.update(state);
    const firstRow = reel.element.querySelector('.reel__shot');
    reel.update({ ...state, diffMode: true });
    expect(reel.element.querySelector('.reel__shot')).toBe(firstRow);
    reel.update(stateWith('b', 'a'));
    expect(reel.element.querySelector('.reel__shot')).not.toBe(firstRow);
  });

  it('empties itself when every shot is removed', () => {
    const { reel } = build();
    reel.update(stateWith('a', 'b'));
    reel.update(initialState());
    expect(reel.element.children).toHaveLength(0);
  });
});

describe('longPressDrag', () => {
  function pointer(type: string, x: number, y: number): PointerEvent {
    const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
    Object.assign(event, { pointerId: 1, button: 0, clientX: x, clientY: y });
    return event;
  }

  function target() {
    const node = document.createElement('div');
    Object.assign(node, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true,
    });
    document.body.append(node);
    return node;
  }

  // jsdom stamps synthetic events with near-identical timestamps, so the hold
  // timer is driven explicitly rather than by wall-clock time.
  function timers() {
    const pending = new Map<number, () => void>();
    let next = 1;
    return {
      controls: {
        setTimer: (fn: () => void) => {
          pending.set(next, fn);
          return next++;
        },
        clearTimer: (handle: number) => {
          pending.delete(handle);
        },
      },
      fire: () => {
        for (const fn of [...pending.values()]) fn();
        pending.clear();
      },
      pendingCount: () => pending.size,
    };
  }

  it('engages only after the hold completes', () => {
    const node = target();
    const t = timers();
    const onHold = vi.fn();
    const onMove = vi.fn();
    longPressDrag(node, { onHold, onMove, onEnd: vi.fn() }, t.controls);

    node.dispatchEvent(pointer('pointerdown', 0, 0));
    node.dispatchEvent(pointer('pointermove', 0, 4));
    expect(onHold).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();

    t.fire();
    expect(onHold).toHaveBeenCalledTimes(1);
    node.dispatchEvent(pointer('pointermove', 0, 30));
    expect(onMove).toHaveBeenCalledWith(0, 30, expect.anything());
  });

  it('gives up the gesture when the finger travels first (scroll wins)', () => {
    const node = target();
    const t = timers();
    const onHold = vi.fn();
    longPressDrag(node, { onHold, onMove: vi.fn(), onEnd: vi.fn() }, t.controls);

    node.dispatchEvent(pointer('pointerdown', 0, 0));
    node.dispatchEvent(pointer('pointermove', 0, 40));
    expect(t.pendingCount()).toBe(0);
    t.fire();
    expect(onHold).not.toHaveBeenCalled();
  });

  it('reports a completed drag once', () => {
    const node = target();
    const t = timers();
    const onEnd = vi.fn();
    longPressDrag(node, { onHold: vi.fn(), onMove: vi.fn(), onEnd }, t.controls);

    node.dispatchEvent(pointer('pointerdown', 0, 0));
    t.fire();
    node.dispatchEvent(pointer('pointerup', 0, 10));
    expect(onEnd).toHaveBeenCalledWith(false);

    node.dispatchEvent(pointer('pointerup', 0, 10));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('reports a cancelled drag', () => {
    const node = target();
    const t = timers();
    const onEnd = vi.fn();
    longPressDrag(node, { onHold: vi.fn(), onMove: vi.fn(), onEnd }, t.controls);
    node.dispatchEvent(pointer('pointerdown', 0, 0));
    t.fire();
    node.dispatchEvent(pointer('pointercancel', 0, 0));
    expect(onEnd).toHaveBeenCalledWith(true);
  });

  it('detaches cleanly', () => {
    const node = target();
    const t = timers();
    const onHold = vi.fn();
    const stop = longPressDrag(node, { onHold, onMove: vi.fn(), onEnd: vi.fn() }, t.controls);
    stop();
    node.dispatchEvent(pointer('pointerdown', 0, 0));
    t.fire();
    expect(onHold).not.toHaveBeenCalled();
  });
});
