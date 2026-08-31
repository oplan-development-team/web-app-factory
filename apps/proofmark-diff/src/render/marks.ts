import type { Segment } from '../diff/types';
import {
  buildArrowPath,
  buildCaretGlyph,
  buildLassoPath,
  buildLoopGlyph,
  buildStrikePath,
  seedFromString,
} from './sketch';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface MarkRefs {
  wrapper: HTMLElement;
  svg: SVGSVGElement;
  annotationLayer: HTMLElement;
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function ensureDefs(svg: SVGSVGElement) {
  if (svg.querySelector('defs')) return;
  const defs = svgEl('defs', {});

  const filter = svgEl('filter', {
    id: 'handDrawn',
    x: '-30%',
    y: '-30%',
    width: '160%',
    height: '160%',
  });
  filter.appendChild(
    svgEl('feTurbulence', {
      type: 'fractalNoise',
      baseFrequency: '0.9',
      numOctaves: '1',
      seed: '7',
      result: 'noise',
    }),
  );
  filter.appendChild(
    svgEl('feDisplacementMap', {
      in: 'SourceGraphic',
      in2: 'noise',
      scale: '1.8',
      xChannelSelector: 'R',
      yChannelSelector: 'G',
    }),
  );
  defs.appendChild(filter);

  const marker = svgEl('marker', {
    id: 'arrowHead',
    viewBox: '0 0 10 10',
    refX: '8',
    refY: '5',
    markerWidth: '7',
    markerHeight: '7',
    orient: 'auto-start-reverse',
  });
  marker.appendChild(
    svgEl('path', {
      d: 'M 0 0 L 10 5 L 0 10 L 3 5 Z',
      fill: 'var(--vermillion)',
    }),
  );
  defs.appendChild(marker);

  svg.appendChild(defs);
}

interface Rel {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rel(rect: DOMRect, origin: DOMRect): Rel {
  return { x: rect.left - origin.left, y: rect.top - origin.top, w: rect.width, h: rect.height };
}

const ANNOTATION_OFFSET = 24;

/** Gives freshly-drawn proof-mark strokes a brief "ink appearing" reveal by
 * animating stroke-dashoffset from the path's own length down to 0. Only
 * used on the initial render of a diff result, not on resize relayouts,
 * so it stays a meaningful state-transition cue instead of a distraction. */
function animateStrokeIn(path: SVGPathElement, index: number) {
  requestAnimationFrame(() => {
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    path.style.transition = `stroke-dashoffset 480ms cubic-bezier(0.22, 0.7, 0.2, 1) ${Math.min(index * 22, 460)}ms`;
    requestAnimationFrame(() => {
      path.style.strokeDashoffset = '0';
    });
  });
}

/**
 * Reads the live geometry of every segment's anchor span (via
 * getBoundingClientRect / getClientRects) and (re)draws the proof-mark
 * overlay: strike lines, トルツメ loops, insertion carets, ruby
 * corrections, and move lassos + connecting arrows. Safe to call
 * repeatedly (e.g. from a ResizeObserver) — it fully clears and rebuilds
 * the overlay each time.
 *
 * When `animate` is true, every freshly drawn stroke plays a brief
 * hand-inked reveal; pass false for resize-driven relayouts so marks just
 * snap to their new position instead of replaying the animation.
 */
export function layoutMarks(
  refs: MarkRefs,
  segments: Segment[],
  anchors: Map<string, HTMLElement>,
  animate = false,
): void {
  const { wrapper, svg, annotationLayer } = refs;

  ensureDefs(svg);
  // clear everything except <defs>
  Array.from(svg.children).forEach((child) => {
    if (child.tagName.toLowerCase() !== 'defs') svg.removeChild(child);
  });
  annotationLayer.innerHTML = '';

  const sheetRect = wrapper.getBoundingClientRect();
  const moveCenters = new Map<string, { out?: { x: number; y: number }; in?: { x: number; y: number } }>();

  let maxBottom = 0;
  let strokeIndex = 0;
  const registerStroke = (path: SVGPathElement) => {
    if (animate) animateStrokeIn(path, strokeIndex);
    strokeIndex += 1;
    return path;
  };

  const mountAnnotation = (className: string, text: string, x: number, y: number, seed: number) => {
    const note = document.createElement('div');
    note.className = className;
    note.textContent = text;
    const wobble = (seed - 0.5) * 4;
    note.style.left = `${x}px`;
    note.style.top = `${y - ANNOTATION_OFFSET}px`;
    if (animate) {
      note.style.opacity = '0';
      note.style.transform = `rotate(${wobble.toFixed(1)}deg) translateY(4px)`;
      annotationLayer.appendChild(note);
      requestAnimationFrame(() => {
        note.style.transition = `opacity 320ms ease ${Math.min(strokeIndex * 22, 460)}ms, transform 320ms ease ${Math.min(strokeIndex * 22, 460)}ms`;
        note.style.opacity = '1';
        note.style.transform = `rotate(${wobble.toFixed(1)}deg) translateY(0)`;
      });
    } else {
      note.style.transform = `rotate(${wobble.toFixed(1)}deg)`;
      annotationLayer.appendChild(note);
    }
  };

  for (const seg of segments) {
    const anchor = anchors.get(seg.id);
    if (!anchor) continue;

    if (seg.kind === 'delete' || seg.kind === 'replace') {
      const rects = Array.from(anchor.getClientRects()).map((r) => rel(r, sheetRect));
      if (rects.length === 0) continue;
      rects.forEach((r, i) => {
        const y = r.y + r.h * 0.58;
        const d = buildStrikePath(r.x, y, r.x + r.w, y, seedFromString(`${seg.id}-${i}`));
        registerStroke(
          svg.appendChild(
            svgEl('path', {
              d,
              class: 'mark-strike',
              filter: 'url(#handDrawn)',
            }),
          ),
        );
        maxBottom = Math.max(maxBottom, r.y + r.h);
      });

      if (seg.kind === 'delete') {
        const last = rects[rects.length - 1];
        const loopD = buildLoopGlyph(last.x + last.w + 10, last.y + last.h * 0.4, 1);
        registerStroke(
          svg.appendChild(
            svgEl('path', {
              d: loopD,
              class: 'mark-loop',
              filter: 'url(#handDrawn)',
            }),
          ),
        );
      } else if (seg.correctionText) {
        const first = rects[0];
        mountAnnotation('annotation annotation-ruby', seg.correctionText, first.x, first.y, seedFromString(seg.id));
      }
      continue;
    }

    if (seg.kind === 'insert') {
      const r = rel(anchor.getBoundingClientRect(), sheetRect);
      const tipY = r.y + r.h;
      const caretD = buildCaretGlyph(r.x, tipY, seedFromString(seg.id));
      registerStroke(
        svg.appendChild(
          svgEl('path', {
            d: caretD,
            class: 'mark-caret',
            filter: 'url(#handDrawn)',
          }),
        ),
      );
      if (seg.correctionText) {
        mountAnnotation('annotation annotation-insert', seg.correctionText, r.x, r.y, seedFromString(seg.id + 'w'));
      }
      maxBottom = Math.max(maxBottom, r.y + r.h);
      continue;
    }

    if (seg.kind === 'move-out' || seg.kind === 'move-in') {
      const r = rel(anchor.getBoundingClientRect(), sheetRect);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const rx = r.w / 2 + 8;
      const ry = r.h / 2 + 6;
      const lassoD = buildLassoPath(cx, cy, rx, ry, seedFromString(seg.id));
      registerStroke(
        svg.appendChild(
          svgEl('path', {
            d: lassoD,
            class: 'mark-lasso',
            filter: 'url(#handDrawn)',
          }),
        ),
      );
      if (seg.moveId) {
        const entry = moveCenters.get(seg.moveId) ?? {};
        if (seg.kind === 'move-out') entry.out = { x: cx, y: cy + ry + 4 };
        else entry.in = { x: cx, y: cy - ry - 4 };
        moveCenters.set(seg.moveId, entry);
      }
      maxBottom = Math.max(maxBottom, r.y + r.h);
    }
  }

  for (const [moveId, { out, in: inn }] of moveCenters) {
    if (!out || !inn) continue;
    const d = buildArrowPath(out.x, out.y, inn.x, inn.y, seedFromString(moveId));
    registerStroke(
      svg.appendChild(
        svgEl('path', {
          d,
          class: 'mark-arrow',
          'marker-end': 'url(#arrowHead)',
        }),
      ),
    );
  }

  const height = Math.max(wrapper.scrollHeight, maxBottom + 24);
  svg.setAttribute('height', String(height));
}
