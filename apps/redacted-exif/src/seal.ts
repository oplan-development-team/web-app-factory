import { svgEl } from './dom';

/**
 * Hand-built "kaku-in" style corner seal (二重丸 + 縦書き風文字), rendered
 * as inline SVG so it scales crisply at any size and can share the
 * ink-bleed / rough-edge filters used by the redaction bars.
 */
export function buildSeal(): SVGElement {
  const size = 88;
  const cx = size / 2;
  const cy = size / 2;

  const svg = svgEl('svg', {
    class: 'seal',
    viewBox: `0 0 ${size} ${size}`,
    width: size,
    height: size,
    role: 'img',
    'aria-label': '架空の公印: 情報公開・個人情報保護室',
  });

  const g = svgEl('g', { filter: 'url(#stamp-rough)', transform: `rotate(-6 ${cx} ${cy})` });

  g.appendChild(svgEl('circle', { cx, cy, r: 41, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4 }));
  g.appendChild(svgEl('circle', { cx, cy, r: 33, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3 }));

  const chars = ['情', '報', '公', '開', '室'];
  const radius = 26;
  chars.forEach((c, idx) => {
    const angle = (idx / chars.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    g.appendChild(
      svgEl(
        'text',
        {
          x,
          y,
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          'font-size': 13,
          'font-family': "'Noto Serif JP', serif",
          fill: 'currentColor',
        },
        [c],
      ),
    );
  });

  svg.appendChild(g);
  return svg;
}
