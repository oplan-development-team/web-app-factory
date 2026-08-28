import type { CategoryIcon } from '../../data/types';

/** Hand-drawn line glyphs for the eight categories. Stroke-only, no fills. */
const PATHS: Record<CategoryIcon, JSX.Element> = {
  cup: (
    <>
      <path d="M4 8h11v6a5.5 5.5 0 0 1-11 0Z" />
      <path d="M15 9.5h2.2a2.4 2.4 0 0 1 0 4.8H15" />
      <path d="M6.5 5.2V3.4M9.5 5.2V3M12.5 5.2V3.6" />
      <path d="M3 20h14" />
    </>
  ),
  nib: (
    <>
      <path d="M10 3 5 12l5 6 5-6Z" />
      <path d="M10 9v9" />
      <circle cx="10" cy="12" r="1.4" />
      <path d="M4 21h12" />
    </>
  ),
  case: (
    <>
      <rect x="3" y="7" width="14" height="11" />
      <path d="M7.5 7V4.6h5V7" />
      <path d="M3 12h14" />
      <path d="M9 11.2v1.6" />
    </>
  ),
  plate: (
    <>
      <circle cx="10" cy="12" r="7" />
      <circle cx="10" cy="12" r="3.4" />
      <path d="M2 4v5M17.5 4v5" />
    </>
  ),
  mountain: (
    <>
      <path d="M2 17 7.5 7l4 6.5L14 9.5 18 17Z" />
      <path d="M2 20h16" />
      <circle cx="15" cy="5" r="2" />
    </>
  ),
  house: (
    <>
      <path d="M3 10 10 4l7 6" />
      <path d="M5 10v8h10v-8" />
      <path d="M8.5 18v-4.5h3V18" />
    </>
  ),
  book: (
    <>
      <path d="M3 5h5.5a2 2 0 0 1 1.5 1.6V18a2 2 0 0 0-1.5-1.4H3Z" />
      <path d="M17 5h-5.5A2 2 0 0 0 10 6.6V18a2 2 0 0 1 1.5-1.4H17Z" />
    </>
  ),
  asterisk: (
    <>
      <path d="M10 3v14M4 6.5l12 7M16 6.5l-12 7" />
      <circle cx="10" cy="10" r="8.2" />
    </>
  ),
};

interface CategoryIconGlyphProps {
  readonly icon: CategoryIcon;
  readonly size?: number;
}

export function CategoryIconGlyph({ icon, size = 20 }: CategoryIconGlyphProps) {
  return (
    <svg
      className="category-glyph"
      width={size}
      height={size}
      viewBox="0 0 20 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[icon]}
    </svg>
  );
}
