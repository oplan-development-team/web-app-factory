import { createFlap } from './flap.js';

// A row of fixed-width flap tiles that together display a padded string,
// e.g. a title, a day counter, or a status word.
export function createFlapCluster(length, extraClassName = '') {
  const el = document.createElement('div');
  el.className = ['flap-cluster', extraClassName].filter(Boolean).join(' ');
  el.setAttribute('aria-hidden', 'true');

  const flaps = Array.from({ length }, () => {
    const flap = createFlap(' ');
    el.appendChild(flap.el);
    return flap;
  });

  function setText(text, animate = true) {
    const source = text ?? '';
    const padded = source.length >= length ? source.slice(0, length) : source.padEnd(length, ' ');
    for (let i = 0; i < length; i += 1) {
      flaps[i].setChar(padded[i], animate);
    }
  }

  return { el, setText, length };
}

export function createStaticLabel(text, className = 'cluster-static-label') {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  span.setAttribute('aria-hidden', 'true');
  return span;
}
