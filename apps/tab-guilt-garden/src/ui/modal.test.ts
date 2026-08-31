import { beforeEach, describe, expect, test } from 'vitest';
import { confirmModal, type ConfirmOptions } from './modal';

const base: ConfirmOptions = {
  title: '本当に庭を焼き払いますか？',
  body: '全部消えます。',
  confirmLabel: '焼き払う',
  cancelLabel: 'やめておく',
};

beforeEach(() => {
  document.body.innerHTML = '';
});

function overlay(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.modal-overlay');
  if (!el) throw new Error('modal not mounted');
  return el;
}

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>('.modal-actions button')].find(
    (b) => b.textContent === label,
  );
  if (!found) throw new Error(`no button labelled ${label}`);
  return found;
}

describe('rendering', () => {
  test('mounts an overlay with the supplied copy', async () => {
    const pending = confirmModal(base);
    expect(document.querySelector('.modal-title')?.textContent).toBe(base.title);
    expect(document.querySelector('.modal-body')?.textContent).toBe(base.body);
    button('やめておく').click();
    await pending;
  });

  test('is announced as a modal dialog (FR-602)', async () => {
    const pending = confirmModal(base);
    const box = document.querySelector('.modal-box');
    expect(box?.getAttribute('role')).toBe('dialog');
    expect(box?.getAttribute('aria-modal')).toBe('true');
    button('やめておく').click();
    await pending;
  });

  test('focuses the confirm button so the keyboard path works', async () => {
    const pending = confirmModal(base);
    expect(document.activeElement).toBe(button('焼き払う'));
    button('やめておく').click();
    await pending;
  });

  test('omits the toggle when no label is given', async () => {
    const pending = confirmModal(base);
    expect(document.querySelector('.modal-toggle')).toBeNull();
    button('やめておく').click();
    await pending;
  });
});

describe('resolution', () => {
  test('confirming resolves true', async () => {
    const pending = confirmModal(base);
    button('焼き払う').click();
    await expect(pending).resolves.toEqual({ confirmed: true, toggled: false });
  });

  test('cancelling resolves false', async () => {
    const pending = confirmModal(base);
    button('やめておく').click();
    await expect(pending).resolves.toEqual({ confirmed: false, toggled: false });
  });

  test('Escape cancels', async () => {
    const pending = confirmModal(base);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(pending).resolves.toEqual({ confirmed: false, toggled: false });
  });

  test('other keys do not dismiss it', async () => {
    const pending = confirmModal(base);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
    button('やめておく').click();
    await pending;
  });

  test('clicking the backdrop cancels', async () => {
    const pending = confirmModal(base);
    overlay().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await expect(pending).resolves.toEqual({ confirmed: false, toggled: false });
  });

  test('clicking inside the box does not cancel', async () => {
    const pending = confirmModal(base);
    document
      .querySelector('.modal-box')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
    button('やめておく').click();
    await pending;
  });

  test('removes itself from the DOM once resolved', async () => {
    const pending = confirmModal(base);
    button('焼き払う').click();
    await pending;
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  test('stops listening for Escape after closing', async () => {
    const pending = confirmModal(base);
    button('焼き払う').click();
    await pending;
    // Must not throw or resolve a second time.
    expect(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    ).not.toThrow();
  });
});

describe('optional toggle (AC-400c)', () => {
  const withToggle: ConfirmOptions = {
    ...base,
    toggleLabel: '通算記録と実績も消す',
    toggleHint: '通常の焼き払いでは通算記録は残ります。',
  };

  test('renders the toggle and its hint', async () => {
    const pending = confirmModal(withToggle);
    expect(document.querySelector('.modal-toggle-text')?.textContent).toBe(
      '通算記録と実績も消す',
    );
    expect(document.querySelector('.modal-toggle-hint')?.textContent).toContain('残ります');
    button('やめておく').click();
    await pending;
  });

  test('defaults to off, so the lifetime record survives a careless confirm', async () => {
    const pending = confirmModal(withToggle);
    button('焼き払う').click();
    await expect(pending).resolves.toEqual({ confirmed: true, toggled: false });
  });

  test('reports the toggle when it was checked', async () => {
    const pending = confirmModal(withToggle);
    document.querySelector<HTMLInputElement>('.modal-toggle-input')!.checked = true;
    button('焼き払う').click();
    await expect(pending).resolves.toEqual({ confirmed: true, toggled: true });
  });

  test('a checked toggle is ignored when the user cancels', async () => {
    const pending = confirmModal(withToggle);
    document.querySelector<HTMLInputElement>('.modal-toggle-input')!.checked = true;
    button('やめておく').click();
    await expect(pending).resolves.toEqual({ confirmed: false, toggled: false });
  });
});
