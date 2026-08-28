const STORAGE_KEY = 'deadline-departure-board:deadlines:v1';

export function loadDeadlines() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (d) => d && typeof d.id === 'string' && typeof d.title === 'string' && typeof d.dueISO === 'string'
    );
  } catch (err) {
    console.warn('[deadline-departure-board] failed to read localStorage', err);
    return [];
  }
}

export function saveDeadlines(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('[deadline-departure-board] failed to write localStorage', err);
  }
}

export function generateId() {
  return `dl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
