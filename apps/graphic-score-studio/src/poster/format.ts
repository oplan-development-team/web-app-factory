export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

export function generateCatalogNumber(): string {
  const n = 10000 + Math.floor(Math.random() * 9000);
  return `GSS-${n}`;
}

export function autoTitle(): string {
  const words = [
    'STILLE',
    'DRIFT',
    'UNTITLED FIELD',
    'TRACÉ',
    'GRAUZONE',
    'LINIENSPIEL',
    'LONGUE ONDE',
    'STUDIE',
  ];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = 1 + Math.floor(Math.random() * 24);
  return `${w}, OP. ${n}`;
}
