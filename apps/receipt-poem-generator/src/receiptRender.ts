import type { AppState } from './types';
import { formatReceiptStamp, formatYen, hashString, mulberry32 } from './util';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildBarcode(seed: string): HTMLElement {
  const wrap = el('div', 'receipt__barcode');
  wrap.setAttribute('aria-hidden', 'true');
  const rand = mulberry32(hashString(seed));
  const barCount = 34;
  for (let i = 0; i < barCount; i += 1) {
    const bar = el('span', 'receipt__barcode-bar');
    const isBar = rand() > 0.42;
    bar.style.flex = `${isBar ? 2 + Math.floor(rand() * 3) : 1} 0 auto`;
    bar.style.background = isBar ? 'var(--ink)' : 'transparent';
    wrap.appendChild(bar);
  }
  return wrap;
}

function buildBarcodeNumber(seed: string): string {
  const h = hashString(seed);
  const digits = String(h).padStart(13, '0').slice(0, 13);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

/**
 * Renders the receipt preview DOM into `root`, replacing its contents.
 * The structure mirrors `canvasRenderer.ts` so the exported PNG matches what is shown on screen.
 */
export function renderReceiptPreview(root: HTMLElement, state: AppState): void {
  root.innerHTML = '';
  root.classList.toggle('receipt--poem', state.poemMode);
  root.classList.toggle('receipt--empty', state.items.length === 0);

  const inner = el('div', 'receipt__inner');

  const header = el('header', 'receipt__header');
  header.appendChild(el('p', 'receipt__store', state.storeName || '（無題の店）'));

  if (state.poemMode) {
    header.appendChild(el('p', 'receipt__poem-date', formatReceiptStamp(state.dateTimeLocal)));
  } else {
    const meta = el('p', 'receipt__meta');
    meta.append(formatReceiptStamp(state.dateTimeLocal), el('span', 'receipt__meta-dot', '・'), state.receiptNo);
    header.appendChild(meta);
  }
  inner.appendChild(header);

  if (state.items.length === 0) {
    inner.appendChild(el('div', 'receipt__rule'));
    const empty = el(
      'p',
      'receipt__empty-message',
      'まだ品目がありません。左の原稿用紙に、詩の一行を書き足してください。',
    );
    inner.appendChild(empty);
    root.appendChild(inner);
    return;
  }

  if (state.poemMode) {
    const list = el('ol', 'receipt__poem-lines');
    state.items.forEach((item) => {
      const line = el('li', 'receipt__poem-line', item.name || '（無題の行）');
      list.appendChild(line);
    });
    inner.appendChild(list);
    inner.appendChild(el('p', 'receipt__footer-phrase receipt__footer-phrase--poem', state.footerPhrase));
    root.appendChild(inner);
    return;
  }

  inner.appendChild(el('div', 'receipt__rule'));

  const list = el('ul', 'receipt__items');
  let subtotal = 0;
  state.items.forEach((item) => {
    const lineTotal = item.qty * item.unitPrice;
    subtotal += lineTotal;

    const li = el('li', 'receipt__item');
    const line = el('div', 'receipt__item-line');
    line.appendChild(el('span', 'receipt__item-name', item.name || '（無題の品目）'));
    line.appendChild(el('span', 'receipt__item-leader'));
    line.appendChild(el('span', 'receipt__item-amount', formatYen(lineTotal)));
    li.appendChild(line);
    li.appendChild(el('div', 'receipt__item-sub', `${formatYen(item.unitPrice)} × ${item.qty}`));
    list.appendChild(li);
  });
  inner.appendChild(list);

  inner.appendChild(el('div', 'receipt__rule'));

  const subtotalLine = el('div', 'receipt__line');
  subtotalLine.appendChild(el('span', '', '小計'));
  subtotalLine.appendChild(el('span', 'receipt__leader'));
  subtotalLine.appendChild(el('span', '', formatYen(subtotal)));
  inner.appendChild(subtotalLine);

  inner.appendChild(el('div', 'receipt__rule receipt__rule--bold'));

  const totalLine = el('div', 'receipt__line receipt__total');
  totalLine.appendChild(el('span', '', state.totalLabel));
  totalLine.appendChild(el('span', 'receipt__leader'));
  totalLine.appendChild(el('span', 'receipt__total-amount', formatYen(subtotal)));
  inner.appendChild(totalLine);

  const barcodeSeed = `${state.receiptNo}-${state.storeName}-${state.items.length}`;
  inner.appendChild(buildBarcode(barcodeSeed));
  inner.appendChild(el('p', 'receipt__barcode-number', buildBarcodeNumber(barcodeSeed)));

  inner.appendChild(el('p', 'receipt__footer-phrase', state.footerPhrase));

  root.appendChild(inner);
}

/** Triggers the "printing" reveal animation by replaying a CSS class. */
export function replayPrintAnimation(root: HTMLElement): void {
  root.classList.remove('is-printing');
  // Force reflow so the animation restarts even if the class was already applied.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  void root.offsetWidth;
  root.classList.add('is-printing');
}
