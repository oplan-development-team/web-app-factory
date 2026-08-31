import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryStorage, GardenStore } from '../infra/storage';
import { hideIntro, isIntroVisible, renderIntro } from './intro';

let el: HTMLElement;
beforeEach(() => {
  el = document.createElement('section');
  el.hidden = true;
  document.body.appendChild(el);
});

describe('renderIntro (FR-500)', () => {
  test('reveals the panel and renders three steps', () => {
    renderIntro(el, { onDismiss: vi.fn() });
    expect(el.hidden).toBe(false);
    expect(el.querySelectorAll('.intro-step')).toHaveLength(3);
  });

  test('each step explains one part of the core loop', () => {
    renderIntro(el, { onDismiss: vi.fn() });
    const text = el.textContent ?? '';
    expect(text).toContain('タブを開くと苗が生える');
    expect(text).toContain('放置するとしおれる');
    expect(text).toContain('閉じると墓標が残る');
  });

  test('illustrates each step with real plant artwork', () => {
    renderIntro(el, { onDismiss: vi.fn() });
    const arts = el.querySelectorAll('.intro-step-art svg');
    expect(arts).toHaveLength(3);
  });

  test('tags the artwork with stages so it is coloured like the real garden', () => {
    renderIntro(el, { onDismiss: vi.fn() });
    const stages = [...el.querySelectorAll<HTMLElement>('.intro-step-art')].map(
      (a) => a.dataset.stage,
    );
    expect(stages).toEqual(['leaf', 'wilt', 'dead']);
  });

  test('artwork is tinted without joining the .plant-card namespace', () => {
    // Reusing .plant-card here made every `.plant-card` query in the app (and in
    // verification scripts) count the three legend illustrations as real plants.
    renderIntro(el, { onDismiss: vi.fn() });
    for (const art of el.querySelectorAll('.intro-step-art')) {
      expect(art.classList.contains('stage-tint')).toBe(true);
      expect(art.classList.contains('plant-card')).toBe(false);
    }
    expect(el.querySelectorAll('.plant-card')).toHaveLength(0);
  });

  test('states that nothing leaves this browser', () => {
    renderIntro(el, { onDismiss: vi.fn() });
    expect(el.querySelector('.intro-note')?.textContent).toContain('このブラウザ');
  });

  test('is not a blocking modal (AC-500a)', () => {
    renderIntro(el, { onDismiss: vi.fn() });
    expect(el.querySelector('.modal-overlay')).toBeNull();
    expect(el.getAttribute('role')).not.toBe('dialog');
  });

  test('re-rendering does not duplicate the steps', () => {
    renderIntro(el, { onDismiss: vi.fn() });
    renderIntro(el, { onDismiss: vi.fn() });
    expect(el.querySelectorAll('.intro-step')).toHaveLength(3);
  });
});

describe('dismissing (AC-500b)', () => {
  test('hides the panel and notifies the caller', () => {
    const onDismiss = vi.fn();
    renderIntro(el, { onDismiss });

    el.querySelector<HTMLButtonElement>('.intro-foot button')!.click();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(el.hidden).toBe(true);
    expect(el.querySelectorAll('.intro-step')).toHaveLength(0);
  });

  test('hideIntro and isIntroVisible reflect the panel state', () => {
    expect(isIntroVisible(el)).toBe(false);
    renderIntro(el, { onDismiss: vi.fn() });
    expect(isIntroVisible(el)).toBe(true);
    hideIntro(el);
    expect(isIntroVisible(el)).toBe(false);
  });
});

describe('persistence of the seen flag (AC-500b / AC-500d)', () => {
  test('dismissing records the flag so it does not auto-show again', () => {
    const store = new GardenStore(createMemoryStorage());
    expect(store.hasSeenIntro()).toBe(false);

    renderIntro(el, { onDismiss: () => store.markIntroSeen() });
    el.querySelector<HTMLButtonElement>('.intro-foot button')!.click();

    expect(store.hasSeenIntro()).toBe(true);
  });

  test('burning the garden does not make the intro reappear (AC-500d)', () => {
    const store = new GardenStore(createMemoryStorage());
    store.markIntroSeen();
    store.clearGarden();
    expect(store.hasSeenIntro()).toBe(true);
  });

  test('even the full wipe keeps the intro dismissed', () => {
    // clearEverything erases the garden and the lifetime ledger, but the intro
    // flag is a UI preference rather than progress -- re-explaining the app to
    // someone who already read it would just be noise.
    const store = new GardenStore(createMemoryStorage());
    store.markIntroSeen();
    store.clearEverything();
    expect(store.hasSeenIntro()).toBe(true);
  });
});
