import type { PosterInputs } from '../types';
import { requireElement } from './dom';

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
}

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
  };
}

/** Pre-fills the form with a sensible starting point (now, browser-inferred UTC offset, Tokyo). */
export function fillDefaultValues(el: FormElements): void {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  el.date.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  el.time.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  el.offset.value = String(-now.getTimezoneOffset() / 60);
  el.lat.value = '35.6762';
  el.lon.value = '139.6503';
  el.place.value = '東京';
}

/** Reads and validates the form. Returns null (and shows native validity UI) if invalid. */
export function readInputs(el: FormElements): PosterInputs | null {
  if (!el.form.reportValidity()) return null;

  const [year = NaN, month = NaN, day = NaN] = el.date.value.split('-').map(Number);
  const [hour = NaN, minute = NaN] = el.time.value.split(':').map(Number);
  const utcOffsetHours = Number(el.offset.value);
  const latitude = Number(el.lat.value);
  const longitude = Number(el.lon.value);

  if (
    [year, month, day, hour, minute, utcOffsetHours, latitude, longitude].some((n) => Number.isNaN(n))
  ) {
    return null;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return {
    year,
    month,
    day,
    hour,
    minute,
    utcOffsetHours,
    latitude,
    longitude,
    placeLabel: el.place.value,
    showConstellations: el.constellations.checked,
    showStarNames: el.starNames.checked,
  };
}
