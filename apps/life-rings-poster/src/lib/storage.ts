import type { PosterData } from './types';

const STORAGE_KEY = 'life-rings-poster:v1';

export function loadPosterData(): PosterData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return sanitize(parsed);
  } catch {
    return null;
  }
}

export function savePosterData(data: PosterData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private mode / quota) — silently skip persistence.
  }
}

function sanitize(raw: any): PosterData {
  const events = Array.isArray(raw.events)
    ? raw.events
        .filter((e: any) => e && typeof e === 'object')
        .map((e: any, i: number) => ({
          id: typeof e.id === 'string' ? e.id : `ev-${i}-${Math.random().toString(36).slice(2)}`,
          year: Number.isFinite(e.year) ? Math.round(e.year) : new Date().getFullYear(),
          label: typeof e.label === 'string' ? e.label.slice(0, 120) : '',
          major: Boolean(e.major),
        }))
    : [];

  const woodTone = raw.woodTone === 'walnut' || raw.woodTone === 'ash' ? raw.woodTone : 'oak';

  return {
    birthYear: Number.isFinite(raw.birthYear) ? Math.round(raw.birthYear) : null,
    endYear: Number.isFinite(raw.endYear) ? Math.round(raw.endYear) : new Date().getFullYear(),
    title: typeof raw.title === 'string' ? raw.title.slice(0, 80) : '',
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle.slice(0, 120) : '',
    woodTone,
    events,
  };
}
