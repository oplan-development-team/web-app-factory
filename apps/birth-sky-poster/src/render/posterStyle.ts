/**
 * Base poster CSS, embedded directly inside the SVG's own <style> element.
 * Because the same DOM node is used for the live on-screen preview and for
 * the downloaded/exported file, this is the single source of truth for the
 * poster's visual system (Swiss/instrument-plate direction: paper ground,
 * near-black ink, one functional red accent).
 */
import { tokenDeclarations } from './tokens';

export const POSTER_CSS = `
.poster-root {
  ${tokenDeclarations()}
  /* Set on the root so it *inherits* into <text>. Writing this as
     ".poster-root text { font-family: ... }" gives it specificity (0,1,1),
     which silently beats every single-class rule below and forces the whole
     poster into the sans face -- including every numeric readout that the
     design requires to be monospace. */
  font-family: var(--font-sans);
}
.poster-bg { fill: var(--paper); }
.poster-root text { fill: var(--ink); }

.title-text { font-family: var(--font-sans); font-weight: 700; font-size: 46px; letter-spacing: -0.01em; }
.title-subtext { font-family: var(--font-mono); font-size: 11.5px; letter-spacing: 0.16em; fill: var(--ink-mid); }
.date-text { font-family: var(--font-mono); font-size: 23px; font-weight: 500; }
.place-text { font-family: var(--font-mono); font-size: 14px; letter-spacing: 0.08em; fill: var(--ink-mid); }

.rule { stroke: var(--ink); }
.rule-strong { stroke-width: 1.6; }
.rule-faint { stroke: var(--ink-faint); stroke-width: 1; }

.alt-ring { fill: none; stroke: var(--ink-faint); stroke-width: 1; stroke-dasharray: 1 5; }
.alt-ring-label { font-family: var(--font-mono); font-size: 11px; fill: var(--ink-mid); }
.horizon-circle { fill: none; stroke: var(--red); stroke-width: 2.2; }
.ring-line { fill: none; stroke: var(--ink); stroke-width: 1; }
.tick { stroke: var(--ink-mid); stroke-width: 1; }
.tick-major { stroke: var(--ink); stroke-width: 1.4; }
.tick-cardinal { stroke: var(--ink); stroke-width: 2.2; }
.ring-degree-label { font-family: var(--font-mono); font-size: 10.5px; fill: var(--ink-mid); }
.ring-cardinal-label { font-family: var(--font-sans); font-size: 21px; font-weight: 700; fill: var(--ink); }
.ring-cardinal-label-north { fill: var(--red); }
.north-needle { stroke: var(--red); stroke-width: 2.4; stroke-linecap: round; }
.zenith-mark { fill: var(--paper); stroke: var(--red); stroke-width: 1.6; }

.constellation-lines line { stroke: var(--ink); stroke-opacity: 0.32; stroke-width: 1; }
.star { fill: var(--ink); }
.star-label { font-family: var(--font-mono); font-size: 9.5px; fill: var(--ink-mid); }

.legend-label { font-family: var(--font-sans); font-size: 11px; font-weight: 600; letter-spacing: 0.08em; fill: var(--ink-mid); }
.legend-value { font-family: var(--font-mono); font-size: 21px; fill: var(--ink); }
.footer-text { font-family: var(--font-mono); font-size: 11.5px; fill: var(--ink-mid); }

.editable { cursor: text; }
/* An SVG <text> only receives pointer events on its glyph outlines by default,
   so a click landing between two letters falls through to the background rect
   and the field appears unresponsive. */
.editable { pointer-events: all; }
.editable:hover, .editable:focus { fill: var(--red); }
.editable:focus { outline: none; }

.skeleton-horizon { fill: none; stroke: var(--ink-faint); stroke-width: 2.2; }
`;
