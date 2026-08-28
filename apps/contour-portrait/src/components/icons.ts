/** Small hand-drawn technical-linework glyphs, kept consistent with the poster's own hairline vocabulary. */

export function contourGlyphSvg(): string {
  return `<svg class="glyph" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1">
    <path d="M4 34c6-2 8-10 14-10s6 8 12 8 8-9 14-6" />
    <path d="M2 28c7-1 9-14 16-14s8 12 14 12 9-11 14-8" opacity="0.55" />
    <path d="M6 40c5-1 7-6 12-6s6 5 11 5 7-5 12-4" opacity="0.35" />
  </svg>`;
}

export function scanGlyphSvg(): string {
  return `<svg class="glyph" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1">
    <circle cx="24" cy="24" r="14" />
    <line x1="24" y1="2" x2="24" y2="12" />
    <line x1="24" y1="36" x2="24" y2="46" />
    <line x1="2" y1="24" x2="12" y2="24" />
    <line x1="36" y1="24" x2="46" y2="24" />
  </svg>`;
}
