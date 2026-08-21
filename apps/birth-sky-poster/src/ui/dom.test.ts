// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { MissingElementError, requireElement } from './dom';

describe('requireElement', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="input-form"><input id="input-date" type="date" /></form>
      <button id="export-png"></button>
    `;
  });

  it('returns the element narrowed to the requested tag', () => {
    const input = requireElement(document, 'input-date', 'input');

    expect(input.type).toBe('date');
  });

  it('throws a named error when the id is absent', () => {
    expect(() => requireElement(document, 'no-such-id', 'input')).toThrow(MissingElementError);
    expect(() => requireElement(document, 'no-such-id', 'input')).toThrow(/#no-such-id/);
  });

  // A markup change that swaps <button> for <a> would otherwise slip through
  // the cast and only surface when `.disabled` silently does nothing.
  it('throws when the element exists but has the wrong tag', () => {
    expect(() => requireElement(document, 'export-png', 'input')).toThrow(
      /is a <button>, expected <input>/,
    );
  });
});
