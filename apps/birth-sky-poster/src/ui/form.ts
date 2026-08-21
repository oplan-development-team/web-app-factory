import type { PosterInputs } from '../types';

export interface FormElements {
  form: HTMLFormElement;
  date: HTMLInputElement;
  time: HTMLInputElement;
  offset: HTMLInputElement;
  lat: HTMLInputElement;
  lon: HTMLInputElement;
  place: HTMLInputElement;
  constellations: HTMLInputElement;
}

export function queryFormElements(): FormElements {
  const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  return {
    form: byId<HTMLFormElement>('input-form'),
    date: byId<HTMLInputElement>('input-date'),
    time: byId<HTMLInputElement>('input-time'),
    offset: byId<HTMLInputElement>('input-offset'),
    lat: byId<HTMLInputElement>('input-lat'),
    lon: byId<HTMLInputElement>('input-lon'),
    place: byId<HTMLInputElement>('input-place'),
    constellations: byId<HTMLInputElement>('input-constellations'),
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
  };
}
