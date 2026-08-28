const WEEKDAYS = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'] as const;

function parseIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Utility bar: `2026年8月28日 金曜日` */
export function formatIssueDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${
    WEEKDAYS[date.getDay()]
  }`;
}

/** Compact metadata form used throughout the paper: `2026.08.28` */
export function formatDotted(iso: string): string {
  return iso.replace(/-/g, '.');
}

/** Article page dateline: `2026年8月28日` */
export function formatLongDate(iso: string): string {
  const date = parseIso(iso);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
