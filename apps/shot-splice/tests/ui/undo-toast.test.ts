import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createUndoToast } from '../../src/ui/undo-toast';

const $ = (root: HTMLElement, selector: string) => root.querySelector(selector) as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function build(durationMs?: number) {
  const onUndo = vi.fn();
  const toast = createUndoToast({ onUndo }, durationMs === undefined ? {} : { durationMs });
  document.body.append(toast.element);
  return { toast, onUndo };
}

describe('createUndoToast', () => {
  it('stays hidden until shown', () => {
    const { toast } = build();
    expect(toast.element.hasAttribute('hidden')).toBe(true);
  });

  it('shows the given message', () => {
    const { toast } = build();
    toast.show('a.png を削除しました。');
    expect(toast.element.hasAttribute('hidden')).toBe(false);
    expect($(toast.element, '.undo-toast__message').textContent).toBe('a.png を削除しました。');
  });

  it('runs the undo callback and hides itself when the action is clicked', () => {
    const { toast, onUndo } = build();
    toast.show('a.png を削除しました。');
    $(toast.element, '.undo-toast__action').click();
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(toast.element.hasAttribute('hidden')).toBe(true);
  });

  it('dismisses itself on its own after a few seconds', () => {
    const { toast, onUndo } = build(4000);
    toast.show('a.png を削除しました。');
    vi.advanceTimersByTime(3999);
    expect(toast.element.hasAttribute('hidden')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(toast.element.hasAttribute('hidden')).toBe(true);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('restarts the timer when shown again before it clears', () => {
    const { toast } = build(4000);
    toast.show('a.png を削除しました。');
    vi.advanceTimersByTime(3000);
    toast.show('b.png を削除しました。');
    vi.advanceTimersByTime(3000);
    expect(toast.element.hasAttribute('hidden')).toBe(false);
    expect($(toast.element, '.undo-toast__message').textContent).toBe('b.png を削除しました。');
    vi.advanceTimersByTime(1000);
    expect(toast.element.hasAttribute('hidden')).toBe(true);
  });

  it('can be dismissed externally without affecting later shows', () => {
    const { toast } = build(4000);
    toast.show('a.png を削除しました。');
    toast.dismiss();
    expect(toast.element.hasAttribute('hidden')).toBe(true);
    toast.show('b.png を削除しました。');
    expect(toast.element.hasAttribute('hidden')).toBe(false);
    vi.advanceTimersByTime(4000);
    expect(toast.element.hasAttribute('hidden')).toBe(true);
  });
});
