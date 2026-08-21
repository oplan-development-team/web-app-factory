// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RENDER_DEBOUNCE_MS, createApp, type AppHandle } from './app';
import { mountAppMarkup } from './test-utils';
import { requireElement } from './ui/dom';

const exportPngFile = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<void>>());
const exportSvgFile = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<void>>());
const requestCurrentPosition = vi.hoisted(() =>
  vi.fn<() => Promise<{ latitude: number; longitude: number }>>(),
);

vi.mock('./render/exportImage', () => ({ exportPngFile, exportSvgFile }));
vi.mock('./ui/geolocation', () => ({ requestCurrentPosition }));

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

function status(): HTMLParagraphElement {
  return requireElement(document, 'status-region', 'p');
}

beforeEach(() => {
  vi.useFakeTimers();
  exportPngFile.mockReset().mockResolvedValue(undefined);
  exportSvgFile.mockReset().mockResolvedValue(undefined);
  requestCurrentPosition.mockReset().mockResolvedValue({ latitude: 0, longitude: 0 });
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

describe('manual text overrides', () => {
  function editTitle(value: string): void {
    const title = document.getElementById('poster-editable-title')!;
    title.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const editor = document.querySelector<HTMLInputElement>('input.inline-edit-input')!;
    editor.value = value;
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  it('survives a re-render triggered by an unrelated field', () => {
    editTitle('OUR NIGHT');

    input('input-lat').value = '51.5074';
    fireInput(input('input-lat'));
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);

    expect(document.getElementById('poster-editable-title')?.textContent).toBe('OUR NIGHT');
  });

  // Once the date line is hand-written it must stop tracking the form, or the
  // user's wording is silently overwritten the next time they nudge a field.
  it('stops regenerating an edited date line from the form', () => {
    const dateNode = document.getElementById('poster-editable-date')!;
    dateNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const editor = document.querySelector<HTMLInputElement>('input.inline-edit-input')!;
    editor.value = 'THE LONGEST NIGHT';
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    input('input-date').value = '1999-01-01';
    fireInput(input('input-date'));
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);

    expect(document.getElementById('poster-editable-date')?.textContent).toBe('THE LONGEST NIGHT');
  });

  it('enables the reset control once a text has been edited', () => {
    editTitle('OUR NIGHT');

    expect(button('reset-text').disabled).toBe(false);
  });

  it('restores the generated wording on reset', () => {
    editTitle('OUR NIGHT');

    button('reset-text').click();

    expect(document.getElementById('poster-editable-title')?.textContent).toBe('STAR CHART');
    expect(button('reset-text').disabled).toBe(true);
  });

  it('resumes tracking the form after a reset', () => {
    editTitle('OUR NIGHT');
    button('reset-text').click();

    input('input-place').value = 'oslo';
    fireInput(input('input-place'));
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);

    expect(document.getElementById('poster-editable-place')?.textContent).toBe('OSLO');
  });

  it('confirms the reset in the status region', () => {
    editTitle('OUR NIGHT');
    button('reset-text').click();

    const status = requireElement(document, 'status-region', 'p');
    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain('再生成');
  });

  it('closes any open editor when the poster is rebuilt', () => {
    document.getElementById('poster-editable-title')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(document.querySelector('.inline-edit-input')).not.toBeNull();

    input('input-lat').value = '10';
    fireInput(input('input-lat'));
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);

    expect(document.querySelector('.inline-edit-input')).toBeNull();
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

describe('export', () => {
  function select(): HTMLSelectElement {
    return requireElement(document, 'png-scale', 'select');
  }

  it('passes the chosen scale through to the rasterizer', async () => {
    select().value = '4';
    button('export-png').click();
    await vi.runAllTimersAsync();

    expect(exportPngFile).toHaveBeenCalledWith(expect.anything(), expect.any(String), 4);
  });

  it('defaults to the 2x preset', () => {
    expect(select().value).toBe('2');
  });

  // A filename that only says "birth-sky-poster" collides for every chart the
  // user saves; the place and date make each download self-describing.
  it('names the file after the place and the charted date', async () => {
    input('input-place').value = 'Reykjavik';
    input('input-date').value = '1987-12-05';
    fireInput(input('input-place'));
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);

    button('export-svg').click();
    await vi.runAllTimersAsync();

    expect(exportSvgFile).toHaveBeenCalledWith(
      expect.anything(),
      'birth-sky-poster_reykjavik_19871205.svg',
    );
  });

  it('falls back to a generic slug when the place has no ASCII characters', async () => {
    input('input-place').value = '東京';
    fireInput(input('input-place'));
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);

    button('export-png').click();
    await vi.runAllTimersAsync();

    expect(exportPngFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('birth-sky-poster_chart_'),
      expect.any(Number),
    );
  });

  it('marks the button busy while the export runs', async () => {
    let release: () => void = () => {};
    exportPngFile.mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));

    button('export-png').click();
    await Promise.resolve();

    expect(button('export-png').disabled).toBe(true);
    expect(button('export-png').getAttribute('aria-busy')).toBe('true');
    expect(status().textContent).toContain('書き出しています');

    release();
    await vi.runAllTimersAsync();

    expect(button('export-png').disabled).toBe(false);
    expect(button('export-png').hasAttribute('aria-busy')).toBe(false);
  });

  it('confirms success in the status region', async () => {
    button('export-svg').click();
    await vi.runAllTimersAsync();

    expect(status().textContent).toBe('SVGを書き出しました。');
    expect(status().dataset['tone']).toBe('success');
  });

  // The prototype used window.alert here, which blocks the page and cannot be
  // read by anything but a sighted user dismissing a modal.
  it('surfaces a failure in the status region rather than an alert', async () => {
    exportPngFile.mockRejectedValue(new Error('この解像度ではPNGを生成できませんでした。'));

    button('export-png').click();
    await vi.runAllTimersAsync();

    expect(status().textContent).toBe('この解像度ではPNGを生成できませんでした。');
    expect(status().dataset['tone']).toBe('error');
    expect(status().getAttribute('role')).toBe('alert');
  });

  it('re-enables the button after a failure', async () => {
    exportPngFile.mockRejectedValue(new Error('boom'));

    button('export-png').click();
    await vi.runAllTimersAsync();

    expect(button('export-png').disabled).toBe(false);
  });

  it('does not attempt an export while the input is invalid', async () => {
    input('input-lat').value = '999';
    fireInput(input('input-lat'));
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);

    button('export-png').click();
    await vi.runAllTimersAsync();

    expect(exportPngFile).not.toHaveBeenCalled();
  });
});

