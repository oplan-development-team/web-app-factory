// Generates a generic "catalog number" string in the shape of a mid-century
// jazz LP spine credit (label code + 4-digit number). Deliberately avoids the
// real Blue Note wordmark/initials or numbering scheme — this is a stand-in
// for "some independent label", not a forgery of a specific trademark.
const LABEL_CODES = ['TCS', 'RMS', 'STU', 'IMP', 'COL', 'NRD', 'VEX', 'ARQ'];

export function generateCatalogLabel(): string {
  const code = LABEL_CODES[Math.floor(Math.random() * LABEL_CODES.length)];
  const number = 1000 + Math.floor(Math.random() * 9000);
  const series = Math.random() > 0.5 ? 'STEREO' : 'MONO';
  return `${code}-${number} · ${series}`;
}
