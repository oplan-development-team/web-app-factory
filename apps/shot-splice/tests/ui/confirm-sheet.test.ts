import { describe, expect, it, vi } from 'vitest';

import { createConfirmSheet } from '../../src/ui/confirm-sheet';

const $ = (root: HTMLElement, selector: string) => root.querySelector(selector) as HTMLElement;

function build() {
  const sheet = createConfirmSheet();
  document.body.append(sheet.element);
  return sheet;
}

describe('createConfirmSheet', () => {
  it('stays hidden until opened', () => {
    const sheet = build();
    expect(sheet.element.hasAttribute('hidden')).toBe(true);
  });

  it('shows the requested title, message and confirm label', () => {
    const sheet = build();
    sheet.open({
      title: 'すべて削除しますか？',
      message: '読み込んだショットをすべて削除します。この操作は元に戻せません。',
      confirmLabel: '削除する',
      onConfirm: vi.fn(),
    });
    expect(sheet.element.hasAttribute('hidden')).toBe(false);
    expect($(sheet.element, '.sheet__title').textContent).toBe('すべて削除しますか？');
    expect($(sheet.element, '.confirm__message').textContent).toBe(
      '読み込んだショットをすべて削除します。この操作は元に戻せません。',
    );
    expect($(sheet.element, '.btn--danger').textContent).toBe('削除する');
  });

  it('runs the confirm callback and closes when confirmed', () => {
    const sheet = build();
    const onConfirm = vi.fn();
    sheet.open({ title: 't', message: 'm', confirmLabel: 'ok', onConfirm });
    $(sheet.element, '.btn--danger').click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(sheet.element.hasAttribute('hidden')).toBe(true);
  });

  it('does not run the confirm callback when cancelled', () => {
    const sheet = build();
    const onConfirm = vi.fn();
    sheet.open({ title: 't', message: 'm', confirmLabel: 'ok', onConfirm });
    $(sheet.element, '.btn--ghost').click();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(sheet.element.hasAttribute('hidden')).toBe(true);
  });

  it('closes without confirming when the scrim is clicked', () => {
    const sheet = build();
    const onConfirm = vi.fn();
    sheet.open({ title: 't', message: 'm', confirmLabel: 'ok', onConfirm });
    $(sheet.element, '.sheet__scrim').click();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(sheet.element.hasAttribute('hidden')).toBe(true);
  });

  it('forgets a cancelled request instead of running it on the next confirm', () => {
    const sheet = build();
    const first = vi.fn();
    const second = vi.fn();
    sheet.open({ title: 't', message: 'm', confirmLabel: 'ok', onConfirm: first });
    sheet.close();
    sheet.open({ title: 't', message: 'm', confirmLabel: 'ok', onConfirm: second });
    $(sheet.element, '.btn--danger').click();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
