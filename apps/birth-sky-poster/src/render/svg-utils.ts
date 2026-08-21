export const SVG_NS = 'http://www.w3.org/2000/svg';

type Attrs = Record<string, string | number>;

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (SVGElement | Text)[] = [],
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  for (const child of children) node.appendChild(child);
  return node as SVGElementTagNameMap[K];
}

export function svgText(
  x: number,
  y: number,
  content: string,
  attrs: Attrs = {},
): SVGTextElement {
  const node = svgEl('text', { x, y, ...attrs });
  node.textContent = content;
  return node;
}
