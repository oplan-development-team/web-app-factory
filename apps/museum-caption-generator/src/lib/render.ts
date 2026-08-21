import type { GeneratedCaption } from './types';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * 生成されたキャプション一式を、プレート要素の中身として描画する。
 * すべて textContent で挿入するため、生成語彙以外の文字列が混入しても HTML として解釈されない。
 */
export function renderPlate(container: HTMLElement, caption: GeneratedCaption): void {
  container.replaceChildren();

  const inner = el('div', 'plate-inner');

  const title = el('h2', 'plate-title', caption.title);

  const artistRow = el('p', 'plate-artist');
  artistRow.append(el('span', 'plate-artist-name', caption.artist));

  const metaRow = el('p', 'plate-meta');
  metaRow.append(
    el('span', 'plate-meta-item', caption.year),
    el('span', 'plate-meta-sep', '／'),
    el('span', 'plate-meta-item', caption.medium),
  );

  const dimensions = el('p', 'plate-dimensions', caption.dimensions);

  const divider = el('hr', 'plate-divider');

  const body = el('p', 'plate-body', caption.body);

  inner.append(title, artistRow, metaRow, dimensions, divider, body);
  container.append(inner);
}
