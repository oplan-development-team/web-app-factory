import type { SpecimenMeta } from './types';

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

export function generateSpecimenNumber(date: Date): string {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const suffix = pad(Math.floor(Math.random() * 100));
  return `VS-${y}${m}${d}-${hh}${mm}${suffix}`;
}

export function formatDateLabel(date: Date): string {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return `${y}.${m}.${d}`;
}

export function buildSpecimenMeta(title: string, collector: string): SpecimenMeta {
  const now = new Date();
  return {
    title: title.trim().slice(0, 60),
    collector: collector.trim().slice(0, 40),
    specimenNumber: generateSpecimenNumber(now),
    dateLabel: formatDateLabel(now),
  };
}
