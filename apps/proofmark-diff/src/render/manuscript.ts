import type { Segment } from '../diff/types';

/**
 * Renders segments into the manuscript body flow as plain spans. Colour /
 * strike styling for delete/replace/move-out is handled defensively in CSS
 * (in case the JS overlay fails to lay out), but the authoritative proof
 * marks (loops, carets, ruby corrections, move arrows) are drawn on top by
 * `render/marks.ts` using the returned anchor elements' live geometry.
 */
export function renderManuscript(
  container: HTMLElement,
  segments: Segment[],
): Map<string, HTMLElement> {
  container.innerHTML = '';
  const anchors = new Map<string, HTMLElement>();

  for (const seg of segments) {
    const span = document.createElement('span');
    span.className = `seg seg-${seg.kind}`;
    span.dataset.segId = seg.id;
    if (seg.moveId) span.dataset.moveId = seg.moveId;
    // Insert segments have no body text of their own (empty string) — a
    // zero-width space keeps the span a real anchor with a line box so we
    // can still read its position via getBoundingClientRect.
    span.textContent = seg.text.length > 0 ? seg.text : '​';
    container.appendChild(span);
    anchors.set(seg.id, span);
  }

  return anchors;
}
