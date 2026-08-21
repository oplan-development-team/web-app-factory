import type { PosterInputs } from '../types';

/**
 * Input validation, kept as pure string-in / result-out functions.
 *
 * The prototype leaned on `form.reportValidity()`, which fires a native
 * browser bubble on every keystroke and, when it fails, simply returns null so
 * the poster freezes on its last good render with nothing to explain why.
 * Doing the checks here instead makes them testable, lets the UI render its
 * own messages inline (FR-004.2), and keeps the failure explicit (FR-004.3).
 */

export type FieldName = 'date' | 'time' | 'offset' | 'lat' | 'lon';

export interface FieldError {
  field: FieldName;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: PosterInputs }
  | { ok: false; errors: FieldError[] };

/** Raw, unvalidated form values as read straight off the DOM. */
export interface RawInputs {
  date: string;
  time: string;
  offset: string;
  lat: string;
  lon: string;
  place: string;
  showConstellations: boolean;
  showStarNames: boolean;
}

export const LIMITS = {
  latitude: { min: -90, max: 90 },
  longitude: { min: -180, max: 180 },
  utcOffsetHours: { min: -12, max: 14 },
  year: { min: 1, max: 9999 },
} as const;

export const PLACE_LABEL_MAX_LENGTH = 40;

interface ParsedDate {
  year: number;
  month: number;
  day: number;
}

/**
 * Parses an ISO `YYYY-MM-DD` string, rejecting dates that are well-formed but
 * do not exist. `<input type="date">` blocks most of these, but the value can
 * still arrive out of range when the field is populated programmatically or
 * when a browser falls back to a plain text input (FR-001.4).
 */
function parseDate(raw: string): ParsedDate | null {
  const match = /^(\d{1,4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (match === null) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < LIMITS.year.min || year > LIMITS.year.max) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  return { year, month, day };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

interface ParsedTime {
  hour: number;
  minute: number;
}

function parseTime(raw: string): ParsedTime | null {
  // Some browsers append seconds to the value of an <input type="time">.
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(raw.trim());
  if (match === null) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return { hour, minute };
}

interface NumberRange {
  min: number;
  max: number;
}

type NumberOutcome =
  | { ok: true; value: number }
  | { ok: false; reason: 'empty' | 'not-a-number' | 'out-of-range' };

function parseNumberInRange(raw: string, range: NumberRange): NumberOutcome {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, reason: 'empty' };

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { ok: false, reason: 'not-a-number' };
  if (value < range.min || value > range.max) return { ok: false, reason: 'out-of-range' };

  return { ok: true, value };
}

function numberError(
  field: FieldName,
  label: string,
  reason: 'empty' | 'not-a-number' | 'out-of-range',
  range: NumberRange,
  unit: string,
): FieldError {
  switch (reason) {
    case 'empty':
      return { field, message: `${label}を入力してください。` };
    case 'not-a-number':
      return { field, message: `${label}は数値で入力してください。` };
    case 'out-of-range':
      return {
        field,
        message: `${label}は ${range.min} 〜 ${range.max}${unit} の範囲で入力してください。`,
      };
  }
}

/** Validates raw form values, collecting every problem rather than the first. */
export function validateInputs(raw: RawInputs): ValidationResult {
  const errors: FieldError[] = [];

  const date = parseDate(raw.date);
  if (date === null) {
    errors.push({
      field: 'date',
      message:
        raw.date.trim() === ''
          ? '日付を入力してください。'
          : '実在する日付を YYYY-MM-DD の形式で入力してください。',
    });
  }

  const time = parseTime(raw.time);
  if (time === null) {
    errors.push({
      field: 'time',
      message:
        raw.time.trim() === ''
          ? '時刻を入力してください。'
          : '時刻を HH:MM の形式で入力してください。',
    });
  }

  const offset = parseNumberInRange(raw.offset, LIMITS.utcOffsetHours);
  if (!offset.ok) {
    errors.push(
      numberError('offset', 'UTCとの時差', offset.reason, LIMITS.utcOffsetHours, ' 時間'),
    );
  }

  const lat = parseNumberInRange(raw.lat, LIMITS.latitude);
  if (!lat.ok) {
    errors.push(numberError('lat', '緯度', lat.reason, LIMITS.latitude, '°'));
  }

  const lon = parseNumberInRange(raw.lon, LIMITS.longitude);
  if (!lon.ok) {
    errors.push(numberError('lon', '経度', lon.reason, LIMITS.longitude, '°'));
  }

  if (date === null || time === null || !offset.ok || !lat.ok || !lon.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      year: date.year,
      month: date.month,
      day: date.day,
      hour: time.hour,
      minute: time.minute,
      utcOffsetHours: offset.value,
      latitude: lat.value,
      longitude: lon.value,
      placeLabel: raw.place.slice(0, PLACE_LABEL_MAX_LENGTH),
      showConstellations: raw.showConstellations,
      showStarNames: raw.showStarNames,
    },
  };
}
