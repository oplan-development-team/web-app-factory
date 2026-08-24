// Single split-flap character tile.
// DOM has two static halves (always showing the *current* value, hidden
// beneath the animated leaves while a flip is running) and two animated
// leaves (front = old value folding down, back = new value folding up).
// This module only ever touches text content + CSS classes; all motion is
// defined in CSS via rotateX keyframes.

const BLANK = ' ';

export function createFlap(initialChar = BLANK) {
  const flap = document.createElement('div');
  flap.className = 'flap';
  flap.setAttribute('aria-hidden', 'true');

  flap.innerHTML = `
    <div class="flap__half flap__half--top"><span class="flap__char"></span></div>
    <div class="flap__half flap__half--bottom"><span class="flap__char"></span></div>
    <div class="flap__leaf flap__leaf--front"><span class="flap__char"></span></div>
    <div class="flap__leaf flap__leaf--back"><span class="flap__char"></span></div>
  `;

  const topSpan = flap.querySelector('.flap__half--top .flap__char');
  const bottomSpan = flap.querySelector('.flap__half--bottom .flap__char');
  const frontSpan = flap.querySelector('.flap__leaf--front .flap__char');
  const backSpan = flap.querySelector('.flap__leaf--back .flap__char');

  let current = BLANK;

  function paint(span, ch) {
    span.textContent = ch === BLANK ? '' : ch;
  }

  function applyStatic(ch) {
    paint(topSpan, ch);
    paint(bottomSpan, ch);
    flap.classList.toggle('is-blank', ch === BLANK);
  }

  function setChar(nextChar, animate = true) {
    const next = nextChar == null || nextChar === '' ? BLANK : nextChar;
    if (next === current) return;

    if (!animate) {
      applyStatic(next);
      current = next;
      return;
    }

    paint(frontSpan, current);
    paint(backSpan, next);
    applyStatic(next);
    current = next;

    // Restart the flip animation even if one is already mid-flight.
    flap.classList.remove('is-flipping');
    // eslint-disable-next-line no-unused-expressions
    void flap.offsetWidth; // force reflow so the class removal registers
    flap.classList.add('is-flipping');
  }

  applyStatic(initialChar === '' ? BLANK : initialChar);
  current = initialChar === '' ? BLANK : initialChar;

  return { el: flap, setChar };
}
