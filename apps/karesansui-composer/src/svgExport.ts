import type { Stone, Streamline } from './types';

function polylineToPath(line: Streamline): string {
  if (line.length < 2) return '';
  const first = line[0]!;
  const parts = [`M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`];
  for (let i = 1; i < line.length; i++) {
    const p = line[i]!;
    parts.push(`L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  }
  return parts.join(' ');
}

export interface SvgExportOptions {
  width: number;
  height: number;
  stones: Stone[];
  streamlines: Streamline[];
}

export function buildSvgDocument(opts: SvgExportOptions): string {
  const { width, height, stones, streamlines } = opts;

  const streamPaths = streamlines
    .map((line) => polylineToPath(line))
    .filter(Boolean)
    .map((d) => `<path d="${d}" />`)
    .join('\n    ');

  const stoneCircles = stones
    .map(
      (s) =>
        `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${s.radius.toFixed(1)}" fill="url(#stoneGradient)" />`,
    )
    .join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="stoneGradient" cx="35%" cy="32%" r="75%">
      <stop offset="0%" stop-color="#4a4a48" />
      <stop offset="45%" stop-color="#2b2b2b" />
      <stop offset="100%" stop-color="#121110" />
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="#f4ede0" />
  <g fill="none" stroke="#6a5842" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.62">
    ${streamPaths}
  </g>
  <g>
    ${stoneCircles}
  </g>
</svg>
`;
}
