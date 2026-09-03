import { el, setText, toggleAttr } from './dom';
import type { AppState, BandState } from './store';
import { bandsDifferFromDetection } from './store';

export interface BandCallbacks {
  readonly onToggle: (enabled: boolean) => void;
  readonly onEdit: (patch: { headerPx?: number; footerPx?: number }) => void;
  readonly onTrimEnds: (trimEnds: boolean) => void;
  readonly onAdopt: () => void;
}

export interface BandCard {
  readonly element: HTMLElement;
  update(state: AppState): void;
}

function stepper(
  label: string,
  onChange: (value: number) => void,
): { root: HTMLElement; input: HTMLInputElement } {
  const input = el('input', {
    class: 'stepper__input mono',
    type: 'number',
    attrs: { min: 0, step: 1, inputmode: 'numeric', 'aria-label': `${label}のカット量（px）` },
  });

  const commit = (next: number) => {
    const value = Math.max(0, Math.round(Number.isFinite(next) ? next : 0));
    input.value = String(value);
    onChange(value);
  };

  const nudge = (delta: number) =>
    el(
      'button',
      {
        class: 'stepper__btn',
        type: 'button',
        text: delta > 0 ? '+' : '−',
        attrs: { 'aria-label': `${label}を${Math.abs(delta)}px${delta > 0 ? '増やす' : '減らす'}` },
        on: { click: () => commit(Number(input.value) + delta) },
      },
      [],
    );

  input.addEventListener('change', () => commit(Number(input.value)));

  const root = el('div', { class: 'band__field' }, [
    el('span', { class: 'band__field-label', text: label }),
    el('div', { class: 'stepper' }, [nudge(-1), input, nudge(1)]),
  ]);
  return { root, input };
}

function summary(bands: BandState): string {
  if (bands.detectedHeaderPx === 0 && bands.detectedFooterPx === 0) {
    return '共通の固定帯は見つかりませんでした';
  }
  const parts: string[] = [];
  if (bands.detectedHeaderPx > 0) parts.push(`上端 ${bands.detectedHeaderPx}px`);
  if (bands.detectedFooterPx > 0) parts.push(`下端 ${bands.detectedFooterPx}px`);
  return `${parts.join(' / ')} が全ショット共通です`;
}

/**
 * Presents the detected fixed header/footer as a proposal.
 *
 * The detector never trims anything on its own: the app holds no copy of the
 * original pixels, so an automatic cut would be irreversible. Everything it
 * finds is shown as a number, can be switched off, and can be overridden.
 */
export function createBandCard(callbacks: BandCallbacks): BandCard {
  const headline = el('p', { class: 'band__summary' });
  const toggle = el('button', {
    class: 'switch',
    type: 'button',
    attrs: { role: 'switch', 'aria-checked': 'true', 'aria-label': '固定帯のカットを適用' },
  });
  toggle.append(el('span', { class: 'switch__knob', attrs: { 'aria-hidden': 'true' } }));
  toggle.addEventListener('click', () => {
    callbacks.onToggle(toggle.getAttribute('aria-checked') !== 'true');
  });

  const header = stepper('ヘッダー', (value) => callbacks.onEdit({ headerPx: value }));
  const footer = stepper('フッター', (value) => callbacks.onEdit({ footerPx: value }));

  const endsToggle = el('input', {
    type: 'checkbox',
    attrs: { id: 'band-trim-ends', class: 'checkbox__input' },
  });
  endsToggle.addEventListener('change', () => callbacks.onTrimEnds(endsToggle.checked));

  const ends = el('label', { class: 'checkbox', attrs: { for: 'band-trim-ends' } }, [
    endsToggle,
    el('span', { class: 'checkbox__box', attrs: { 'aria-hidden': 'true' } }),
    el('span', {
      class: 'checkbox__text',
      text: '先頭のヘッダーと末尾のフッターもカットする',
    }),
  ]);

  const adopt = el('button', {
    class: 'band__adopt',
    type: 'button',
    text: '検出値に戻す',
    on: { click: () => callbacks.onAdopt() },
  });
  const drift = el('p', { class: 'band__drift' }, [
    el('span', { class: 'band__drift-text' }),
    adopt,
  ]);
  const driftText = drift.querySelector('.band__drift-text') as HTMLElement;

  const body = el('div', { class: 'band__body' }, [
    el('div', { class: 'band__fields' }, [header.root, footer.root]),
    ends,
    drift,
  ]);

  const element = el('section', { class: 'card band', attrs: { 'aria-label': '固定ヘッダー / フッター' } }, [
    el('div', { class: 'band__head' }, [
      el('div', {}, [
        el('h2', { class: 'section-label', text: '固定帯の自動検出' }),
        headline,
      ]),
      toggle,
    ]),
    body,
  ]);

  return {
    element,
    update(state) {
      const bands = state.bands;
      const usable = state.shots.length >= 2;
      toggleAttr(element, 'data-empty', !usable);
      setText(headline, usable ? summary(bands) : 'ショットを2枚以上読み込むと検出します');

      toggle.setAttribute('aria-checked', String(bands.enabled));
      toggle.disabled = !usable;
      toggleAttr(body, 'data-disabled', !bands.enabled || !usable);

      if (document.activeElement !== header.input) header.input.value = String(bands.headerPx);
      if (document.activeElement !== footer.input) footer.input.value = String(bands.footerPx);
      header.input.disabled = !bands.enabled || !usable;
      footer.input.disabled = !bands.enabled || !usable;
      endsToggle.checked = bands.trimEnds;
      endsToggle.disabled = !bands.enabled || !usable;

      const differs = usable && bandsDifferFromDetection(bands);
      toggleAttr(drift, 'hidden', !differs);
      if (differs) {
        setText(
          driftText,
          `手動で調整中（検出値: 上端 ${bands.detectedHeaderPx}px / 下端 ${bands.detectedFooterPx}px）`,
        );
      }
    },
  };
}
