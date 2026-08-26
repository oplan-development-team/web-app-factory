import { STORAGE_KEY_GRAVEYARD, STORAGE_KEY_PLANTS } from './constants';
import type { GraveyardEntry, PlantRecord } from './types';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadPlants(): PlantRecord[] {
  return safeParse<PlantRecord[]>(localStorage.getItem(STORAGE_KEY_PLANTS), []);
}

export function savePlants(plants: PlantRecord[]): void {
  localStorage.setItem(STORAGE_KEY_PLANTS, JSON.stringify(plants));
}

export function loadGraveyard(): GraveyardEntry[] {
  return safeParse<GraveyardEntry[]>(localStorage.getItem(STORAGE_KEY_GRAVEYARD), []);
}

export function saveGraveyard(entries: GraveyardEntry[]): void {
  localStorage.setItem(STORAGE_KEY_GRAVEYARD, JSON.stringify(entries));
}

export function clearAll(): void {
  localStorage.removeItem(STORAGE_KEY_PLANTS);
  localStorage.removeItem(STORAGE_KEY_GRAVEYARD);
}
