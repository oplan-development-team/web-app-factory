import { describe, expect, it } from 'vitest';
import { PLACE_LABEL_MAX_LENGTH, validateInputs, type RawInputs } from './validation';

function raw(overrides: Partial<RawInputs> = {}): RawInputs {
  return {
    date: '2026-08-21',
    time: '21:30',
    offset: '9',
    lat: '35.6762',
    lon: '139.6503',
    place: '東京',
    showConstellations: true,
    showStarNames: true,
    ...overrides,
  };
}

function errorsFor(overrides: Partial<RawInputs>): string[] {
  const result = validateInputs(raw(overrides));
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.errors.map((e) => e.field);
}

describe('validateInputs', () => {
  it('accepts a well-formed set of values', () => {
    const result = validateInputs(raw());

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual({
      year: 2026,
      month: 8,
      day: 21,
      hour: 21,
      minute: 30,
      utcOffsetHours: 9,
      latitude: 35.6762,
      longitude: 139.6503,
      placeLabel: '東京',
      showConstellations: true,
      showStarNames: true,
    });
  });

  it('carries the display toggles through unchanged', () => {
    const result = validateInputs(raw({ showConstellations: false, showStarNames: false }));

    expect(result.ok && result.value.showConstellations).toBe(false);
    expect(result.ok && result.value.showStarNames).toBe(false);
  });
});

describe('date validation', () => {
  it('rejects an empty date with a prompt to fill it in', () => {
    const result = validateInputs(raw({ date: '' }));

    expect(result.ok).toBe(false);
    expect(result.ok || result.errors[0]?.message).toMatch(/入力してください/);
  });

  // A date that parses but does not exist would otherwise roll silently into
  // the following month and chart the wrong sky (FR-001.4).
  it.each(['2026-02-31', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10', '2026-06-00'])(
    'rejects the non-existent date %s',
    (date) => {
      expect(errorsFor({ date })).toContain('date');
    },
  );

  it('accepts 29 February in a leap year', () => {
    expect(validateInputs(raw({ date: '2024-02-29' })).ok).toBe(true);
  });

  it('rejects 29 February in a common year', () => {
    expect(errorsFor({ date: '2026-02-29' })).toContain('date');
  });

  it('applies the Gregorian century rule', () => {
    expect(validateInputs(raw({ date: '2000-02-29' })).ok).toBe(true);
    expect(errorsFor({ date: '1900-02-29' })).toContain('date');
  });

  it('accepts the ends of the supported year range', () => {
    expect(validateInputs(raw({ date: '0001-01-01' })).ok).toBe(true);
    expect(validateInputs(raw({ date: '9999-12-31' })).ok).toBe(true);
  });

  it('rejects a malformed date string', () => {
    expect(errorsFor({ date: '2026/08/21' })).toContain('date');
    expect(errorsFor({ date: 'yesterday' })).toContain('date');
    expect(errorsFor({ date: '2026-8-2' })).toContain('date');
  });
});

describe('time validation', () => {
  it('accepts midnight and the last minute of the day', () => {
    expect(validateInputs(raw({ time: '00:00' })).ok).toBe(true);
    expect(validateInputs(raw({ time: '23:59' })).ok).toBe(true);
  });

  it('accepts a value that carries seconds', () => {
    const result = validateInputs(raw({ time: '21:30:00' }));

    expect(result.ok && result.value.hour).toBe(21);
  });

  it.each(['24:00', '12:60', '', '9:30', 'noon'])('rejects %s', (time) => {
    expect(errorsFor({ time })).toContain('time');
  });
});

describe('numeric range validation', () => {
  it('accepts the extremes of each range', () => {
    expect(validateInputs(raw({ lat: '90', lon: '180', offset: '14' })).ok).toBe(true);
    expect(validateInputs(raw({ lat: '-90', lon: '-180', offset: '-12' })).ok).toBe(true);
  });

  it('accepts a fractional UTC offset', () => {
    const result = validateInputs(raw({ offset: '5.75' }));

    expect(result.ok && result.value.utcOffsetHours).toBe(5.75);
  });

  it.each([
    ['lat', '90.1'],
    ['lat', '-90.1'],
    ['lon', '180.1'],
    ['lon', '-180.1'],
    ['offset', '15'],
    ['offset', '-13'],
  ])('rejects %s out of range: %s', (field, value) => {
    expect(errorsFor({ [field]: value })).toContain(field);
  });

  it.each(['lat', 'lon', 'offset'] as const)('rejects a non-numeric %s', (field) => {
    expect(errorsFor({ [field]: 'abc' })).toContain(field);
  });

  it.each(['lat', 'lon', 'offset'] as const)('rejects an empty %s', (field) => {
    expect(errorsFor({ [field]: '   ' })).toContain(field);
  });

  it('rejects Infinity', () => {
    expect(errorsFor({ lat: 'Infinity' })).toContain('lat');
  });

  it('distinguishes an empty field from an out-of-range one', () => {
    const empty = validateInputs(raw({ lat: '' }));
    const tooBig = validateInputs(raw({ lat: '120' }));

    expect(!empty.ok && empty.errors[0]?.message).toMatch(/入力してください/);
    expect(!tooBig.ok && tooBig.errors[0]?.message).toMatch(/範囲で入力してください/);
  });
});

describe('error collection', () => {
  // Reporting only the first problem makes the user fix one field, resubmit,
  // and discover the next -- so every broken field is reported at once.
  it('reports every invalid field, not just the first', () => {
    const fields = errorsFor({ date: '', time: '', lat: 'x', lon: '999', offset: '' });

    expect(fields).toEqual(['date', 'time', 'offset', 'lat', 'lon']);
  });

  it('leaves the place label out of validation entirely', () => {
    expect(validateInputs(raw({ place: '' })).ok).toBe(true);
  });
});

describe('place label', () => {
  it('passes the label through as typed', () => {
    const result = validateInputs(raw({ place: 'Reykjavík' }));

    expect(result.ok && result.value.placeLabel).toBe('Reykjavík');
  });

  it('truncates an over-long label rather than rejecting it', () => {
    const result = validateInputs(raw({ place: 'あ'.repeat(80) }));

    expect(result.ok && result.value.placeLabel).toHaveLength(PLACE_LABEL_MAX_LENGTH);
  });

  it('keeps markup as literal text for the renderer to escape', () => {
    const result = validateInputs(raw({ place: '<script>x</script>' }));

    expect(result.ok && result.value.placeLabel).toBe('<script>x</script>');
  });
});
