// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { SVG_NS, svgEl, svgText } from './svg-utils';

describe('svgEl', () => {
  it('creates the element in the SVG namespace', () => {
    const el = svgEl('circle');

    expect(el.namespaceURI).toBe(SVG_NS);
    expect(el.tagName).toBe('circle');
  });

  it('stringifies numeric attribute values', () => {
    const el = svgEl('circle', { cx: 12.5, r: 3 });

    expect(el.getAttribute('cx')).toBe('12.5');
    expect(el.getAttribute('r')).toBe('3');
  });

  it('appends the given children in order', () => {
    const a = svgEl('line');
    const b = svgEl('line');

    const g = svgEl('g', {}, [a, b]);

    expect([...g.children]).toEqual([a, b]);
  });
});

describe('svgText', () => {
  it('positions the node and sets its content as text, never as markup', () => {
    const node = svgText(4, 8, '<script>alert(1)</script>', { class: 'title' });

    expect(node.getAttribute('x')).toBe('4');
    expect(node.getAttribute('y')).toBe('8');
    expect(node.getAttribute('class')).toBe('title');
    expect(node.textContent).toBe('<script>alert(1)</script>');
    expect(node.children).toHaveLength(0);
  });
});
