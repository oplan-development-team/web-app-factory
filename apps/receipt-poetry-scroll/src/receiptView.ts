import { ReceiptData } from './receiptData';
import { formatYen } from './pricing';
import { barcodeLayout } from './barcode';

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

function buildBarcodeSvg(seed: number, receiptNo: string): SVGSVGElement {
  const segments = barcodeLayout(seed);
  const viewWidth = 1000;
  const height = 34;

  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', `0 0 ${viewWidth} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(height));
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'receipt__barcode-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `バーコード風装飾 受領番号 ${receiptNo}`);

  for (const seg of segments) {
    const rect = document.createElementNS(svgNs, 'rect');
    rect.setAttribute('x', String(seg.offset * viewWidth));
    rect.setAttribute('y', '0');
    rect.setAttribute('width', String(seg.width * viewWidth));
    rect.setAttribute('height', String(height));
    rect.setAttribute('fill', 'currentColor');
    svg.appendChild(rect);
  }
  return svg;
}

/** レシートの内容を安全な DOM 操作（textContent）のみで #receipt-body に描画する。 */
export function renderReceiptDom(body: HTMLElement, data: ReceiptData): void {
  body.replaceChildren();

  const header = el('header', 'receipt__header');
  header.appendChild(el('h2', 'receipt__store', data.storeName));
  header.appendChild(el('p', 'receipt__meta', `${data.timestamp}`));
  body.appendChild(header);

  body.appendChild(el('div', 'receipt__divider'));

  const list = el('div', 'receipt__items');
  for (const line of data.lines) {
    const row = el('div', line.isSale ? 'receipt__row receipt__row--sale' : 'receipt__row');

    const nameWrap = el('span', 'receipt__name-wrap');
    if (line.isSale) {
      nameWrap.appendChild(el('span', 'receipt__tag', '本日の特売'));
    }
    nameWrap.appendChild(el('span', 'receipt__name', line.text));
    row.appendChild(nameWrap);

    row.appendChild(el('span', 'receipt__leader'));

    const priceWrap = el('span', 'receipt__price-wrap');
    if (line.isSale && line.originalPrice !== undefined) {
      priceWrap.appendChild(el('del', 'receipt__price-original', formatYen(line.originalPrice)));
    }
    priceWrap.appendChild(el('span', 'receipt__price', formatYen(line.price)));
    row.appendChild(priceWrap);

    list.appendChild(row);
  }
  body.appendChild(list);

  body.appendChild(el('div', 'receipt__divider'));

  const totalRow = el('div', 'receipt__total');
  totalRow.appendChild(el('span', 'receipt__total-label', data.totalLabel));
  totalRow.appendChild(el('span', 'receipt__total-amount', formatYen(data.total)));
  body.appendChild(totalRow);

  body.appendChild(el('p', 'receipt__footer', data.footer));

  const barcodeBlock = el('div', 'receipt__barcode');
  barcodeBlock.appendChild(buildBarcodeSvg(data.barcodeSeed, data.receiptNo));
  barcodeBlock.appendChild(el('p', 'receipt__barcode-number', `No. ${data.receiptNo}`));
  body.appendChild(barcodeBlock);
}