describe('geolocation', () => {
  it('fills the coordinate fields and re-renders', async () => {
    requestCurrentPosition.mockResolvedValue({ latitude: 64.1466, longitude: -21.9426 });

    button('geolocate-btn').click();
    await vi.runAllTimersAsync();

    expect(input('input-lat').value).toBe('64.1466');
    expect(input('input-lon').value).toBe('-21.9426');
    expect(status().dataset['tone']).toBe('success');
  });

  it('marks the button busy while locating', async () => {
    let release: (value: { latitude: number; longitude: number }) => void = () => {};
    requestCurrentPosition.mockImplementation(() => new Promise((resolve) => (release = resolve)));

    button('geolocate-btn').click();
    await Promise.resolve();

    expect(button('geolocate-btn').disabled).toBe(true);
    expect(button('geolocate-btn').getAttribute('aria-busy')).toBe('true');

    release({ latitude: 0, longitude: 0 });
    await vi.runAllTimersAsync();

    expect(button('geolocate-btn').disabled).toBe(false);
  });

  it('reports a denied permission and leaves the fields alone', async () => {
    const before = input('input-lat').value;
    requestCurrentPosition.mockRejectedValue(
      new Error('位置情報の利用が許可されませんでした。緯度・経度を手入力してください。'),
    );

    button('geolocate-btn').click();
    await vi.runAllTimersAsync();

    expect(status().dataset['tone']).toBe('error');
    expect(status().textContent).toContain('許可されませんでした');
    expect(input('input-lat').value).toBe(before);
    expect(button('geolocate-btn').disabled).toBe(false);
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
