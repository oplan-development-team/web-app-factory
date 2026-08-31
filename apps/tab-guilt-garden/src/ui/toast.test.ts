import { beforeEach, describe, expect, test } from 'vitest';
import { ToastHost } from './toast';

let host: HTMLElement;
/** Collects scheduled callbacks so tests can run timers deterministically. */
let pending: Array<() => void>;
let toasts: ToastHost;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  pending = [];
  toasts = new ToastHost(host, (fn) => {
    pending.push(fn);
  });
});

function runScheduled(): void {
  const queue = pending;
  pending = [];
  for (const fn of queue) fn();
}

describe('announce (FR-402)', () => {
  test('renders one toast per newly unlocked achievement', () => {
    toasts.announce(['arsonist', 'ghosted']);
    expect(host.querySelectorAll('.toast')).toHaveLength(2);
  });

  test('shows the achievement label and its requirement', () => {
    toasts.announce(['arsonist']);
    expect(host.querySelector('.toast-title')?.textContent).toBe('放火魔');
    expect(host.querySelector('.toast-body')?.textContent).toBe('庭を焼き払う');
  });

  test('announces nothing for an empty list (the common case every tick)', () => {
    toasts.announce([]);
    expect(host.children).toHaveLength(0);
  });

  test('ignores ids that no longer exist in the catalogue', () => {
    toasts.announce(['removed-in-a-later-version']);
    expect(host.children).toHaveLength(0);
  });

  test('is announced politely to assistive tech (FR-602)', () => {
    toasts.announce(['arsonist']);
    expect(host.querySelector('.toast')?.getAttribute('role')).toBe('status');
  });
});

describe('dismissal', () => {
  test('marks the toast as leaving, then removes it', () => {
    toasts.announce(['arsonist']);
    const toast = host.querySelector<HTMLElement>('.toast')!;
    expect(toast.dataset.leaving).toBeUndefined();

    runScheduled(); // lifetime elapsed -> start leaving
    expect(toast.dataset.leaving).toBe('true');

    runScheduled(); // exit animation elapsed -> removed
    expect(host.querySelectorAll('.toast')).toHaveLength(0);
  });

  test('does not linger once every toast has expired', () => {
    toasts.announce(['arsonist', 'ghosted']);
    runScheduled();
    runScheduled();
    expect(host.children).toHaveLength(0);
  });
});

describe('one-shot behaviour (AC-402a)', () => {
  test('a repeated tick with no new unlocks adds nothing', () => {
    toasts.announce(['arsonist']);
    expect(host.querySelectorAll('.toast')).toHaveLength(1);

    // The engine reports newlyUnlocked as empty on subsequent ticks.
    toasts.announce([]);
    toasts.announce([]);
    expect(host.querySelectorAll('.toast')).toHaveLength(1);
  });
});
