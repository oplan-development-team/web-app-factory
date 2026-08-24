// Working grid the luminance map / contour trace is computed at. Fixed 4:5
// portrait aspect — deliberately modest so slider drags stay interactive;
// export sharpness comes from rasterizing the vector SVG at 2x/3x, not from
// re-tracing at a bigger grid.
export const GRID_W = 640;
export const GRID_H = 800;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Poster document layout, all in SVG user units. The art box is where the
// contour trace is drawn 1 grid-unit == 1 svg-unit, offset by ART_X/ART_Y.
export const ART_X = 88;
export const ART_Y = 84;
export const ART_W = GRID_W;
export const ART_H = GRID_H;

export const DOC_W = ART_X + ART_W + 56;
export const DOC_H = ART_Y + ART_H + 176;

export const REG_MARK_SIZE = 13;
export const REG_MARK_INSET = 26;

export const RULER_MAJOR_STEP = 100;
export const RULER_MINOR_STEP = 20;

export const PAPER_PRESETS = [
  { id: 'survey', label: 'SURVEY WHITE', hex: '#F5F3EE' },
  { id: 'bone', label: 'BONE', hex: '#EFEAE0' },
  { id: 'pure', label: 'PURE WHITE', hex: '#FFFFFF' },
  { id: 'slate', label: 'FIELD SLATE', hex: '#DEDBD1' },
] as const;

export const MULTI_PRESETS: Record<
  'topo' | 'blueprint' | 'sepia',
  { label: string; paper: string; stops: string[] }
> = {
  topo: {
    label: 'HYPSOMETRIC / CLASSIC',
    paper: '#F5F3EE',
    stops: ['#1B3A5C', '#1F6E5C', '#4F8A3D', '#C9A227', '#D9B36C', '#F2E8D2'],
  },
  blueprint: {
    label: 'BLUEPRINT',
    paper: '#173A6B',
    stops: ['#9FC6E8', '#BFDCF2', '#DCEBF8', '#EEF5FB', '#F8FBFD', '#FFFFFF'],
  },
  sepia: {
    label: 'SEPIA FIELD SURVEY',
    paper: '#EDE0C8',
    stops: ['#5B3A1E', '#7A4E24', '#9C6B32', '#BE8C4C', '#D9AE72', '#EFD8AC'],
  },
};
