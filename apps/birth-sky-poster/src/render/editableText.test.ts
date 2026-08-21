// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { closeInlineEditor, enableInlineEditing, type CommitHandler } from './editableText';
import { svgEl, svgText } from './svg-utils';

let svg: SVGSVGElement;
let node: SVGTextElement;
let onCommit: ReturnType<typeof vi.fn<CommitHandler>>;

function editor(): HTMLInputElement | null {
  return document.querySelector('input.inline-edit-input');
}

function press(target: Element, key: string): boolean {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  document.body.innerHTML = '';
  svg = svgEl('svg');
  node = svgText(64, 108, 'STAR CHART', { id: 'poster-editable-title', class: 'title editable' });
  svg.appendChild(node);
  document.body.appendChild(svg);

  onCommit = vi.fn<CommitHandler>();
  enableInlineEditing(svg, onCommit);
});

describe('affordances', () => {
  it('exposes each editable text as a focusable button', () => {
    expect(node.getAttribute('tabindex')).toBe('0');
    expect(node.getAttribute('role')).toBe('button');
    expect(node.getAttribute('aria-label')).toContain('STAR CHART');
  });
});

describe('opening the editor', () => {
  it('opens on click, seeded with the current text', () => {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(editor()?.value).toBe('STAR CHART');
  });

  // The prototype bound click only, so these three fields were unreachable
  // without a mouse (FR-007.2).
  it.each(['Enter', ' '])('opens on %s from the keyboard', (key) => {
    expect(press(node, key)).toBe(true);

    expect(editor()).not.toBeNull();
  });

  it('ignores other keys', () => {
    press(node, 'a');

    expect(editor()).toBeNull();
  });

  it('mirrors the alignment of a right-aligned text node', () => {
    const dateNode = svgText(936, 100, '2026.08.21', {
      id: 'poster-editable-date',
      class: 'editable',
      'text-anchor': 'end',
    });
    svg.appendChild(dateNode);
    enableInlineEditing(svg, onCommit);

    dateNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(editor()?.style.textAlign).toBe('right');
  });

  it('closes a previous editor rather than stacking a second one', () => {
    const other = svgText(0, 0, 'TOKYO', { id: 'poster-editable-place', class: 'editable' });
    svg.appendChild(other);
    enableInlineEditing(svg, onCommit);

    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    other.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.querySelectorAll('.inline-edit-input')).toHaveLength(1);
    expect(editor()?.value).toBe('TOKYO');
  });
});

describe('committing', () => {
  beforeEach(() => {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  it('writes the new value back and reports it', () => {
    editor()!.value = 'BIRTH SKY';
    press(editor()!, 'Enter');

    expect(node.textContent).toBe('BIRTH SKY');
    expect(onCommit).toHaveBeenCalledWith('poster-editable-title', 'BIRTH SKY');
    expect(editor()).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    editor()!.value = '   SPACED   ';
    press(editor()!, 'Enter');

    expect(node.textContent).toBe('SPACED');
  });

  it('commits when focus leaves the editor', () => {
    editor()!.value = 'BLURRED';
    editor()!.dispatchEvent(new FocusEvent('blur'));

    expect(node.textContent).toBe('BLURRED');
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it('updates the accessible name to match the new text', () => {
    editor()!.value = 'RENAMED';
    press(editor()!, 'Enter');

    expect(node.getAttribute('aria-label')).toContain('RENAMED');
  });

  // Blanking the title would leave nothing on the poster to click back onto.
  it('keeps the previous value when committed empty', () => {
    editor()!.value = '   ';
    press(editor()!, 'Enter');

    expect(node.textContent).toBe('STAR CHART');
    expect(onCommit).not.toHaveBeenCalled();
    expect(editor()).toBeNull();
  });

  it('returns focus to the text node so keyboard navigation continues', () => {
    editor()!.value = 'DONE';
    press(editor()!, 'Enter');

    expect(document.activeElement).toBe(node);
  });
});

describe('cancelling', () => {
  beforeEach(() => {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  it('discards the edit on Escape', () => {
    editor()!.value = 'DISCARDED';
    press(editor()!, 'Escape');

    expect(node.textContent).toBe('STAR CHART');
    expect(onCommit).not.toHaveBeenCalled();
    expect(editor()).toBeNull();
  });

  // Removing a focused element fires blur in some engines; without a guard
  // that would commit the value Escape had just discarded.
  it('does not commit if a blur arrives after Escape', () => {
    const input = editor()!;
    input.value = 'DISCARDED';
    press(input, 'Escape');
    input.dispatchEvent(new FocusEvent('blur'));

    expect(node.textContent).toBe('STAR CHART');
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('repositioning', () => {
  it('follows the page as it scrolls', () => {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const spy = vi.spyOn(node, 'getBoundingClientRect');

    window.dispatchEvent(new Event('scroll'));

    expect(spy).toHaveBeenCalled();
  });

  it('stops listening once the editor is gone', () => {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    press(editor()!, 'Escape');

    const spy = vi.spyOn(node, 'getBoundingClientRect');
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('closeInlineEditor', () => {
  // The poster SVG is replaced wholesale on every render; an editor left
  // behind would float over a node that no longer exists (FR-007.8).
  it('removes an editor left open', () => {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    closeInlineEditor(document);

    expect(editor()).toBeNull();
  });

  it('is safe to call when nothing is open', () => {
    expect(() => closeInlineEditor(document)).not.toThrow();
  });
});
