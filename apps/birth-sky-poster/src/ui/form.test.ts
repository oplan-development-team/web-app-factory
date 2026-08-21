// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { mountAppMarkup } from '../test-utils';
import {
  applyFieldErrors,
  clearFieldErrors,
  fillDefaultValues,
  queryFormElements,
  readInputs,
  readRawInputs,
  type FormElements,
} from './form';

let el: FormElements;

beforeEach(() => {
  mountAppMarkup();
  el = queryFormElements(document);
});

describe('queryFormElements', () => {
  it('resolves every control the app depends on from the shipped markup', () => {
    expect(el.form.id).toBe('input-form');
    expect(el.date.type).toBe('date');
    expect(el.constellations.type).toBe('checkbox');
    expect(el.starNames.type).toBe('checkbox');
    expect(Object.keys(el.errors)).toEqual(['date', 'time', 'offset', 'lat', 'lon']);
  });

  it('suppresses native validation so the app can render its own messages', () => {
    expect(el.form.hasAttribute('novalidate')).toBe(true);
  });
});

describe('fillDefaultValues', () => {
  it('seeds the form from the given instant', () => {
    fillDefaultValues(el, new Date(2026, 7, 21, 9, 5));

    expect(el.date.value).toBe('2026-08-21');
    expect(el.time.value).toBe('09:05');
    expect(el.place.value).toBe('東京');
  });

  it('produces values the validator accepts', () => {
    fillDefaultValues(el);

    expect(readInputs(el).ok).toBe(true);
  });
});

describe('readRawInputs', () => {
  it('reads the controls without interpreting them', () => {
    fillDefaultValues(el, new Date(2026, 7, 21, 9, 5));
    el.place.value = '  Reykjavík  ';
    el.starNames.checked = false;

    expect(readRawInputs(el)).toMatchObject({
      date: '2026-08-21',
      lat: '35.6762',
      place: '  Reykjavík  ',
      showConstellations: true,
      showStarNames: false,
    });
  });

  // A number input reports '' rather than the raw characters when what the
  // user typed is not a valid number, so garbage in a coordinate field
  // surfaces to the validator as an empty value, not as a malformed one.
  it('reports an unparseable number input as empty', () => {
    fillDefaultValues(el);
    el.lat.value = 'not-a-number';

    expect(readRawInputs(el).lat).toBe('');

    const result = readInputs(el);
    expect(!result.ok && result.errors.map((e) => e.field)).toEqual(['lat']);
  });
});

describe('applyFieldErrors', () => {
  it('marks the field invalid and links the message for assistive tech', () => {
    applyFieldErrors(el, [{ field: 'lat', message: '緯度は -90 〜 90° の範囲で入力してください。' }]);

    expect(el.lat.getAttribute('aria-invalid')).toBe('true');
    expect(el.lat.getAttribute('aria-describedby')).toBe('error-lat');
    expect(el.errors.lat.textContent).toBe('緯度は -90 〜 90° の範囲で入力してください。');
    expect(el.errors.lat.hidden).toBe(false);
  });

  it('leaves untouched fields clean', () => {
    applyFieldErrors(el, [{ field: 'lat', message: 'bad' }]);

    expect(el.lon.hasAttribute('aria-invalid')).toBe(false);
    expect(el.errors.lon.hidden).toBe(true);
  });

  it('renders a message for every reported field', () => {
    applyFieldErrors(el, [
      { field: 'date', message: 'a' },
      { field: 'time', message: 'b' },
      { field: 'offset', message: 'c' },
    ]);

    expect(el.errors.date.textContent).toBe('a');
    expect(el.errors.time.textContent).toBe('b');
    expect(el.errors.offset.textContent).toBe('c');
  });

  // A stale message left behind after the input was corrected is worse than
  // no message at all, so applying a new set must clear the previous one.
  it('replaces the previous set rather than accumulating', () => {
    applyFieldErrors(el, [{ field: 'lat', message: 'first' }]);
    applyFieldErrors(el, [{ field: 'lon', message: 'second' }]);

    expect(el.errors.lat.textContent).toBe('');
    expect(el.errors.lat.hidden).toBe(true);
    expect(el.lat.hasAttribute('aria-invalid')).toBe(false);
    expect(el.errors.lon.textContent).toBe('second');
  });

  it('renders markup in a message as text', () => {
    applyFieldErrors(el, [{ field: 'lat', message: '<b>x</b>' }]);

    expect(el.errors.lat.children).toHaveLength(0);
    expect(el.errors.lat.textContent).toBe('<b>x</b>');
  });
});

describe('clearFieldErrors', () => {
  it('removes every decoration', () => {
    applyFieldErrors(el, [
      { field: 'date', message: 'a' },
      { field: 'lat', message: 'b' },
    ]);

    clearFieldErrors(el);

    for (const field of ['date', 'time', 'offset', 'lat', 'lon'] as const) {
      expect(el[field].hasAttribute('aria-invalid')).toBe(false);
      expect(el.errors[field].hidden).toBe(true);
    }
  });
});

describe('readInputs', () => {
  it('reports the invalid fields when the form is broken', () => {
    fillDefaultValues(el);
    el.date.value = '2026-02-31';
    el.lon.value = '999';

    const result = readInputs(el);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.map((e) => e.field)).toEqual(['date', 'lon']);
  });
});
