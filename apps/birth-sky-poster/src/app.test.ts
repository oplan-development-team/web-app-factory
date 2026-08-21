// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RENDER_DEBOUNCE_MS, createApp, type AppHandle } from './app';
import { mountAppMarkup } from './test-utils';
import { requireElement } from './ui/dom';

let app: AppHandle;

function input(id: string): HTMLInputElement {
  return requireElement(document, id, 'input');
}

function button(id: string): HTMLButtonElement {
  return requireElement(document, id, 'button');
}

function frame(): HTMLDivElement {
  return requireElement(document, 'poster-frame', 'div');
}

function poster(): SVGSVGElement | null {
  return requireElement(document, 'poster-mount', 'div').querySelector('svg.poster-root');
}

function fireInput(el: HTMLElement): void {
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  vi.useFakeTimers();
  mountAppMarkup();
  app = createApp(document);
});

afterEach(() => {
  app.destroy();
  vi.useRealTimers();
});

describe('initial render', () => {
  it('reaches the ready state with a poster mounted', () => {
    expect(app.state).toBe('ready');
    expect(frame().dataset['state']).toBe('ready');
    expect(poster()).not.toBeNull();
  });

  it('seeds the form with values that produce a chart', () => {
    expect(input('input-place').value).toBe('東京');
    expect(poster()?.querySelectorAll('.stars circle').length).toBeGreaterThan(50);
  });

  it('enables the export buttons once a poster exists', () => {
    expect(button('export-png').disabled).toBe(false);
    expect(button('export-svg').disabled).toBe(false);
  });
});

describe('debounced re-render', () => {
  it('waits for the debounce before recomputing', () => {
    const before = poster();

    input('input-lat').value = '-33.8688';
    fireInput(input('input-lat'));

    expect(poster()).toBe(before);

    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);
    expect(poster()).not.toBe(before);
  });

  it('collapses a burst of keystrokes into a single render', () => {
    const lat = input('input-lat');

    for (const value of ['1', '12', '12.3', '12.34']) {
      lat.value = value;
      fireInput(lat);
      vi.advanceTimersByTime(RENDER_DEBOUNCE_MS / 4);
    }
    const midway = poster();
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);

    expect(poster()).not.toBe(midway);
  });

  it('shows a different sky for the southern hemisphere', () => {
    const northern = poster()?.querySelectorAll('.stars circle').length;

    input('input-lat').value = '-33.8688';
    fireInput(input('input-lat'));
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);

    const labels = [...(poster()?.querySelectorAll('.star-label') ?? [])].map((n) => n.textContent);
    expect(labels).toContain('Canopus');
    expect(poster()?.querySelectorAll('.stars circle').length).not.toBe(northern);
  });
});

describe('invalid input', () => {
  beforeEach(() => {
    input('input-date').value = '2026-02-31';
    fireInput(input('input-date'));
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);
  });

  it('moves to the invalid state', () => {
    expect(app.state).toBe('invalid');
    expect(frame().dataset['state']).toBe('invalid');
  });

  it('explains what is wrong instead of freezing silently', () => {
    expect(requireElement(document, 'poster-overlay-title', 'p').textContent).toBe(
      '入力を確認してください',
    );
    expect(requireElement(document, 'poster-overlay-list', 'ul').children.length).toBe(1);
    expect(requireElement(document, 'error-date', 'p').hidden).toBe(false);
  });

  it('disables the export buttons', () => {
    expect(button('export-png').disabled).toBe(true);
    expect(button('export-svg').disabled).toBe(true);
  });

  it('recovers as soon as the input is corrected', () => {
    input('input-date').value = '2026-03-01';
    fireInput(input('input-date'));
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);

    expect(app.state).toBe('ready');
    expect(requireElement(document, 'error-date', 'p').hidden).toBe(true);
    expect(button('export-png').disabled).toBe(false);
  });
});

describe('display toggles', () => {
  it('removes the constellation lines when unchecked', () => {
    expect(poster()?.querySelectorAll('.constellation-lines line').length).toBeGreaterThan(0);

    const toggle = input('input-constellations');
    toggle.checked = false;
    fireInput(toggle);
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);

    expect(poster()?.querySelectorAll('.constellation-lines line').length).toBe(0);
  });

  it('removes the star names when unchecked but keeps the dots', () => {
    expect(poster()?.querySelectorAll('.star-label').length).toBeGreaterThan(0);

    const toggle = input('input-star-names');
    toggle.checked = false;
    fireInput(toggle);
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);

    expect(poster()?.querySelectorAll('.star-label').length).toBe(0);
    expect(poster()?.querySelectorAll('.stars circle').length).toBeGreaterThan(50);
  });
});

describe('poster text', () => {
  it('regenerates the date and place lines from the form while untouched', () => {
    input('input-place').value = 'reykjavik';
    input('input-date').value = '1987-12-05';
    fireInput(input('input-place'));
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);

    expect(document.getElementById('poster-editable-place')?.textContent).toBe('REYKJAVIK');
    expect(document.getElementById('poster-editable-date')?.textContent).toBe('1987.12.05');
  });

  it('falls back to a placeholder when no place is given', () => {
    input('input-place').value = '';
    fireInput(input('input-place'));
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);

    expect(document.getElementById('poster-editable-place')?.textContent).toBe(
      'UNSPECIFIED LOCATION',
    );
  });

  it('keeps the reset control disabled until something is edited', () => {
    expect(button('reset-text').disabled).toBe(true);
  });
});

describe('form submission', () => {
  // A form whose fields are all single-line inputs submits on Enter, which
  // would reload the page and throw away everything the user had entered.
  it('does not navigate when the form is submitted', () => {
    const event = new Event('submit', { bubbles: true, cancelable: true });

    requireElement(document, 'input-form', 'form').dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});

describe('destroy', () => {
  it('cancels a pending render', () => {
    const before = poster();

    input('input-lat').value = '10';
    fireInput(input('input-lat'));
    app.destroy();
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS * 4);

    expect(poster()).toBe(before);
  });
});
