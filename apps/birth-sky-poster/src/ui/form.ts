import { requireElement } from './dom';
import {
  validateInputs,
  type FieldError,
  type FieldName,
  type RawInputs,
  type ValidationResult,
} from './validation';

export interface FormElements {
  form: HTMLFormElement;
  date: HTMLInputElement;
  time: HTMLInputElement;
  offset: HTMLInputElement;
  lat: HTMLInputElement;
  lon: HTMLInputElement;
  place: HTMLInputElement;
  constellations: HTMLInputElement;
  starNames: HTMLInputElement;
  errors: Record<FieldName, HTMLParagraphElement>;
}

/** Inputs that can carry a validation error, in the order they appear. */
const VALIDATED_FIELDS: readonly FieldName[] = ['date', 'time', 'offset', 'lat', 'lon'];

export function queryFormElements(doc: Document): FormElements {
  return {
    form: requireElement(doc, 'input-form', 'form'),
    date: requireElement(doc, 'input-date', 'input'),
    time: requireElement(doc, 'input-time', 'input'),
    offset: requireElement(doc, 'input-offset', 'input'),
    lat: requireElement(doc, 'input-lat', 'input'),
    lon: requireElement(doc, 'input-lon', 'input'),
    place: requireElement(doc, 'input-place', 'input'),
    constellations: requireElement(doc, 'input-constellations', 'input'),
    starNames: requireElement(doc, 'input-star-names', 'input'),
    errors: {
      date: requireElement(doc, 'error-date', 'p'),
      time: requireElement(doc, 'error-time', 'p'),
      offset: requireElement(doc, 'error-offset', 'p'),
      lat: requireElement(doc, 'error-lat', 'p'),
      lon: requireElement(doc, 'error-lon', 'p'),
    },
  };
}

/** Pre-fills the form with a sensible starting point: now, here-ish, Tokyo. */
export function fillDefaultValues(el: FormElements, now = new Date()): void {
  const pad = (n: number) => n.toString().padStart(2, '0');

  el.date.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  el.time.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  // getTimezoneOffset is minutes *behind* UTC, so the sign is inverted.
  el.offset.value = String(-now.getTimezoneOffset() / 60);
  el.lat.value = '35.6762';
  el.lon.value = '139.6503';
  el.place.value = '東京';
}

/** Reads the form as raw strings, without interpreting them. */
export function readRawInputs(el: FormElements): RawInputs {
  return {
    date: el.date.value,
    time: el.time.value,
    offset: el.offset.value,
    lat: el.lat.value,
    lon: el.lon.value,
    place: el.place.value,
    showConstellations: el.constellations.checked,
    showStarNames: el.starNames.checked,
  };
}

export function readInputs(el: FormElements): ValidationResult {
  return validateInputs(readRawInputs(el));
}

/**
 * Reflects validation errors onto the form.
 *
 * Each message goes into a sibling <p> that the input points at via
 * aria-describedby, so a screen reader announces the reason together with the
 * field rather than leaving the user to infer it from a red underline
 * (FR-004.2, NFR-005.4).
 */
export function applyFieldErrors(el: FormElements, errors: readonly FieldError[]): void {
  const byField = new Map(errors.map((error) => [error.field, error.message]));

  for (const field of VALIDATED_FIELDS) {
    const input = el[field];
    const messageEl = el.errors[field];
    const message = byField.get(field);

    if (message === undefined) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      messageEl.textContent = '';
      messageEl.hidden = true;
      continue;
    }

    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', messageEl.id);
    messageEl.textContent = message;
    messageEl.hidden = false;
  }
}

/** Removes every error decoration from the form. */
export function clearFieldErrors(el: FormElements): void {
  applyFieldErrors(el, []);
}
