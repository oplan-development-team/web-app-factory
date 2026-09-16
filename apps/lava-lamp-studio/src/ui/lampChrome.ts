/**
 * Static chrome cap/base SVG markup for the lamp fitting. Pure string
 * templates (no user input interpolated), injected once at startup.
 */

const CHROME_DEFS = `
  <defs>
    <linearGradient id="chromeVert" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f4f6f7" />
      <stop offset="18%" stop-color="#c7d0d4" />
      <stop offset="38%" stop-color="#6d777d" />
      <stop offset="52%" stop-color="#dfe4e6" />
      <stop offset="66%" stop-color="#5c6469" />
      <stop offset="85%" stop-color="#aab4ba" />
      <stop offset="100%" stop-color="#2c3134" />
    </linearGradient>
    <linearGradient id="chromeRing" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#2c3134" />
      <stop offset="25%" stop-color="#eef2f3" />
      <stop offset="50%" stop-color="#7c868c" />
      <stop offset="75%" stop-color="#eef2f3" />
      <stop offset="100%" stop-color="#2c3134" />
    </linearGradient>
  </defs>
`;

export function lampCapSvg(): string {
  return `
  <svg class="lamp__cap" viewBox="0 0 300 108" xmlns="http://www.w3.org/2000/svg" role="presentation" aria-hidden="true">
    ${CHROME_DEFS}
    <path d="M104,108 C104,88 96,78 96,58 C96,30 118,10 150,10 C182,10 204,30 204,58 C204,78 196,88 196,108 Z" fill="url(#chromeVert)" stroke="#1a1d1f" stroke-width="1.5"/>
    <ellipse cx="150" cy="12" rx="26" ry="9" fill="url(#chromeRing)" stroke="#1a1d1f" stroke-width="1.5"/>
    <ellipse cx="150" cy="10" rx="14" ry="5" fill="#eef2f3" opacity="0.85"/>
    <rect x="98" y="96" width="104" height="12" rx="4" fill="url(#chromeRing)" stroke="#1a1d1f" stroke-width="1.5"/>
    <g stroke="#232729" stroke-width="1" opacity="0.55">
      <line x1="106" y1="70" x2="194" y2="70" />
      <line x1="102" y1="82" x2="198" y2="82" />
    </g>
  </svg>`;
}

export function lampBaseSvg(): string {
  return `
  <svg class="lamp__base" viewBox="0 0 300 168" xmlns="http://www.w3.org/2000/svg" role="presentation" aria-hidden="true">
    ${CHROME_DEFS}
    <path d="M96,0 C96,26 70,34 52,58 C30,88 24,112 24,132 C24,152 40,168 60,168 L240,168 C260,168 276,152 276,132 C276,112 270,88 248,58 C230,34 204,26 204,0 Z" fill="url(#chromeVert)" stroke="#1a1d1f" stroke-width="1.5"/>
    <ellipse cx="150" cy="132" rx="126" ry="20" fill="url(#chromeRing)" opacity="0.9"/>
    <ellipse cx="150" cy="160" rx="140" ry="10" fill="#15181a" opacity="0.7"/>
    <rect x="90" y="0" width="120" height="10" rx="3" fill="url(#chromeRing)" stroke="#1a1d1f" stroke-width="1.5"/>
    <g stroke="#232729" stroke-width="1" opacity="0.5">
      <line x1="46" y1="96" x2="254" y2="96" />
      <line x1="34" y1="118" x2="266" y2="118" />
    </g>
    <g fill="#eef2f3" opacity="0.5">
      <circle cx="150" cy="146" r="3" />
    </g>
  </svg>`;
}
