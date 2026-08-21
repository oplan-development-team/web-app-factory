// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { mountAppMarkup } from '../test-utils';
import { requireElement } from './dom';
import { StatusRegion } from './status';

let host: HTMLParagraphElement;
let status: StatusRegion;

beforeEach(() => {
  mountAppMarkup();
  host = requireElement(document, 'status-region', 'p');
  status = new StatusRegion(host);
});

describe('StatusRegion', () => {
  it('starts empty and hidden', () => {
    expect(status.message).toBe('');
    expect(host.hidden).toBe(true);
  });

  it('shows an informational message politely', () => {
    status.set('現在地を取得しています…');

    expect(host.hidden).toBe(false);
    expect(host.textContent).toBe('現在地を取得しています…');
    expect(host.getAttribute('role')).toBe('status');
    expect(host.getAttribute('aria-live')).toBe('polite');
    expect(status.tone).toBe('info');
  });

  it('records a success tone for styling', () => {
    status.set('PNGを書き出しました。', 'success');

    expect(status.tone).toBe('success');
    expect(host.getAttribute('aria-live')).toBe('polite');
  });

  // An export failure needs to interrupt: the user is waiting on a download
  // that will never arrive, so a polite queue leaves them staring at nothing.
  it('announces an error assertively', () => {
    status.set('PNGの書き出しに失敗しました。', 'error');

    expect(host.getAttribute('role')).toBe('alert');
    expect(host.getAttribute('aria-live')).toBe('assertive');
    expect(status.tone).toBe('error');
  });

  it('drops back to a polite status when a later message is not an error', () => {
    status.set('失敗しました', 'error');
    status.set('書き出しました', 'success');

    expect(host.getAttribute('role')).toBe('status');
    expect(host.getAttribute('aria-live')).toBe('polite');
  });

  it('hides and forgets the tone when cleared', () => {
    status.set('失敗しました', 'error');
    status.clear();

    expect(host.hidden).toBe(true);
    expect(status.message).toBe('');
    expect(status.tone).toBeUndefined();
  });

  it('renders markup in a message as text', () => {
    status.set('<img src=x onerror=alert(1)>');

    expect(host.children).toHaveLength(0);
    expect(host.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
