import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAppShell } from '../../src/ui/app-shell';
import { clear, el, frameThrottle, setText, toggleAttr } from '../../src/ui/dom';
import { downloadBlob } from '../../src/ui/export';
import { createReel } from '../../src/ui/reel';
import { cssColor } from '../../src/ui/thumb';
import { addShots, initialState, type Shot } from '../../src/ui/store';
import { domFakeFactory } from '../helpers/fake-canvas';

describe('createAppShell', () => {
  it('keeps the status line hidden until something happens', () => {
    const shell = createAppShell();
    const status = shell.root.querySelector('.status') as HTMLElement;
    expect(status.hasAttribute('hidden')).toBe(true);
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('announces messages through a single live region (FR-606)', () => {
    const shell = createAppShell();
    const status = shell.root.querySelector('.status') as HTMLElement;
    shell.setStatus({ tone: 'error', message: '読めませんでした' });
    expect(status.hasAttribute('hidden')).toBe(false);
    expect(status.dataset.tone).toBe('error');
    expect(status.textContent).toBe('読めませんでした');

    shell.setStatus(null);
    expect(status.hasAttribute('hidden')).toBe(true);
  });

  it('flags the drop target while a drag is in progress', () => {
    const shell = createAppShell();
    shell.setDragActive(true);
    expect(shell.root.dataset.dragging).toBe('true');
    shell.setDragActive(false);
    expect(shell.root.dataset.dragging).toBe('false');
  });
});

describe('dom helpers', () => {
  it('omits null and false attributes', () => {
    const node = el('div', { attrs: { 'data-a': null, 'data-b': false, 'data-c': true, 'data-d': 3 } });
    expect(node.hasAttribute('data-a')).toBe(false);
    expect(node.hasAttribute('data-b')).toBe(false);
    expect(node.getAttribute('data-c')).toBe('');
    expect(node.getAttribute('data-d')).toBe('3');
  });

  it('skips empty children and accepts strings', () => {
    const node = el('p', {}, ['hello', null, undefined, false, el('b', { text: '!' })]);
    expect(node.textContent).toBe('hello!');
  });

  it('sets text, title, type and listeners', () => {
    const onClick = vi.fn();
    const node = el('button', { text: 'go', title: 'tip', type: 'submit', on: { click: onClick } });
    node.click();
    expect(node.textContent).toBe('go');
    expect(node.title).toBe('tip');
    expect(node.type).toBe('submit');
    expect(onClick).toHaveBeenCalled();
  });

  it('accepts raw html', () => {
    expect(el('div', { html: '<b>x</b>' }).innerHTML).toBe('<b>x</b>');
  });

  it('empties a node', () => {
    const node = el('div', {}, ['a', el('b', { text: 'c' })]);
    clear(node);
    expect(node.childNodes).toHaveLength(0);
  });

  it('toggles attributes and avoids redundant text writes', () => {
    const node = el('div');
    toggleAttr(node, 'hidden', true);
    expect(node.hasAttribute('hidden')).toBe(true);
    toggleAttr(node, 'hidden', false);
    expect(node.hasAttribute('hidden')).toBe(false);

    setText(node, 'x');
    const before = node.firstChild;
    setText(node, 'x');
    expect(node.firstChild).toBe(before);
    setText(node, 'y');
    expect(node.textContent).toBe('y');
  });

  it('collapses repeated calls into one frame', async () => {
    const fn = vi.fn();
    const throttled = frameThrottle(fn);
    throttled();
    throttled();
    throttled();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(fn).toHaveBeenCalledTimes(1);
    throttled();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('cssColor', () => {
  it('formats the average colour with an alpha', () => {
    const shot = { averageColor: { r: 1, g: 2, b: 3 } } as Shot;
    expect(cssColor(shot, 0.5)).toBe('rgb(1 2 3 / 0.5)');
  });
});

describe('downloadBlob', () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('clicks a temporary anchor and releases the URL', () => {
    const revoke = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = revoke;
    const clicks: string[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      clicks.push(this.download);
    };

    downloadBlob(new Blob(['x']), 'out.png');

    HTMLAnchorElement.prototype.click = originalClick;
    expect(clicks).toEqual(['out.png']);
    expect(revoke).toHaveBeenCalledWith('blob:test');
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });
});

describe('reel reordering', () => {
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

  it('drops a row onto the slot it was dragged to', () => {
    const pending: (() => void)[] = [];
    const onMove = vi.fn();
    const reel = createReel(
      { onMove, onRemove: vi.fn(), renderSeam: () => el('div') },
      {
        factory: domFakeFactory(),
        pixelRatio: 1,
        longPress: {
          setTimer: (fn) => {
            pending.push(fn);
            return pending.length;
          },
          clearTimer: () => {},
        },
      },
    );
    document.body.append(reel.element);
    reel.update(addShots(initialState(), [shot('a'), shot('b'), shot('c')]).state);

    const row = reel.element.querySelector('.reel__shot') as HTMLElement;
    Object.assign(row, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true,
    });
    const send = (type: string, y: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
      Object.assign(event, { pointerId: 1, button: 0, clientX: 0, clientY: y });
      row.dispatchEvent(event);
    };

    send('pointerdown', 0);
    pending.forEach((fn) => fn());
    expect(row.classList.contains('reel__shot--dragging')).toBe(true);

    send('pointermove', 230);
    expect(row.style.transform).toBe('translateY(230px)');

    send('pointerup', 230);
    expect(row.classList.contains('reel__shot--dragging')).toBe(false);
    expect(onMove).toHaveBeenCalledWith(0, 2);
  });

  it('leaves the order alone when the drag ends where it started', () => {
    const pending: (() => void)[] = [];
    const onMove = vi.fn();
    const reel = createReel(
      { onMove, onRemove: vi.fn(), renderSeam: () => el('div') },
      {
        factory: domFakeFactory(),
        pixelRatio: 1,
        longPress: {
          setTimer: (fn) => {
            pending.push(fn);
            return pending.length;
          },
          clearTimer: () => {},
        },
      },
    );
    document.body.append(reel.element);
    reel.update(addShots(initialState(), [shot('a'), shot('b')]).state);

    const row = reel.element.querySelector('.reel__shot') as HTMLElement;
    Object.assign(row, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true,
    });
    const send = (type: string, y: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
      Object.assign(event, { pointerId: 1, button: 0, clientX: 0, clientY: y });
      row.dispatchEvent(event);
    };

    send('pointerdown', 0);
    pending.forEach((fn) => fn());
    send('pointermove', 4);
    send('pointerup', 4);
    expect(onMove).not.toHaveBeenCalled();
  });
});
