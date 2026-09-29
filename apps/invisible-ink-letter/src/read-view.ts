import { decodeLetter } from './codec';
import { mountFlashlightStage, type FlashlightStageHandle } from './flashlight-stage';

export function mountReadView(root: HTMLElement, hash: string, goToWrite: () => void): void {
  root.innerHTML = '';
  const letter = decodeLetter(hash);

  const page = el('div', 'page page--read');
  const header = el('header', 'brand brand--read');
  const mark = el('p', 'brand__mark');
  mark.textContent = 'ブラックライト便箋';
  header.append(mark);
  page.append(header);

  if (!letter) {
    const errorPanel = el('section', 'letter-panel letter-panel--error');
    const railLabel = el('div', 'letter-panel__rail');
    railLabel.textContent = 'N O T   F O U N D';
    const body = el('div', 'letter-panel__body');
    const title = el('h1', 'letter-panel__title');
    title.textContent = 'この手紙は、届いていないようです。';
    const lede = el('p', 'letter-panel__lede');
    lede.textContent = 'リンクが壊れているか、途中で切れてしまったのかもしれません。';
    const backLink = document.createElement('button');
    backLink.type = 'button';
    backLink.className = 'btn btn--ghost';
    backLink.textContent = '自分で手紙を書いてみる';
    backLink.addEventListener('click', goToWrite);
    body.append(title, lede, backLink);
    errorPanel.append(railLabel, body);
    page.append(errorPanel);
    root.append(page);
    return;
  }

  const stagePanel = el('section', 'letter-panel letter-panel--read');
  stagePanel.setAttribute('aria-label', '受け取った手紙');
  const stageHost = el('div', 'read-stage-host');
  stagePanel.append(stageHost);
  page.append(stagePanel);

  const footer = el('footer', 'read-footer');
  const footerLink = document.createElement('button');
  footerLink.type = 'button';
  footerLink.className = 'link-quiet';
  footerLink.textContent = '自分でも手紙を書いてみる';
  footerLink.addEventListener('click', () => {
    stage.destroy();
    goToWrite();
  });
  footer.append(footerLink);
  page.append(footer);

  root.append(page);

  const stage: FlashlightStageHandle = mountFlashlightStage(stageHost, letter);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
